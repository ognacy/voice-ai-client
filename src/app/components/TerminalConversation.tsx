"use client";

import { useEffect, useRef } from "react";
import { useConversation } from "@pipecat-ai/voice-ui-kit";

export const TerminalConversation = () => {
  const { messages } = useConversation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  // Filter to only show user and assistant messages
  const textMessages = messages.filter(
    (msg) => msg.role === "user" || msg.role === "assistant"
  );

  // Extract text content from message parts
  const getMessageText = (msg: typeof messages[0]) => {
    return msg.parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("");
  };

  return (
    <div className="terminal-window h-full">
      <div className="section-header">{"// VOICE TRANSCRIPT"}</div>
      <div className="terminal-content" ref={containerRef}>
      {textMessages.length === 0 ? (
        <div className="terminal-line">
          <span className="content" style={{ opacity: 0.5 }}>
            {">"} Awaiting connection...
          </span>
          <span className="cursor-blink"></span>
        </div>
      ) : (
        textMessages.map((msg, index) => {
          const text = getMessageText(msg);
          if (!text.trim()) return null;
          return (
            <div key={index} className="terminal-line">
              <span className={`label ${msg.role === "assistant" ? "bot" : "user"}`}>
                {msg.role === "assistant" ? "bot" : "user"}:
              </span>{" "}
              <span className="content">{text}</span>
            </div>
          );
        })
      )}
      </div>
    </div>
  );
};
