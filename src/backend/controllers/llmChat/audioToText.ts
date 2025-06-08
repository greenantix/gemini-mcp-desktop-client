import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import type { Request, Response } from "express"; // Using Express types
import formidable, { File as FormidableFile } from "formidable";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron";

const isDev = process.env.NODE_ENV === "development";
// Convert `import.meta.url` to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = isDev
  ? path.join(__dirname, "../../../configurations/serverConfig.json") // for development
  : path.join(app.getPath("userData"), "serverConfig.json");
// Initialize GoogleGenAI client
// CRITICAL: Store your API key in environment variables, do not hardcode it.

// Helper function to parse the form data (can be kept similar)
const parseForm = (
  req: Request
): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    const form = formidable({
      // Configure formidable options if needed:
      // keepExtensions: true,
      // uploadDir: '/path/to/temp/uploads', // Or let it use os.tmpdir()
      // maxFileSize: 50 * 1024 * 1024, // e.g., 50 MB
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
};

interface ApiError extends Error {
  status?: number;
  code?: number | string;
  httpCode?: number;
  response?: {
    data?: {
      error?: string | { message?: string };
    };
  };
  details?: string | Record<string, unknown>;
}

export const audioToTextHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  let serverConfigurations;
  try {
    const data = fs.readFileSync(configPath, "utf-8");
    serverConfigurations = JSON.parse(data);
  } catch (readError) {
    console.error("Failed to read or parse serverConfig.json:", readError);
    res.status(500).json({ error: "Server configuration error." });
    return;
  }

  const { GEMINI_API_KEY } = serverConfigurations;
  const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
  });
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { files } = await parseForm(req);

    // 'audioFile' must match the field name used in FormData on the frontend
    const uploadedFileArray = files.audioFile;

    if (!uploadedFileArray || uploadedFileArray.length === 0) {
      res.status(400).json({ error: "No audio file was uploaded." });
      return;
    }

    const audioFile = uploadedFileArray[0] as FormidableFile;

    if (!audioFile.filepath || !audioFile.mimetype) {
      res
        .status(400)
        .json({ error: "Uploaded file is missing path or MIME type." });
      return;
    }

    console.log(
      `Received file: ${audioFile.originalFilename || "N/A"}, Temp path: ${
        audioFile.filepath
      }, MIME type: ${audioFile.mimetype}`
    );

    if (!GEMINI_API_KEY) {
      // Check if API key was loaded
      console.error("Google GenAI API key is missing. Cannot upload file.");
      res
        .status(500)
        .json({ error: "Server configuration error: Missing API key." });
      return;
    }

    // 1. Upload the received file to Google GenAI's file service
    const googleUploadedFile = await ai.files.upload({
      file: audioFile.filepath,
      config: {
        mimeType: audioFile.mimetype,
        // displayName: audioFile.originalFilename || `uploaded-audio-${Date.now()}`
      },
    });

    console.log(
      `File uploaded to Google: ${googleUploadedFile.name}, URI: ${googleUploadedFile.uri}`
    );

    // 2. Use the URI of the uploaded file to generate content
    const genAIResponse = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: createUserContent([
        createPartFromUri(
          googleUploadedFile.uri || "",
          googleUploadedFile.mimeType || ""
        ),
        "Please transcribe the audio. If there are multiple speakers, try to differentiate them if possible (e.g., Speaker 1, Speaker 2). If the audio contains languages other than English, please provide the transcription in English.",
      ]),
    });

    // 3. Clean up the temporary file stored by formidable
    fs.unlink(audioFile.filepath, (unlinkErr) => {
      if (unlinkErr) {
        console.warn(
          `Warning: Failed to delete temporary file ${audioFile.filepath}:`,
          unlinkErr
        );
      } else {
        console.log(
          `Temporary file ${audioFile.filepath} deleted successfully.`
        );
      }
    });

    // 4. Return the transcription to the client
    // The frontend expects a 'transcript' field in the JSON response.
    res.status(200).json({ transcript: genAIResponse.text });
  } catch (error: unknown) {
    const err = error as ApiError; // Type assertion
    console.error("Error in audioToText API:", err);

    let errorMessage = "Failed to process audio.";
    const rawStatusCode = err.status || err.code || err.httpCode || 500;
    let numericStatusCode = 500;

    if (typeof rawStatusCode === 'number') {
      numericStatusCode = rawStatusCode;
    } else if (typeof rawStatusCode === 'string') {
      const parsedCode = parseInt(rawStatusCode, 10);
      if (!isNaN(parsedCode)) {
        numericStatusCode = parsedCode;
      }
    }

    if (err.response && err.response.data && err.response.data.error) {
      const errorData = err.response.data.error;
      if (typeof errorData === 'object' && errorData.message) {
        errorMessage = errorData.message;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      }
    } else if (err.message) {
      errorMessage = err.message;
    } else if (typeof err === "string") { // This case might be redundant if caught as ApiError
      errorMessage = err;
    }

    const errorDetails = err.details || err.toString();
    res.status(numericStatusCode).json({ error: errorMessage, details: errorDetails });
  }
};
