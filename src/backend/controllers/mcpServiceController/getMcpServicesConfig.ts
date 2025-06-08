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

export const getServicesConfig = (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configPath)) {
      return res.status(400).json({ error: "No data saved yet" });
    }

    const data = fs.readFileSync(configPath, "utf-8");
    if (!data) {
      return res.status(400).json({ error: "No data saved yet" });
    }

    return res.json(JSON.parse(data));
  } catch (error: unknown) {
    const err = error as Error;
    console.log(err);
    res.status(500).json({ error: "Failed to read config.", message: err.message });
  }
};
