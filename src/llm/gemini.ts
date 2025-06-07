import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron";

const isDev = process.env.NODE_ENV === "development";
// Convert `import.meta.url` to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = isDev
  ? "/home/greenantix/AI/gemini-mcp-desktop-client/src/backend/configurations/serverConfig.json" // Hardcoded for development
  : path.join(app.getPath("userData"), "serverConfig.json"); // for packaged app


export async function initializeAndGetModel(model: string,contentReadFromFile:string|boolean) {
  try {
    // Bypass file reading - use the API key directly (we know it works)
    const GEMINI_API_KEY = "AIzaSyC6oGrn1D62R5urFLAvDgUAhuDQxL-J8xc";
    console.log(`[Gemini] Using direct API key for model: ${model}`);

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const geminiModel = genAI.getGenerativeModel({
      model: model,
      systemInstruction:`
      You are expert assistant who makes full utilization of the available tools and make sure user gets what he requested for. You try to fulfill the request completely on your own by using various available tools. You always answer in **Markdown**.
      ${contentReadFromFile?`If user asks about any file like image ,audio, excel file,csv, txt or any other file, use "CONTEXT OF FILE" to answer user query which is already present in user input`:``}
      1. user sends request.
      2. you check for suitable tools to fulfill user request. if required call multiple tools to fulfill user request.
      3. Make user interaction as less as possiible for solving user query.
      4. Always reply in Markdown.
`,
    });

    return geminiModel;
  } catch (e) {
    console.error(`[Gemini] Error initializing model:`, e);
    return null;
  }
}
