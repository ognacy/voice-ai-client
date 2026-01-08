"use client";

import { useEffect, useRef, useState } from "react";

interface SSEEvent {
  id: number;
  timestamp: Date;
  type: string;
  data: Record<string, unknown>;
}

// All SSE event types we want to display
const SSE_EVENT_TYPES = [
  "connected",
  "turn_counter_updated",
  "client_selected",
  "gating_mode_changed",
  "assistant_listening_started",
  "assistant_listening_stopped",
  "memory_created",
  "memory_updated",
  "memory_deleted",
  "stock_created",
  "stock_updated",
  "stock_deleted",
];

export const TerminalEvents = () => {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const containerRef = useRef<HTMLDivElement>(null);
  const eventIdRef = useRef(0);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  useEffect(() => {
    // Use proxied SSE endpoint to work in remote/Tailscale environments
    const sseUrl = "/api/events";

    setConnectionStatus("connecting");
    const es = new EventSource(sseUrl);

    es.onopen = () => {
      setConnectionStatus("connected");
    };

    es.onerror = () => {
      setConnectionStatus("disconnected");
    };

    // Add listener for each event type
    SSE_EVENT_TYPES.forEach((eventType) => {
      es.addEventListener(eventType, (e) => {
        try {
          const data = JSON.parse(e.data);
          setEvents((prev) => [
            ...prev,
            {
              id: eventIdRef.current++,
              timestamp: new Date(),
              type: eventType,
              data,
            },
          ]);
        } catch {
          // Handle events with no data
          setEvents((prev) => [
            ...prev,
            {
              id: eventIdRef.current++,
              timestamp: new Date(),
              type: eventType,
              data: {},
            },
          ]);
        }
      });
    });

    return () => {
      es.close();
      setConnectionStatus("disconnected");
    };
  }, []);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatEventData = (event: SSEEvent) => {
    switch (event.type) {
      case "connected":
        return "session initialized";
      case "turn_counter_updated": {
        const turn = event.data.turn_count ?? event.data.count ?? "?";
        return `turn ${turn}`;
      }
      case "client_selected":
        return `client: ${event.data.client_id || "unknown"}`;
      case "gating_mode_changed":
        return `mode: ${event.data.mode || "unknown"}`;
      case "assistant_listening_started":
        return "listening ON";
      case "assistant_listening_stopped":
        return "listening OFF";
      case "memory_created":
        return `added: ${event.data.item || "item"} -> ${event.data.location || "location"}`;
      case "memory_updated":
        return `updated: ${event.data.item || "item"}`;
      case "memory_deleted":
        return `removed: ${event.data.id || "item"}`;
      case "stock_created":
        return `added: ${event.data.item || "item"} (${event.data.quantity || "?"})`;
      case "stock_updated":
        return `updated: ${event.data.item || "item"}`;
      case "stock_deleted":
        return `removed: ${event.data.id || "item"}`;
      default:
        return JSON.stringify(event.data);
    }
  };

  return (
    <div className="events-wrapper">
      <div className="section-header">
        {"// EVENTS "}
        <span className={`connection-status ${connectionStatus}`}>
          [{connectionStatus.toUpperCase()}]
        </span>
      </div>
      <div className="events-list" ref={containerRef}>
        {events.length === 0 ? (
          <div className="event-item">
            <span className="event-type">Waiting for events...</span>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="event-item">
              <span className="event-timestamp">
                [{formatTimestamp(event.timestamp)}]
              </span>
              <span className="event-type">{event.type}</span>
              <span className="event-data"> → {formatEventData(event)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
