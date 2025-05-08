import {
  GoogleGenerativeAI,
  GenerativeModel,
  ChatSession,
  Content,
  Part,
  FunctionCall,
  GenerateContentResponse,
  GenerateContentResult,
  // GoogleGenerativeAIError // Import if available and you want to use instanceof checks
} from "@google/generative-ai";
import { connectToMcpServers } from "../../../utils/llmChat/getMcpTools";
// Import getServerConfigs and GEMINI_SYSTEM_INSTRUCTION from your first file
import {
  getServerConfigs,
  GEMINI_SYSTEM_INSTRUCTION,
} from "../../../llm/gemini"; // Adjust path as needed
import * as fs from "fs/promises";
import * as path from "path";

// --- Configuration for Logging ---
const LOG_DIRECTORY = process.cwd(); // Or use app.getPath('logs') for Electron

// --- Helper function for delay ---
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Retry configuration for MCP Tools ---
const MCP_TOOL_MAX_RETRIES = 3;
const MCP_TOOL_RETRY_DELAY_MS = 1000;
const TOTAL_MCP_TOOL_ATTEMPTS = 1 + MCP_TOOL_MAX_RETRIES;

// --- Retry configuration for Gemini API Calls (per key, for transient errors other than 429) ---
const GEMINI_API_MAX_RETRIES_PER_KEY = 2; // Retries for errors like 503, network issues, with the SAME key
const GEMINI_API_RETRY_DELAY_MS = 1500;
const TOTAL_GEMINI_API_ATTEMPTS_PER_KEY = 1 + GEMINI_API_MAX_RETRIES_PER_KEY;

/**
 * Asynchronously logs the user query and chatbot response.
 */
