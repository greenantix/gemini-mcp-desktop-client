// ChatPage.tsx

// ... (imports and other code remain the same) ...
import { Box } from "@mui/material";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { useState, useRef, useEffect } from "react";
// No need for `post` from api_helper if using fetch directly for this
import { get } from "../../utils/api_helper/api_helper";
import { useNavigate } from "react-router-dom";
import { ChatMessage, FileAttachment, ChatHistory } from "./types/types";
import ChatHistorySidebar from "./ChatHistorySidebar";
import { v4 as uuidv4 } from "uuid";
import LinuxHelper from "../../components/LinuxHelper";


export default function ChatPage() {
  const [selectedModel, setSelectedModel] = useState("gemini-1.5-flash");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // inputValue is managed by MessageInput, ChatPage doesn't need to hold it unless for specific reset scenarios
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const handleMessageSubmitRef = useRef<any>(null);
  const navigate = useNavigate();

  const toggleDrawer = () => {
    setDrawerOpen((prev) => !prev);
  };

  async function checkServerConfig() {
    try {
      const serverConfig = await get("/api/server-config");
      if (!serverConfig?.GEMINI_API_KEY) {
        setIsLoading(false);
        navigate("/server-config");
      }
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
      console.log(e);
    }
  }

  useEffect(() => {
    checkServerConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const scrollToBottom = () => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight;
    }
  };


  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    const stored = localStorage.getItem("chatHistories");
    if (stored) {
      try {
        setChatHistories(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to parse chat histories from localStorage", error);
        localStorage.removeItem("chatHistories");
      }
    }
  }, []);

 useEffect(() => {
    if (!currentChatId) return;

    const currentChat = chatHistories.find((chat) => chat.id === currentChatId);

    if (messages.length > 0 || (currentChat && currentChat.messages.length !== messages.length)) {
        const updatedHistories = [...chatHistories];
        const idx = updatedHistories.findIndex((chat) => chat.id === currentChatId);

        const firstUserMessage = messages.find((m) => m.role === "user");
        let newTitle = "New Chat";

        if (firstUserMessage) {
            if (firstUserMessage.parts.length > 0 && firstUserMessage.parts[0].text) {
                newTitle = firstUserMessage.parts[0].text.slice(0, 30) + (firstUserMessage.parts[0].text.length > 30 ? "..." : "");
            } else if (firstUserMessage.files && firstUserMessage.files.length > 0) {
                const firstFileName = firstUserMessage.files[0].name;
                newTitle = firstFileName.slice(0, 25) + (firstFileName.length > 25 || firstUserMessage.files.length > 1 ? "..." : "");
                if (firstUserMessage.files.length > 1) newTitle += ` & more`;
            }
             // If both text and files, prioritize text or combine
            if (firstUserMessage.parts.length > 0 && firstUserMessage.parts[0].text && firstUserMessage.files && firstUserMessage.files.length > 0) {
                const textPart = firstUserMessage.parts[0].text;
                newTitle = textPart.slice(0, 15) + (textPart.length > 15 ? "..." : "") + " (+files)";
            }
        }


        if (idx >= 0) {
            updatedHistories[idx].messages = messages;
            if (updatedHistories[idx].title === "New Chat" || (messages.length > 0 && messages.indexOf(firstUserMessage!) === 0) ) {
                 if (newTitle !== "New Chat") updatedHistories[idx].title = newTitle;
            }
        } else if (messages.length > 0) {
            updatedHistories.push({
                id: currentChatId,
                title: newTitle,
                messages,
                createdAt: new Date().toISOString(),
            });
        } else {
            return;
        }

        setChatHistories(updatedHistories);
        localStorage.setItem("chatHistories", JSON.stringify(updatedHistories));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentChatId]);


  const startNewChat = () => {
    const newId = uuidv4();
    setCurrentChatId(newId);
    setMessages([]);
    // Input value is managed by MessageInput, no need to set it here
    setDrawerOpen(false);
  };

  const loadChat = (id: string) => {
    const chat = chatHistories.find((c) => c.id === id);
    if (chat) {
      setCurrentChatId(id);
      setMessages(chat.messages);
      setDrawerOpen(false);
    }
  };

  // Handle messages from Linux Helper (F10 screenshots)
  const handleLinuxHelperMessage = async (
    message: string,
    screenshot?: string,
    screenshotMeta?: { filename: string; size: number }
  ) => {
    // Create F10 analysis message as assistant response (not user message)
    const newMessage: ChatMessage = {
      id: uuidv4(),
      role: "model", // Show as assistant response, not user message
      parts: [{ text: message }],
      timestamp: new Date().toISOString(),
      files: screenshot ? [{
        name: screenshotMeta?.filename || "screenshot.png",
        type: "image/png", 
        size: screenshotMeta?.size || 0,
        url: screenshot,
        content: screenshot
      }] : undefined
    };

    // Add to chat without triggering another AI response
    setMessages(prev => [...prev, newMessage]);
    scrollToBottom();
  };

  const handleMessageSubmit = async (
    text: string,
    files: File[],
    webSearch?: boolean
  ) => {
    // Store the latest version in ref for IPC handlers
    handleMessageSubmitRef.current = handleMessageSubmit;
    const trimmedText = text.trim();
    if (!trimmedText && files.length === 0) return;

    let newChatId = currentChatId;
    if (!newChatId) {
      newChatId = uuidv4();
      setCurrentChatId(newChatId);
      setChatHistories(prev => {
        if (newChatId === null) {
          // Or however you want to handle the null case for finding
          return prev;
        }
        if (!prev.find(ch => ch.id === newChatId)) {
          return [
            ...prev,
            {
              id: newChatId as string, // You're telling TypeScript "I know this is a string"
              title: "New Chat",
              messages: [],
              createdAt: new Date().toISOString()
            }
          ];
        }
        return prev;
      });
    }

    const userMessageFiles: FileAttachment[] = files.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    }));

    const newUserMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      parts: trimmedText ? [{ text: trimmedText }] : [],
      files: userMessageFiles.length > 0 ? userMessageFiles : undefined,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const historyForBackend = messages
        .filter((m) => m.role === "user" || m.role === "model")
        .map(msg => ({
            role: msg.role,
            parts: msg.parts,
            // files: msg.files // Only send file metadata if your API needs it in history
        }));

      const formData = new FormData();
      // Append text message if present
      if (trimmedText) {
        formData.append('message', trimmedText);
      }
      // Append other metadata
      formData.append('history', JSON.stringify(historyForBackend));
      formData.append('model', selectedModel);
      if (webSearch) {
        formData.append('webSearch', 'true');
      }
      // Append files
      files.forEach((file) => {
        formData.append('files', file, file.name); // 'files' is the field name for the array of files
      });

      console.log("--- Sending to API via fetch ---");
      // Log FormData entries (cannot directly log FormData like an object)
      for (let pair of formData.entries()) {
        if (pair[1] instanceof File) {
            console.log(`${pair[0]}: ${pair[1].name} (type: ${pair[1].type}, size: ${pair[1].size})`);
        } else {
            console.log(`${pair[0]}: ${pair[1]}`);
        }
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, { // Ensure this matches your API route
        method: 'POST',
        body: formData,
        // Headers are not explicitly set for 'Content-Type' with FormData;
        // the browser sets it to 'multipart/form-data' with the correct boundary.
        // Add other headers if needed (e.g., Authorization)
        // headers: { 'Authorization': 'Bearer YOUR_TOKEN_HERE' }
      });

      if (!response.ok) {
        // Try to get error message from response body
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { error: await response.text() || `HTTP error! status: ${response.status}` };
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data?.reply) {
        const assistantMessage: ChatMessage = {
          id: uuidv4(),
          role: "model",
          parts: [{ text: data.reply }],
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: "system",
            parts: [{ text: "No reply from assistant." }],
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      console.error("Error sending message:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "system",
          parts: [
            {
              text: `Error: ${err.message || "Failed to fetch response."}`,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for screenshot analysis requests from Linux Helper (must be after handleMessageSubmit definition)
  useEffect(() => {
    console.log('🎯 Setting up IPC listener for screenshot analysis');
    console.log('🔍 Window object available:', typeof window !== 'undefined');
    console.log('🔍 Electron object:', typeof window.electron);
    console.log('🔍 IpcRenderer object:', typeof window.electron?.ipcRenderer);
    console.log('🔍 Available window properties:', Object.keys(window).filter(k => k.includes('electron') || k.includes('ipc') || k.includes('api')));
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      const handleAnalyzeScreenshot = (screenshotDataUrl: string) => {
        console.log('📸 Received screenshot for analysis, data length:', screenshotDataUrl?.length);
        try {
          // Create a file from the base64 data
          const byteCharacters = atob(screenshotDataUrl.split(',')[1]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const file = new File([byteArray], 'screenshot.png', { type: 'image/png' });
          
          console.log('🚀 Sending screenshot for analysis via handleMessageSubmit');
          // Send screenshot for analysis
          if (handleMessageSubmitRef.current) {
            handleMessageSubmitRef.current('Please analyze this screenshot and tell me what you see.', [file]);
          }
        } catch (error) {
          console.error('❌ Error processing screenshot:', error);
        }
      };
      
      console.log('📡 Registering IPC listener for analyze-screenshot');
      window.ipcRenderer.on('analyze-screenshot', handleAnalyzeScreenshot);
      
      return () => {
        console.log('🧹 Cleaning up IPC listener');
        window.ipcRenderer.removeListener('analyze-screenshot', handleAnalyzeScreenshot);
      };
    } else {
      console.warn('⚠️ Electron IPC not available for screenshot analysis');
    }
  }, []); // Empty dependency array - set up listener only once

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      <ChatHistorySidebar
        drawerOpen={drawerOpen}
        toggleDrawer={toggleDrawer}
        chatHistories={chatHistories}
        loadChat={loadChat}
        startNewChat={startNewChat}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ChatHeader
          onMenuClick={toggleDrawer}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
        />
        <Box
          ref={listContainerRef}
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            p: { xs: 1, sm: 2, md: 3 },
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MessageList
            messages={messages}
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
          />
          <div ref={messagesEndRef} style={{ height: "1px" }} />
        </Box>
        <Box
          sx={{
            p: { xs: 1, sm: 2 },
            bgcolor: "background.paper",
            boxShadow: "0 -2px 5px rgba(0,0,0,0.05)",
          }}
        >
          <MessageInput
            onMessageSubmit={handleMessageSubmit}
            isLoading={isLoading}
          />
        </Box>
      </Box>
      
      {/* Linux Helper Component */}
      <LinuxHelper onSendToChat={handleLinuxHelperMessage} />
    </Box>
  );
}