// --- START OF FILE chatLLM.ts ---

import {
  Content,
  Part,
  FunctionCall,
  GenerateContentResponse,
  GenerateContentResult,
  ChatSession,
} from "@google/generative-ai";
import type { Request, Response } from "express";
import formidable from "formidable"; // Removed 'File as FormidableFile' as it's not used
import { connectToMcpServers } from "../../../utils/llmChat/getMcpTools";
import { initializeAndGetModel } from "../../../llm/gemini";
import * as fs from "fs/promises";
import * as path from "path";
import { parseAudioFile } from "../../../utils/llmChat/parsers/audioParser";
import { File as FormidableFile } from "formidable";
import { parseVideoFile } from "../../../utils/llmChat/parsers/videoParser";
import { parseImageFile } from "../../../utils/llmChat/parsers/imageParser";
import { parsePDFFile } from "../../../utils/llmChat/parsers/pdfParser";
import { parseTextFile } from "../../../utils/llmChat/parsers/txtParser";
import { parseCSVFile } from "../../../utils/llmChat/parsers/csvParser";
import { parseDocxFile } from "../../../utils/llmChat/parsers/docxParser";
// import { parseDocFile } from "../../../utils/llmChat/parsers/docParser";
import { parseExcelFile } from "../../../utils/llmChat/parsers/excelParser";
import { parsePptxFile } from "../../../utils/llmChat/parsers/pptxParser";
// import { parsePptFile } from "../../../utils/llmChat/parsers/pptParser";

interface McpToolResultContentPart {
  text?: string;
  // other potential properties if known
}

interface McpToolResult {
  content: string | McpToolResultContentPart[] | unknown; // More specific if possible
  // other potential properties from tool result
}

const LOG_DIRECTORY = process.cwd();

