import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes/index.ts";

dotenv.config();
export function startServer() {
  const PORT = process.env.PORT || 5001;

  const app: Application = express();
  app.use(cors({
    origin: '*', // allow all — use this for Electron apps with file:// origin
  }));
  
  // Increase payload size limits for large screenshots (up to 10MB)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.use("/api", routes);
  app.listen(PORT, async () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  });
}