const logChatInteraction = async (
  modelName: string,
  userQuery: string,
  chatbotResponse: string
): Promise<void> => {
  let logFilePath = "";
  try {
    const sanitizedModelName = modelName
      .replace(/[^a-z0-9_\-\.]/gi, "_")
      .replace(/\.+$/, "");
    const safeModelName = sanitizedModelName || "unknown_model";
    const logFileName = `${safeModelName}.log`;
    logFilePath = path.join(LOG_DIRECTORY, logFileName);
    const logEntry = `\n============================================================\nModel: ${modelName}\n------------------------------------------------------------\nUser Query:\n${userQuery}\n------------------------------------------------------------\nChatbot Response:\n${chatbotResponse}\n============================================================\n\n`;
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

/**
 * Helper function to send messages to the Gemini API with retry logic
 * for transient errors. If a 429 error occurs, it throws immediately
 * to allow API key cycling. For other retryable errors (like 500, 503),
 * it retries a few times with the *same* API key before throwing.
 */
async function sendMessageWithRetry(
  chat: ChatSession, // Make sure ChatSession is correctly imported and typed
  messageToSend: string | Part | Array<string | Part>,
  attemptInfo: string
): Promise<GenerateContentResult> {
  let attempt = 0;
  let lastError: any = null;

  // Prepare the message in the format expected by chat.sendMessage
  // The error indicates chat.sendMessage expects: string | (string | Part)[]
  let messageForSdk: string | (string | Part)[];

  if (typeof messageToSend === "string") {
    messageForSdk = messageToSend;
  } else if (Array.isArray(messageToSend)) {
    // messageToSend is already Array<string | Part> (or a subtype like Part[])
    messageForSdk = messageToSend;
  } else {
    // messageToSend is a single Part object. Wrap it in an array.
    // A single Part (e.g., TextPart) needs to become [Part] to match (string | Part)[].
    messageForSdk = [messageToSend];
  }

  while (attempt < TOTAL_GEMINI_API_ATTEMPTS_PER_KEY) {
    attempt++;
    try {
      console.log(
        `  [API Attempt ${attempt}/${TOTAL_GEMINI_API_ATTEMPTS_PER_KEY} with current key] Sending ${attemptInfo} to Gemini...`
      );
      // Use the correctly formatted messageForSdk
      const result = await chat.sendMessage(messageForSdk);

      if (result.response?.promptFeedback?.blockReason) {
        console.warn(
          `  [API Attempt ${attempt}] Gemini response potentially blocked: ${result.response.promptFeedback.blockReason}. Proceeding as API call succeeded.`
        );
      }
      console.log(
        `  [API Attempt ${attempt}] SUCCESS sending ${attemptInfo} with current key.`
      );
      return result;
    } catch (error: any) {
      lastError = error;
      const errorMessage = error.message || String(error);
      const httpStatus = error.status || (error.cause as any)?.status; // Attempt to get HTTP status

      console.warn(
        `  [API Attempt ${attempt}/${TOTAL_GEMINI_API_ATTEMPTS_PER_KEY} with current key] FAILED sending ${attemptInfo}. Status: ${
          httpStatus || "N/A"
        }, Error: ${errorMessage}`
      );

      const is429Error =
        errorMessage.includes("429") ||
        httpStatus === 429 ||
        errorMessage.toLowerCase().includes("quota");
      if (is429Error) {
        console.warn(
          `  Encountered 429/Quota error with current key. Propagating for API key switch.`
        );
        throw error;
      }

      const isRetryableServerOrNetworkError =
        errorMessage.includes("500 Internal Server Error") ||
        httpStatus === 500 ||
        errorMessage.includes("503 Service Unavailable") ||
        httpStatus === 503 ||
        errorMessage.toLowerCase().includes("fetch failed") ||
        errorMessage.toLowerCase().includes("timeout");

      if (
        isRetryableServerOrNetworkError &&
        attempt < TOTAL_GEMINI_API_ATTEMPTS_PER_KEY
      ) {
        console.log(
          `    Retrying Gemini API call (same key) in ${GEMINI_API_RETRY_DELAY_MS}ms...`
        );
        await delay(GEMINI_API_RETRY_DELAY_MS);
      } else {
        console.error(
          `❌ Gemini API call for ${attemptInfo} failed after ${attempt} attempts with current key, or error is not retryable with this key. Propagating.`
        );
        throw lastError;
      }
    }
  }
  throw (
    lastError ||
    new Error(
      `Gemini API call for ${attemptInfo} failed after ${TOTAL_GEMINI_API_ATTEMPTS_PER_KEY} attempts (same key), but no error was captured.`
    )
  );
}

// Helper function to process function calls (adapted from original code)
async function processFunctionCalls(
  functionCallsToProcess: FunctionCall[],
  toolToServerMap: Map<string, string>,
  mcpClients: Map<string, any> // Adjust MCPClient type if known
): Promise<Part[]> {
  const functionResponses: Part[] = [];
  await Promise.all(
    functionCallsToProcess.map(async (call) => {
      const toolName = call.name;
      const toolArgs = call.args;
      const serverKey = toolToServerMap.get(toolName);
      const targetClient = serverKey ? mcpClients.get(serverKey) : undefined;

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
      let mcpToolResult: any = null;
      let lastToolError: any = null;

      while (attempt < TOTAL_MCP_TOOL_ATTEMPTS && !success) {
        attempt++;
        try {
          console.log(
            `  [MCP Tool Attempt ${attempt}/${TOTAL_MCP_TOOL_ATTEMPTS}] Calling tool "${toolName}"...`
          );
          mcpToolResult = await targetClient.callTool({
            name: toolName,
            arguments: toolArgs as { [x: string]: unknown } | undefined,
          });
          console.log(
            `  [MCP Tool Attempt ${attempt}] SUCCESS for tool "${toolName}". Raw Response:`,
            mcpToolResult
          );
          success = true;
        } catch (toolError: any) {
          lastToolError = toolError;
          console.warn(
            `  [MCP Tool Attempt ${attempt}/${TOTAL_MCP_TOOL_ATTEMPTS}] FAILED for tool "${toolName}". Error:`,
            toolError.message || toolError
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
        let responseContent: any =
          "Tool executed successfully but produced no specific content.";
        try {
          if (typeof mcpToolResult.content === "string") {
            responseContent = mcpToolResult.content;
          } else if (
            Array.isArray(mcpToolResult.content) &&
            mcpToolResult.content.length > 0
          ) {
            const texts = mcpToolResult.content
              .map((part: any) =>
                part && typeof part.text === "string" ? part.text : null
              )
              .filter((text: string | null): text is string => text !== null);
            responseContent =
              texts.length > 0
                ? texts.join("\n")
                : JSON.stringify(mcpToolResult.content);
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
            responseContent = `Error: Could not process/stringify tool response. Type: ${typeof mcpToolResult.content}`;
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
                lastToolError?.message || "Unknown error"
              }`,
            },
          },
        });
      }
    })
  );
  return functionResponses;
}

// Helper function to extract final text answer
function extractFinalAnswerFromResponse(
  response: GenerateContentResponse | undefined
): string {
  let finalAnswer =
    "Sorry, I encountered an issue and could not generate a final response."; // Default message
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
      finalAnswer =
        "Processing complete, but no direct textual response was generated.";
      console.log(
        "Gemini finished, but no final text part was generated by the model."
      );
    } else {
      finalAnswer = `Processing stopped. Reason: ${
        response.candidates[0].finishReason || "Unknown"
      }`;
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
      "Sorry, there was a problem communicating with the AI model (no response received).";
    console.error(
      "No response object available after chat completion attempts."
    );
  }
  return finalAnswer;
}

export const chatWithLLM = async (req: any, res: any) => {
  const {
    message: userMessage,
    history: requestHistory,
    model: modelName,
  } = req.body;

  if (!userMessage)
    return res.status(400).json({ error: "Message is required" });
  if (!modelName)
    return res.status(400).json({ error: "Model name ('model') is required" });

  let currentTurnUserMessage = userMessage; // The message to process in the current turn

  try {
    const serverConfigs = getServerConfigs();
    if (
      !serverConfigs ||
      !serverConfigs.GEMINI_API_KEYS ||
      serverConfigs.GEMINI_API_KEYS.length === 0
    ) {
      console.error(
        "GEMINI_API_KEYS not configured, empty, or config file missing/invalid."
      );
      return res
        .status(503)
        .json({ error: "Server LLM API keys not configured." });
    }
    const apiKeys: string[] = serverConfigs.GEMINI_API_KEYS;

    const { allGeminiTools, mcpClients, toolToServerMap } =
      await connectToMcpServers();
    console.log(
      "Tools configured for Gemini:",
      allGeminiTools.map((t) => t.name)
    );
    if (mcpClients.size === 0 && allGeminiTools.length > 0) {
      console.warn("Warning: Tools defined but no MCP Servers are connected.");
      return res.status(503).json({
        error: "Tools require MCP Servers, but none are connected.",
        toolNames: allGeminiTools.map((t) => t.name),
      });
    }

    let currentConversationHistory: Content[] = (requestHistory ||
      []) as Content[];
    let finalAnswer: string | undefined;
    let finalHistoryForResponse: Content[] | undefined;
    let turnSuccessful = false;
    let lastErrorFromKeyCycle: any = null;

    for (let apiKeyIndex = 0; apiKeyIndex < apiKeys.length; apiKeyIndex++) {
      const currentApiKey = apiKeys[apiKeyIndex];
      console.log(
        `[Key Cycle] Attempting turn with API Key #${apiKeyIndex + 1}/${
          apiKeys.length
        }.`
      );

      let chat: ChatSession;
      let genAI: GoogleGenerativeAI;
      let geminiModel: GenerativeModel;

      try {
        genAI = new GoogleGenerativeAI(currentApiKey);
        geminiModel = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: GEMINI_SYSTEM_INSTRUCTION, // Use the imported system instruction
        });

        // Start chat with history *before* the current user message/tool responses
        chat = geminiModel.startChat({
          history: currentConversationHistory,
          tools:
            allGeminiTools.length > 0
              ? [{ functionDeclarations: allGeminiTools }]
              : undefined,
        });

        // --- Send Initial User Message for this turn ---
        console.log(
          `[Key Cycle - Key #${
            apiKeyIndex + 1
          }] Sending message to Gemini: "${currentTurnUserMessage.substring(
            0,
            50
          )}..."`
        );
        let result = await sendMessageWithRetry(
          chat,
          currentTurnUserMessage,
          "user message for turn"
        );
        let response = result.response;

        // --- Handle Function Calls (Tool Use) ---
        let toolLoopCount = 0;
        const MAX_TOOL_LOOPS = 5; // Safety break for tool call loops

        while (toolLoopCount < MAX_TOOL_LOOPS) {
          toolLoopCount++;
          const functionCalls = response?.candidates?.[0]?.content?.parts
            ?.filter((part: Part) => !!part.functionCall)
            .map((part: Part) => part.functionCall as FunctionCall);

          if (!functionCalls || functionCalls.length === 0) {
            break; // No more function calls from LLM
          }

          console.log(
            `[Key Cycle - Key #${apiKeyIndex + 1}] Gemini requested ${
              functionCalls.length
            } tool call(s). Tool Loop ${toolLoopCount}`
          );
          const toolResponses: Part[] = await processFunctionCalls(
            functionCalls,
            toolToServerMap,
            mcpClients
          );

          console.log(
            `[Key Cycle - Key #${apiKeyIndex + 1}] Sending ${
              toolResponses.length
            } tool responses back. Tool Loop ${toolLoopCount}`
          );
          result = await sendMessageWithRetry(
            chat,
            toolResponses,
            `tool responses (loop ${toolLoopCount})`
          );
          response = result.response;
        }
        if (toolLoopCount >= MAX_TOOL_LOOPS) {
          console.warn(
            `[Key Cycle - Key #${
              apiKeyIndex + 1
            }] Max tool loops (${MAX_TOOL_LOOPS}) reached.`
          );
        }

        // --- Extract Final Text Answer for this turn ---
        finalAnswer = extractFinalAnswerFromResponse(response);
        finalHistoryForResponse = await chat.getHistory(); // Get history from THIS successful session
        turnSuccessful = true;
        console.log(
          `[Key Cycle] Successfully completed turn with API Key #${
            apiKeyIndex + 1
          }.`
        );
        break; // Exit API key loop on success
      } catch (error: any) {
        lastErrorFromKeyCycle = error; // Store the last error for potential final reporting
        const errorMessage = error.message || String(error);
        const httpStatus = error.status || (error.cause as any)?.status;

        console.warn(
          `[Key Cycle - Key #${apiKeyIndex + 1}] Error. Status: ${
            httpStatus || "N/A"
          }, Message: ${errorMessage}`
        );

        const is429Error =
          errorMessage.includes("429") ||
          httpStatus === 429 ||
          errorMessage.toLowerCase().includes("quota");
        const is500Error = errorMessage.includes("500") || httpStatus === 500;
        // Potentially add other specific error messages that indicate an invalid/disabled key
        const isApiKeyInvalidError =
          errorMessage.toLowerCase().includes("api key not valid") ||
          errorMessage.toLowerCase().includes("permission denied") ||
          errorMessage.toLowerCase().includes("api_key_invalid"); // Common patterns

        if (
          (is429Error || is500Error || isApiKeyInvalidError) &&
          apiKeyIndex < apiKeys.length - 1
        ) {
          console.log(
            `  Switching to next API key. Delaying ${GEMINI_API_RETRY_DELAY_MS}ms...`
          );
          // The currentConversationHistory is already correct for retrying the turn.
          // currentTurnUserMessage is also set for the turn.
          await delay(GEMINI_API_RETRY_DELAY_MS);
          // Continue to the next iteration of the for loop (next API key)
        } else {
          // Error is not key-switchable (e.g., bad request 400 not related to key, or other unhandled error)
          // OR it's the last API key that failed.
          console.error(
            `[Key Cycle] Unrecoverable error with Key #${
              apiKeyIndex + 1
            }, or all API keys tried. Error will be re-thrown.`
          );
          throw error; // This error will be caught by the outermost try-catch
        }
      }
    } // End of API Key cycling loop

    if (turnSuccessful && finalAnswer !== undefined) {
      console.log("Final Gemini response being sent to user:", finalAnswer);
      await logChatInteraction(modelName, userMessage, finalAnswer); // Log with original user message
      res.json({ reply: finalAnswer, history: finalHistoryForResponse });
    } else {
      // This block is reached if all API keys failed for a switchable error,
      // or if an unrecoverable error was thrown from the loop and not caught (which it should be by outer try-catch).
      const eMsg =
        lastErrorFromKeyCycle?.message ||
        "Unknown error after trying all API keys.";
      console.error(
        `All API keys failed or no successful response generated. Last error: ${eMsg}`
      );
      await logChatInteraction(
        modelName,
        userMessage, // Log with original user message
        `Error after trying all API keys: ${eMsg}`
      );
      res.status(503).json({
        error: `Failed to process request with Gemini after trying all available API keys. Last error: ${eMsg}`,
      });
    }
  } catch (err: any) {
    // Outermost catch for unhandled errors from the key-loop or other setup issues
    console.error("Overall error in chatWithLLM handler:", err.stack || err);
    const errorMessageToLog = `Overall error in chatWithLLM: ${
      err.message || "Unknown server error"
    }`;
    await logChatInteraction(
      modelName || "unknown_model_on_error",
      userMessage || "unknown_query_on_error", // userMessage should be defined from req.body
      errorMessageToLog
    );
    res.status(500).json({
      error: `Critical server error in chat handler: ${
        err.message || "Unknown server error"
      }`,
    });
  }
};