const parseForm = (
  req: Request
): Promise<{
  fields: formidable.Fields;
  files: formidable.Files;
  webSearch: boolean; // Changed to boolean
  model: string | string[] | undefined;
  message: string | string[] | undefined;
  history: Content[];
}> => {
  return new Promise((resolve, reject) => {
    const form = formidable({
      // keepExtensions: true,
      // uploadDir: '/path/to/temp/uploads',
      // maxFileSize: 50 * 1024 * 1024,
    });

    form.parse(req, (err, incomingFields, incomingFiles) => {
      if (err) {
        reject(err);
        return;
      }

      let parsedHistory: Content[] = [];
      const historyField = incomingFields.history;
      let historyJsonString: string | undefined;

      if (Array.isArray(historyField)) {
        historyJsonString = historyField[0];
      } else {
        historyJsonString = historyField as string | undefined;
      }

      if (historyJsonString) {
        try {
          const tempHistory = JSON.parse(historyJsonString);
          if (Array.isArray(tempHistory)) {
            parsedHistory = tempHistory as Content[];
          } else {
            console.warn(
              "Parsed history from form is not an array. Using empty history."
            );
          }
        } catch (parseError) {
          console.warn(
            `Failed to parse 'history' field from form data: ${
              (parseError as Error).message
            }. Using empty history.`
          );
        }
      }

      // Convert webSearch field to boolean
      const webSearchField = incomingFields.webSearch;
      let webSearchEnabled = false; // Default to false
      if (typeof webSearchField === "string") {
        webSearchEnabled = ["true", "on", "1"].includes(webSearchField);
      } else if (Array.isArray(webSearchField) && webSearchField.length > 0) {
        // If it's an array (e.g., multiple form fields with the same name), check the first.
        webSearchEnabled = ["true", "on", "1"].includes(
          webSearchField[0].toLowerCase()
        );
      }
      // If webSearchField is undefined or an empty array, webSearchEnabled remains false.

      resolve({
        fields: incomingFields,
        files: incomingFiles,
        webSearch: webSearchEnabled, // Pass the boolean value
        model: incomingFields.model,
        message: incomingFields.message,
        history: parsedHistory,
      });
    });
  });
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MCP_TOOL_MAX_RETRIES = 3;
const MCP_TOOL_RETRY_DELAY_MS = 1000;
const TOTAL_MCP_TOOL_ATTEMPTS = 1 + MCP_TOOL_MAX_RETRIES;

const GEMINI_API_MAX_RETRIES = 2;
const GEMINI_API_RETRY_DELAY_MS = 1500;
const TOTAL_GEMINI_API_ATTEMPTS = 1 + GEMINI_API_MAX_RETRIES;

const logChatInteraction = async (
  modelName: string,
  userQuery: string,
  chatbotResponse: string
): Promise<void> => {
  let logFilePath = "";
  try {
    const sanitizedModelName = modelName
      .replace(/[^a-z0-9_.-]/gi, "_") // Removed unnecessary escape for .
      .replace(/\.+$/, "");
    const safeModelName = sanitizedModelName || "unknown_model";
    const logFileName = `${safeModelName}.log`;
    logFilePath = path.join(LOG_DIRECTORY, logFileName);

    const logEntry = `
============================================================
Model: ${modelName}
------------------------------------------------------------
User Query:
${userQuery}
------------------------------------------------------------
Chatbot Response:
${chatbotResponse}
============================================================
\n`;

    await fs.appendFile(logFilePath, logEntry, "utf8");
    console.log(`Chat interaction logged successfully to ${logFilePath}`);
  } catch (logError) {
    console.error(
      `[Log Error] Failed to write chat interaction to log file '${
        logFilePath || `${modelName}.log`
      }':`,
      logError
    );
  }
};

async function sendMessageWithRetry(
  chat: ChatSession,
  messageToSend: string | Part | Array<string | Part>,
  attemptInfo: string
): Promise<GenerateContentResult> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < TOTAL_GEMINI_API_ATTEMPTS) {
    attempt++;
    try {
      console.log(
        `  [API Attempt ${attempt}/${TOTAL_GEMINI_API_ATTEMPTS}] Sending ${attemptInfo} to Gemini...`
      );
      // Ensure messageToSend is in the correct format for chat.sendMessage
      const messageForApi = (typeof messageToSend === 'string' || Array.isArray(messageToSend))
        ? messageToSend
        : [messageToSend]; // Wrap single Part in an array
      const result = await chat.sendMessage(messageForApi);
      if (result.response?.promptFeedback?.blockReason) {
        console.warn(
          `  [API Attempt ${attempt}] Gemini response potentially blocked: ${result.response.promptFeedback.blockReason}. Proceeding as API call succeeded.`
        );
      }
      console.log(`  [API Attempt ${attempt}] SUCCESS sending ${attemptInfo}.`);
      return result;
    } catch (error: unknown) {
      const typedError = error as Error;
      lastError = typedError;
      console.warn(
        `  [API Attempt ${attempt}/${TOTAL_GEMINI_API_ATTEMPTS}] FAILED sending ${attemptInfo}. Error:`,
        typedError.message || typedError
      );
      const isRetryable =
        typedError.message?.includes("500 Internal Server Error") ||
        typedError.message?.includes("503 Service Unavailable") ||
        typedError.message?.includes("fetch failed") ||
        typedError.message?.includes("timeout");

      if (isRetryable && attempt < TOTAL_GEMINI_API_ATTEMPTS) {
        console.log(
          `    Retrying Gemini API call in ${GEMINI_API_RETRY_DELAY_MS}ms...`
        );
        await delay(GEMINI_API_RETRY_DELAY_MS);
      } else {
        console.error(
          `❌ Gemini API call for ${attemptInfo} failed after ${attempt} attempts. Not retrying or max retries reached.`
        );
        throw lastError;
      }
    }
  }
  throw (
    lastError ||
    new Error(
      `Gemini API call failed after ${TOTAL_GEMINI_API_ATTEMPTS} attempts for ${attemptInfo}, but no error was captured.`
    )
  );
}

