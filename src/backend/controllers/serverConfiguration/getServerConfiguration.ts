import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron";
import { Request, Response } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";
const configPath = isDev
  ? path.join(__dirname, "../../../configurations/serverConfig.json")
  : path.join(app.getPath("userData"), "serverConfig.json");

export const getServerConfiguration = (_req: Request, res: Response) => {
  try {
    // If the file doesn't exist, return default config
    if (!fs.existsSync(configPath)) {
      return res.json({ GEMINI_API_KEY: "" });
    }

    const data = fs.readFileSync(configPath, "utf-8");
    if (!data) {
      return res.json({ GEMINI_API_KEY: "" });
    }

    const serverConfiguration = JSON.parse(data);
    return res.json({ ...serverConfiguration });
  } catch (error: unknown) {
    const err = error as Error;
    console.log(err);
    res.status(500).json({ error: "Failed to load config.", message: err.message });
  }
};
