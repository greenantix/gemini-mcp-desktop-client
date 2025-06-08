import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron";
import { Request, Response } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";
const configPath = isDev
  ? path.join(__dirname, "../../../configurations/mcpServicesConfig.json")
  : path.join(app.getPath("userData"), "mcpServicesConfig.json");

export const saveServicesConfig = (req: Request, res: Response) => {
  try {
    const data: Record<string, unknown> = req.body;

    // Ensure directory exists
    const dirPath = path.dirname(configPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    return res.json(data);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ error: "Failed to save config.", message: err.message });
  }
};
