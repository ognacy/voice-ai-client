"use client";

import { useEffect, useRef, useState } from "react";

interface TextMessage {
  id: number;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
}

interface TextTranscriptProps {
  messages: TextMessage[];
  onSendMessage: (message: string) => void;
  isConnected: boolean;
}

export const TextTranscript = ({
  messages,
  onSendMessage,
  isConnected,
}: TextTranscriptProps) => {
  const [inputValue, setInputValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && isConnected) {
      onSendMessage(inputValue);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="text-transcript-container">
      <div className="section-header">{"// TEXT TRANSCRIPT"}</div>
      <div className="text-transcript-messages" ref={containerRef}>
        {messages.length === 0 ? (
          <div className="terminal-line">
            <span className="content" style={{ opacity: 0.5 }}>
              {">"} Text chat ready. Type a message below...
            </span>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="terminal-line">
              <span className={`label ${msg.role === "bot" ? "bot" : "user"}`}>
                {msg.role === "bot" ? "bot" : "user"}:
              </span>{" "}
              <span className="content">{msg.content}</span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="text-input-form">
        <span className="input-prompt">{">"}</span>
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-input"
            placeholder={isConnected ? "Type your message..." : "Connecting..."}
            disabled={!isConnected}
          />
          {inputValue === "" && isConnected && (
            <span className="input-cursor" />
          )}
        </div>
      </form>
    </div>
  );
};
