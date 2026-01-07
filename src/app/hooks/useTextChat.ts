"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Use local API proxy to avoid CORS issues
const API_BASE = "/api/chat";
const STORAGE_KEY = "voice-ai-text-sessions";

interface TextMessage {
  id: number;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
}

interface UseTextChatReturn {
  messages: TextMessage[];
  sessionId: string | null;
  isConnected: boolean;
  sendMessage: (message: string) => Promise<void>;
  resetSession: () => Promise<void>;
}

export const useTextChat = (): UseTextChatReturn => {
  const [messages, setMessages] = useState<TextMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const messageIdRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  // isConnected means we have both SSE and a valid session
  const isConnected = sseConnected && sessionId !== null;

  // Debug: log connection state changes
  useEffect(() => {
    console.log("Text chat state:", { sseConnected, sessionId, isConnected });
  }, [sseConnected, sessionId, isConnected]);

  // Get stored session IDs from localStorage
  const getStoredSessions = (): string[] => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  // Store session ID in localStorage
  const storeSessionId = (id: string) => {
    if (typeof window === "undefined") return;
    try {
      const sessions = getStoredSessions();
      if (!sessions.includes(id)) {
        sessions.push(id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      }
    } catch {
      // Ignore storage errors
    }
  };

  // Close a session via API
  const closeSession = async (id: string): Promise<void> => {
    try {
      await fetch(`${API_BASE}/session/${id}`, {
        method: "DELETE",
      });
    } catch {
      // Ignore errors when closing old sessions
    }
  };

  // Close all previous sessions
  const closePreviousSessions = async (): Promise<void> => {
    const sessions = getStoredSessions();
    await Promise.all(sessions.map((id) => closeSession(id)));
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
  };

  // Create a new session
  const createSession = async (): Promise<string | null> => {
    try {
      const callerId = `web-client-${Date.now()}`;
      const response = await fetch(`${API_BASE}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caller_id: callerId }),
      });

      if (!response.ok) {
        console.warn("Text chat server returned error, will retry...");
        return null;
      }

      const data = await response.json();
      const newSessionId = data.session_id;
      storeSessionId(newSessionId);
      console.log("Text chat session created:", newSessionId);
      return newSessionId;
    } catch {
      // Server not available - this is expected if the backend isn't running
      console.warn("Text chat server not available, will retry...");
      return null;
    }
  };

  // Send a message
  const sendMessage = useCallback(async (message: string): Promise<void> => {
    if (!message.trim()) return;

    if (!sessionId) {
      console.warn("Cannot send message: no active session");
      return;
    }

    // Add user message to the list
    setMessages((prev) => [
      ...prev,
      {
        id: messageIdRef.current++,
        role: "user",
        content: message.trim(),
        timestamp: new Date(),
      },
    ]);

    try {
      await fetch(`${API_BASE}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: message.trim() }),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }, [sessionId]);

  // Reset session
  const resetSession = useCallback(async (): Promise<void> => {
    // Close current session if exists
    if (sessionId) {
      await closeSession(sessionId);
    }

    // Clear messages
    setMessages([]);

    // Create new session
    const newSessionId = await createSession();
    if (newSessionId) {
      setSessionId(newSessionId);
    }
  }, [sessionId]);

  // Initialize: close previous sessions and create new one
  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout;

    const init = async () => {
      console.log("Text chat: initializing...");
      await closePreviousSessions();
      console.log("Text chat: closed previous sessions, creating new one...");
      const newSessionId = await createSession();
      console.log("Text chat: createSession returned:", newSessionId, "mounted:", mounted);
      if (mounted && newSessionId) {
        console.log("Text chat: setting sessionId to", newSessionId);
        setSessionId(newSessionId);
      } else if (mounted) {
        console.log("Text chat: session creation failed, retrying in 5s...");
        retryTimeout = setTimeout(init, 5000);
      }
    };

    init();

    return () => {
      console.log("Text chat: cleanup, setting mounted=false");
      mounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  // Set up SSE listener for bot responses
  useEffect(() => {
    // Use proxied SSE endpoint to work in remote/Tailscale environments
    const sseUrl = "/api/events";

    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log("Text chat: SSE connected");
      setSseConnected(true);
    };

    es.onerror = () => {
      console.log("Text chat: SSE error/disconnected");
      setSseConnected(false);
    };

    es.addEventListener("bot_text_response", (e) => {
      try {
        const data = JSON.parse(e.data);
        // Only add messages for our session
        if (data.session_id === sessionId || !sessionId) {
          setMessages((prev) => [
            ...prev,
            {
              id: messageIdRef.current++,
              role: "bot",
              content: data.response,
              timestamp: new Date(),
            },
          ]);
        }
      } catch {
        // Ignore parse errors
      }
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [sessionId]);

  return {
    messages,
    sessionId,
    isConnected,
    sendMessage,
    resetSession,
  };
};
