import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron"; // Assuming this is for Electron context

const isDev = process.env.NODE_ENV === "development";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = isDev
  ? path.join(__dirname, "../src/backend/configurations/serverConfig.json") // for development
  : path.join(app.getPath("userData"), "serverConfig.json"); // for packaged app

// System instruction, can be defined here or in chatLLM.ts
export const GEMINI_SYSTEM_INSTRUCTION = `
You are expert assistant who makes full utilization of the available tools and make sure user gets what he requested for. You try to fulfill the request completely on your own by using various available tools. You always answer in **Markdown**.
1. user sends request.
2. you check for suitable tools to fulfill user request. if required call multiple tools to fulfill user request.
3. Make user interaction as less as possiible for solving user query.
4. Always reply in Markdown.
`;

export function getServerConfigs() {
  try {
    const data = fs.readFileSync(configPath, "utf-8");
    if (!data) {
      console.error(
        `[Config Error] Server configuration file is empty or not found at ${configPath}.`
      );
      // Return a structure that indicates missing keys, or throw
      return { GEMINI_API_KEYS: [] };
    }
    const serverConfigurations = JSON.parse(data);

    if (
      !serverConfigurations.GEMINI_API_KEYS ||
      !Array.isArray(serverConfigurations.GEMINI_API_KEYS) ||
      !serverConfigurations.GEMINI_API_KEYS.every(
        (key: any) => typeof key === "string" && key.length > 0
      )
    ) {
      console.error(
        "[Config Error] GEMINI_API_KEYS is missing, not an array, or contains invalid keys in serverConfig.json."
      );
      // Ensure GEMINI_API_KEYS is an empty array if invalid, so downstream checks don't fail on undefined
      return { ...serverConfigurations, GEMINI_API_KEYS: [] };
    }
    return serverConfigurations; // Should contain GEMINI_API_KEYS: string[]
  } catch (e: any) {
    console.error(
      "[Config Error] Failed to load or parse server configurations:",
      e.message
    );
    return { GEMINI_API_KEYS: [] }; // Fallback to empty keys on error
  }
}

// The old initializeAndGetModel function is no longer needed in this form,
// as model initialization will happen in chatLLM.ts with key cycling.
// If it had other responsibilities, they should be refactored.
