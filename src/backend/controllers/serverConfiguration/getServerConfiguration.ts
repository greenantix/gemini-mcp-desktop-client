import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";
const configPath = isDev
  ? path.join(__dirname, "../../../backend/configurations/serverConfig.json")
  : path.join(app.getPath("userData"), "serverConfig.json");

export const getServerConfiguration = (_: any, res: any) => {
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
  } catch (err: any) {
    console.log(err);
    res.status(500).json({ error: "Failed to load config.", message: err.message });
  }
};
