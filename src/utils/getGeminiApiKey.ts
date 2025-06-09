import { app } from "electron";
import fs from "fs";
import path from "path";

const isDev = process.env.NODE_ENV === "development";

const configPath = isDev
  ? "/home/greenantix/AI/gemini-mcp-desktop-client/static/serverConfig.json" // Fixed path for development
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