import { app } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const isDev = process.env.NODE_ENV === "development";
// Convert `import.meta.url` to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = isDev
  ? "/home/greenantix/AI/gemini-mcp-desktop-client/src/backend/configurations/serverConfig.json" // Hardcoded for development
  : path.join(app.getPath("userData"), "serverConfig.json");

export function getGeminiApiKey(): string | null {
  const data = fs.readFileSync(configPath, "utf-8");
  if (!data) {
    return null;
  }
  const serverConfigurations = JSON.parse(data);
  const { GEMINI_API_KEY } = serverConfigurations;
  return GEMINI_API_KEY || null;
}