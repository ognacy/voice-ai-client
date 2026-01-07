"use client";

import { useEffect, useRef, useState } from "react";

interface SSEEvent {
  id: number;
  timestamp: Date;
  type: string;
  data: Record<string, unknown>;
}

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

    es.addEventListener("connected", (e) => {
      const data = JSON.parse(e.data);
      setEvents((prev) => [
        ...prev,
        {
          id: eventIdRef.current++,
          timestamp: new Date(),
          type: "connected",
          data,
        },
      ]);
    });

    es.addEventListener("turn_counter_updated", (e) => {
      const data = JSON.parse(e.data);
      setEvents((prev) => [
        ...prev,
        {
          id: eventIdRef.current++,
          timestamp: new Date(),
          type: "turn_counter_updated",
          data,
        },
      ]);
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
    if (event.type === "connected") {
      return `session initialized`;
    }
    if (event.type === "turn_counter_updated") {
      const turn = event.data.turn_count ?? event.data.count ?? "?";
      return `turn ${turn}`;
    }
    return JSON.stringify(event.data);
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
