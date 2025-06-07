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

export const saveServerConfiguration = (req: any, res: any) => {
  try {
    const data = req.body;

    // Ensure directory exists
    const dirPath = path.dirname(configPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write the config
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    return res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save config.", message: err.message });
  }
};
