"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface Memory {
  id: string;
  item: string;
  location: string;
  timestamp: string; // ISO string from server
  created_at?: string;
  updated_at?: string;
}

interface UseMemoriesReturn {
  memories: Memory[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createMemory: (item: string, location: string) => Promise<void>;
  updateMemory: (id: string, updates: { item?: string; location?: string }) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
}

export const useMemories = (): UseMemoriesReturn => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Fetch all memories from API
  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/memories");
      if (!response.ok) {
        throw new Error("Failed to fetch memories");
      }
      const data = await response.json();
      // Handle both array response and object with memories property
      const memoriesList = Array.isArray(data) ? data : (data.memories || []);
      setMemories(memoriesList);
    } catch (err) {
      console.error("Failed to fetch memories:", err);
      setError("Failed to load memories");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchMemories();
    }
  }, [fetchMemories]);

  // SSE listener for real-time updates from other clients
  useEffect(() => {
    const sseUrl = process.env.NEXT_PUBLIC_SSE_URL || "http://localhost:8765/events";
    const es = new EventSource(sseUrl);

    es.addEventListener("memory_created", (e) => {
      try {
        const data = JSON.parse(e.data);
        // Only add if not already present (avoids duplicates from local creates)
        setMemories((prev) => {
          if (prev.some((m) => m.id === data.id)) {
            return prev;
          }
          return [...prev, data];
        });
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("memory_updated", (e) => {
      try {
        const data = JSON.parse(e.data);
        setMemories((prev) =>
          prev.map((m) => (m.id === data.id ? { ...m, ...data } : m))
        );
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("memory_deleted", (e) => {
      try {
        const data = JSON.parse(e.data);
        setMemories((prev) => prev.filter((m) => m.id !== data.id));
      } catch {
        // Ignore parse errors
      }
    });

    return () => {
      es.close();
    };
  }, []);

  // Create a new memory (SSE will add it to state)
  const createMemory = useCallback(async (item: string, location: string) => {
    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, location }),
      });

      if (!response.ok) {
        throw new Error("Failed to create memory");
      }

      // Don't add locally - SSE memory_created event will add it
      await response.json();
    } catch (err) {
      console.error("Failed to create memory:", err);
      throw err;
    }
  }, []);

  // Update a memory
  const updateMemory = useCallback(
    async (id: string, updates: { item?: string; location?: string }) => {
      try {
        const response = await fetch(`/api/memories?id=${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error("Failed to update memory");
        }

        const updatedMemory = await response.json();
        setMemories((prev) =>
          prev.map((m) => (m.id === id ? { ...m, ...updatedMemory } : m))
        );
      } catch (err) {
        console.error("Failed to update memory:", err);
        throw err;
      }
    },
    []
  );

  // Delete a memory
  const deleteMemory = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/memories?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete memory");
      }

      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete memory:", err);
      throw err;
    }
  }, []);

  return {
    memories,
    isLoading,
    error,
    refresh: fetchMemories,
    createMemory,
    updateMemory,
    deleteMemory,
  };
};