export const chatWithLLM = async (req: Request, res: Response): Promise<void> => {
  const {
    message: userMessageField,
    history,
    model: modelNameField,
    webSearch, // This is now a boolean
    // Prefixed with _ if not used yet, to avoid "unused variable" warnings.
    // Remove them if you are sure they won't be used.
    files: _files,
    fields: _fields,
  } = await parseForm(req);

  const contentFile = _files?.files?.[0] as FormidableFile | undefined;

  let contentReadFromFile: string | boolean = "";
  const mimeType = contentFile?.mimetype || undefined;
  const originalFilename = contentFile?.originalFilename || "";
  const fileExtension = originalFilename.split(".").pop()?.toLowerCase() || "";
  if (contentFile?.mimetype?.includes("audio/")) {
    contentReadFromFile = await parseAudioFile(contentFile);
  }
  if (contentFile?.mimetype?.includes("video/")) {
    contentReadFromFile = await parseVideoFile(contentFile);
  }
  if (contentFile?.mimetype?.includes("image/")) {
    contentReadFromFile = await parseImageFile(contentFile);
  }
  if (contentFile?.mimetype?.includes("application/pdf")) {
    contentReadFromFile = await parsePDFFile(contentFile);
  }
  if (contentFile?.mimetype?.includes("application/pdf")) {
    contentReadFromFile = await parsePDFFile(contentFile);
  }
  if (mimeType === "text/plain" || fileExtension === "txt") {
    contentReadFromFile = await parseTextFile(contentFile);
  }
  if (mimeType === "text/csv" || fileExtension === "csv") {
    contentReadFromFile = await parseCSVFile(contentFile);
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileExtension === "docx"
  ) {
    contentReadFromFile = await parseDocxFile(contentFile);
  }
  // if (mimeType === "application/msword" || fileExtension === "doc") {
  //   contentReadFromFile = await parseDocFile(contentFile);
  // }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || // XLSX new mime
    mimeType === "application/vnd.ms-excel" || // XLS and sometimes XLSX old mime
    fileExtension === "xlsx" ||
    fileExtension === "xls"
  ) {
    contentReadFromFile = await parseExcelFile(contentFile);
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    fileExtension === "pptx"
  ) {
    contentReadFromFile = await parsePptxFile(contentFile);
  }
  // if (mimeType === "application/vnd.ms-powerpoint" || fileExtension === "ppt") {
  //   contentReadFromFile = await parsePptFile(contentFile);
  // }
  let currentMessage = Array.isArray(userMessageField)
    ? userMessageField[0]
    : userMessageField;
  const currentModelName = Array.isArray(modelNameField)
    ? modelNameField[0]
    : modelNameField;

  // Allow file-only submissions or require a message
  if (!currentMessage && !contentFile) {
    res.status(400).json({ error: "Message or file is required" });
    return;
  }
  if (!currentModelName) {
    res.status(400).json({ error: "Model name ('model') is required" });
    return;
  }
  // Handle file-only uploads
  if (!currentMessage && contentFile) {
    currentMessage = `Please analyze this ${contentFile.mimetype?.split('/')[0] || 'file'}: ${contentFile.originalFilename || 'uploaded file'}`;
  }
  
  if (contentReadFromFile) {
    currentMessage =
      currentMessage + `\nCONTEXT OF FILE\n ${contentReadFromFile}`;
  }
  try {
    // webSearch is now directly a boolean
    const { allGeminiTools, mcpClients, toolToServerMap } =
      await connectToMcpServers(webSearch);

    console.log(
      "Tools configured for Gemini:",
      allGeminiTools.map((t) => t.name)
    );
    console.log("Connected MCP Clients:", Array.from(mcpClients.keys()));

    if (mcpClients.size === 0 && allGeminiTools.length > 0) {
      console.warn("Warning: Tools defined but no MCP Servers are connected.");
      res.status(503).json({
        error: "Tools require MCP Servers, but none are connected.",
        toolNames: allGeminiTools.map((t) => t.name),
      });
      return;
    }

    const geminiModel = await initializeAndGetModel(
      currentModelName,
      contentReadFromFile
    );
    if (!geminiModel) {
      res.status(503).json({
        error: `Server LLM '${currentModelName}' not configured or failed to initialize`,
      });
      return;
    }

    // Ensure history starts with user message for Gemini API
    let cleanHistory = history;
    if (history.length > 0 && history[0].role !== "user") {
      // Find first user message and start history from there
      const firstUserIndex = history.findIndex(msg => msg.role === "user");
      cleanHistory = firstUserIndex >= 0 ? history.slice(firstUserIndex) : [];
    }

    const chat = geminiModel.startChat({
      history: cleanHistory,
      tools:
        allGeminiTools.length > 0
          ? [{ functionDeclarations: allGeminiTools }]
          : undefined,
    });

    // Ensure currentMessage is a string before sending
    if (typeof currentMessage !== 'string') {
      // This case should ideally be handled by earlier logic, but as a safeguard:
      console.error("Critical: currentMessage is not a string before sending to LLM. This should not happen.");
      res.status(500).json({ error: "Internal error: message content is invalid." });
      return;
    }
    let result: GenerateContentResult = await sendMessageWithRetry(
      chat,
      currentMessage, // Now confirmed to be a string
      "initial user message"
    );
    let response: GenerateContentResponse | undefined = result.response;

    let currentContent: Content | undefined =
      response?.candidates?.[0]?.content;
    let functionCallsToProcess: FunctionCall[] | undefined =
      currentContent?.parts
        ?.filter((part: Part) => !!part.functionCall)
        .map((part: Part) => part.functionCall as FunctionCall);

    while (functionCallsToProcess && functionCallsToProcess.length > 0) {
      console.log(
        `Gemini requested ${functionCallsToProcess.length} tool call(s):`,
        functionCallsToProcess.map((c) => c.name)
      );

      const functionResponses: Part[] = [];

      await Promise.all(
        functionCallsToProcess.map(async (call) => {
          const toolName = call.name;
          const toolArgs = call.args;
          const serverKey = toolToServerMap.get(toolName);
          const targetClient = serverKey
            ? mcpClients.get(serverKey)
            : undefined;

          if (!targetClient) {
            console.error(
              `❌ Tool "${toolName}" requested, but no connected/mapped MCP client found (Server Key: ${
                serverKey || "Not Found"
              }).`
            );
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: {
                  content: `Error: Tool "${toolName}" could not be routed. Unavailable or mapping failed.`,
                },
              },
            });
            return;
          }

          console.log(
            `Attempting MCP tool "${toolName}" via server "${serverKey}" with args:`,
            toolArgs
          );

          let attempt = 0;
          let success = false;
          let mcpToolResult: McpToolResult | null = null;
          let lastToolError: Error | null = null;

          while (attempt < TOTAL_MCP_TOOL_ATTEMPTS && !success) {
            attempt++;
            try {
              console.log(
                `  [MCP Tool Attempt ${attempt}/${TOTAL_MCP_TOOL_ATTEMPTS}] Calling tool "${toolName}"...`
              );
              // Assuming callTool returns something compatible with McpToolResult
              mcpToolResult = (await targetClient.callTool({
                name: toolName,
                arguments: toolArgs as { [x: string]: unknown } | undefined,
              })) as McpToolResult; // Cast if necessary, or refine McpToolResult type
              console.log(
                `  [MCP Tool Attempt ${attempt}] SUCCESS for tool "${toolName}". Raw Response:`,
                mcpToolResult
              );
              success = true;
            } catch (toolError: unknown) {
              const typedToolError = toolError as Error;
              lastToolError = typedToolError;
              console.warn(
                `  [MCP Tool Attempt ${attempt}/${TOTAL_MCP_TOOL_ATTEMPTS}] FAILED for tool "${toolName}". Error:`,
                typedToolError.message || typedToolError
              );
              if (attempt < TOTAL_MCP_TOOL_ATTEMPTS) {
                console.log(
                  `    Retrying MCP tool call in ${MCP_TOOL_RETRY_DELAY_MS}ms...`
                );
                await delay(MCP_TOOL_RETRY_DELAY_MS);
              } else {
                console.error(
                  `❌ MCP Tool "${toolName}" failed after ${TOTAL_MCP_TOOL_ATTEMPTS} attempts. Last error:`,
                  lastToolError
                );
              }
            }
          }

          if (success && mcpToolResult) {
            let responseContent: string | unknown = // More specific than any
              "Tool executed successfully but produced no specific content.";

            try {
              if (typeof mcpToolResult.content === "string") {
                responseContent = mcpToolResult.content;
              } else if (Array.isArray(mcpToolResult.content)) {
                const texts = (mcpToolResult.content as McpToolResultContentPart[])
                  .map((part: McpToolResultContentPart) =>
                    part && typeof part.text === "string" ? part.text : null
                  )
                  .filter(
                    (text: string | null): text is string => text !== null
                  );
                if (texts.length > 0) {
                  responseContent = texts.join("\n");
                } else if (mcpToolResult.content.length > 0) { // If array but no text parts, stringify
                  responseContent = JSON.stringify(mcpToolResult.content);
                }
                // If array is empty, responseContent remains the default message
              } else if (
                mcpToolResult.content !== null &&
                mcpToolResult.content !== undefined
              ) {
                responseContent = JSON.stringify(mcpToolResult.content);
              }
            } catch (parseError) {
              console.error(
                `Error simplifying tool response content for "${toolName}", falling back to stringify:`,
                parseError
              );
              try {
                responseContent = JSON.stringify(mcpToolResult.content);
              } catch (stringifyError) {
                console.error(
                  `Failed even to stringify tool content for "${toolName}":`,
                  stringifyError
                );
                responseContent = `Error: Could not process tool response content. Type: ${typeof mcpToolResult.content}`;
              }
            }

            console.log(
              `  Simplified/Prepared content for "${toolName}":`,
              responseContent
            );

            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { content: responseContent },
              },
            });
          } else {
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: {
                  content: `Error executing tool ${toolName} after ${TOTAL_MCP_TOOL_ATTEMPTS} attempts: ${
                    lastToolError?.message ||
                    "Unknown error during tool execution"
                  }`,
                },
              },
            });
          }
        })
      );

      try {
        result = await sendMessageWithRetry(
          chat,
          functionResponses,
          "tool responses"
        );
        response = result.response;
      } catch (sendError) {
        console.error(
          "FATAL: Failed to send tool responses to Gemini even after retries.",
          sendError
        );
        throw sendError;
      }

      currentContent = response?.candidates?.[0]?.content;
      functionCallsToProcess = currentContent?.parts
        ?.filter((part: Part) => !!part.functionCall)
        .map((part: Part) => part.functionCall as FunctionCall);
    }

    let finalAnswer =
      "Sorry, I encountered an issue and could not generate a final response.";
    if (response?.candidates?.[0]?.content?.parts) {
      const textParts = response.candidates[0].content.parts
        .filter(
          (part: Part): part is Part & { text: string } =>
            typeof part.text === "string"
        )
        .map((part) => part.text);

      if (textParts.length > 0) {
        finalAnswer = textParts.join(" ");
      } else if (
        response.candidates[0].finishReason === "STOP" ||
        !response.candidates[0].finishReason
      ) {
        console.log(
          "Gemini finished (or finish reason unclear), but no final text part was generated."
        );
      } else {
        finalAnswer = `Processing stopped. Reason: ${response.candidates[0].finishReason}`;
        console.warn(
          `Gemini stopped with reason: ${response.candidates[0].finishReason}`,
          response.candidates[0]
        );
      }
    } else if (response?.promptFeedback?.blockReason) {
      finalAnswer = `My response was blocked. Reason: ${response.promptFeedback.blockReason}`;
      console.warn(
        `Gemini response blocked: ${response.promptFeedback.blockReason}`,
        response.promptFeedback
      );
    } else if (!response) {
      finalAnswer =
        "Sorry, there was a problem communicating with the AI model.";
      console.error(
        "No response object available after chat completion attempts."
      );
    }

    console.log("Final Gemini response being sent to user:", finalAnswer);

    // Ensure currentMessage is a string for logging
    await logChatInteraction(currentModelName, currentMessage as string, finalAnswer);

    const finalHistory = await chat.getHistory();
    res.json({ reply: finalAnswer, history: finalHistory });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error in chatWithLLM:", err.stack || err);
    // Use currentModelName and currentMessage if available, otherwise fall back
    await logChatInteraction(
      currentModelName || "unknown_model_on_error",
      (currentMessage as string) || "unknown_query_on_error", // Cast or provide default
      `Error during processing: ${err.message || "Unknown server error"}`
    );
    res.status(500).json({
      error: `Failed in chat handler: ${err.message || "Unknown server error"}`,
    });
  }
};
// --- END OF FILE chatLLM.ts ---
