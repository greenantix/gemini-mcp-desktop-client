import { Box } from "@mui/material";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { useState, useRef, useEffect } from "react";
import { get, post } from "../../utils/api_helper/api_helper"; // Adjust path if needed
import { useNavigate } from "react-router-dom";
import { ChatMessage } from "./types/types"; // Adjust path if needed
import ChatHistorySidebar, { ChatHistory } from "./ChatHistorySidebar";
import { v4 as uuidv4 } from "uuid";

export default function ChatPage() {
  const [selectedModel, setSelectedModel] = useState("gemini-1.5-flash");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container
  const navigate = useNavigate();

  const toggleDrawer = () => {
    setDrawerOpen((prev) => !prev);
  };

  // --- Existing checkServerConfig function ---
  async function checkServerConfig() {
    // Keep your existing logic, maybe add better loading/error states later
    try {
      // Simulate loading check if needed for testing UI
      // setIsLoading(true);
      // await new Promise(resolve => setTimeout(resolve, 1000));
      const serverConfig = await get("/api/server-config");
      if (!serverConfig?.GEMINI_API_KEYS?.length) {
        setIsLoading(false);
        navigate("/server-config");
      }
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
      console.log(e);
      // Optionally navigate or show an error message
    }
  }
  useEffect(() => {
    checkServerConfig();
    // Add some initial placeholder messages for design preview if desired
    // setMessages([
    //   { role: 'user', parts: [{ text: 'Hello Gemini!' }] },
    //   { role: 'model', parts: [{ text: 'Hi there! How can I help you today?' }] },
    //   { role: 'user', parts: [{ text: 'Can you explain React Hooks?' }] },
    //   { role: 'model', parts: [{ text: "Certainly! React Hooks are functions that let you “hook into” React state and lifecycle features from function components..." }] },
    // ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Improved scrollToBottom ---
  const scrollToBottom = () => {
    // Scroll the container, not just the dummy div
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop =
        listContainerRef.current.scrollHeight;
    }
    // The dummy div approach is also fine, but scrolling the container is more direct
    // messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Use timeout to ensure DOM has updated after message state change
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100); // Small delay
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    const stored = localStorage.getItem("chatHistories");
    if (stored) {
      setChatHistories(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (!currentChatId || messages.length === 0) return;

    const updatedHistories = [...chatHistories];
    const idx = updatedHistories.findIndex((chat) => chat.id === currentChatId);

    const firstUserMessage = messages.find((m) => m.role === "user")?.parts[0]
      ?.text;
    const newTitle = firstUserMessage?.slice(0, 25) || "New Chat";

    if (idx >= 0) {
      updatedHistories[idx].messages = messages;
      updatedHistories[idx].title = newTitle;
    } else {
      updatedHistories.push({
        id: currentChatId,
        title: newTitle,
        messages,
        createdAt: new Date().toISOString(),
      });
    }

    setChatHistories(updatedHistories);
    localStorage.setItem("chatHistories", JSON.stringify(updatedHistories));
  }, [messages]);

  const startNewChat = () => {
    setCurrentChatId(uuidv4());
    setMessages([]);
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
  // --- Existing sendMessage function (no changes needed here) ---
  const sendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault(); // Make event optional for direct calls
    if (!inputValue.trim() || isLoading) return;

    if (!currentChatId) {
      const newId = uuidv4();
      setCurrentChatId(newId);
    }

    const newUserMessage: ChatMessage = {
      role: "user",
      parts: [{ text: inputValue.trim() }],
    };

    setMessages((prev) => [...prev, newUserMessage]);
    const currentInput = inputValue; // Store input before clearing
    setInputValue("");
    setIsLoading(true);

    try {
      const historyForBackend = messages.filter(
        (m) => m.role === "user" || m.role === "model"
      );

      const data = await post("/api/chat", {
        message: currentInput.trim(), // Use stored input
        history: historyForBackend,
        model: selectedModel,
      });

      if (data?.reply) {
        const assistantMessage: ChatMessage = {
          role: "model",
          parts: [{ text: data.reply }],
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            parts: [{ text: "No reply from assistant." }],
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          parts: [
            {
              text: `Error: ${
                err?.response?.data?.error || "Failed to fetch response."
              }`,
            },
          ],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default", // Use theme background color
        overflow: "hidden", // Prevent body scroll
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
        <ChatHeader onMenuClick={toggleDrawer} />
        {/* Message List Area */}
        <Box
          ref={listContainerRef} // Add ref here
          sx={{
            flexGrow: 1,
            overflowY: "auto", // Enable scrolling within this Box
            p: { xs: 1, sm: 2, md: 3 }, // Responsive padding
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MessageList
            messages={messages}
            isLoading={isLoading} // Pass loading state
            messagesEndRef={messagesEndRef} // Still needed for potential focus/marker
          />
          {/* Invisible div to ensure scroll target is always at the bottom */}
          <div ref={messagesEndRef} style={{ height: "1px" }} />
        </Box>

        {/* Input Area */}
        <Box
          sx={{
            p: { xs: 1, sm: 2 },
            // borderTop: 1, // Use divider color from theme
            // borderColor: 'divider',
            bgcolor: "background.paper", // Use paper color for input area background
            boxShadow: "0 -2px 5px rgba(0,0,0,0.05)", // Subtle shadow separating input
          }}
        >
          <MessageInput
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleSubmit={sendMessage}
            isLoading={isLoading}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
          />
        </Box>
      </Box>
    </Box>
  );
}
