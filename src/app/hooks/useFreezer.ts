"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface FreezerItem {
  code: string;
  description: string;
  added_at: string;
}

interface DeletedItem {
  item: FreezerItem;
  timestamp: number;
}

interface UseFreezerReturn {
  items: FreezerItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createItem: (code: string, description: string) => Promise<void>;
  updateItem: (code: string, updates: { description?: string; added_at?: string }) => Promise<void>;
  deleteItem: (code: string) => Promise<void>;
  undoDelete: () => Promise<void>;
  canUndo: boolean;
}

export const useFreezer = (): UseFreezerReturn => {
  const [items, setItems] = useState<FreezerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<DeletedItem | null>(null);
  const initialLoadDone = useRef(false);

  // Fetch all items from API
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/freezer");
      if (!response.ok) {
        throw new Error("Failed to fetch freezer items");
      }
      const data = await response.json();
      const itemList = Array.isArray(data) ? data : (data.items || []);
      setItems(itemList);
    } catch (err) {
      console.error("Failed to fetch freezer items:", err);
      setError("Failed to load freezer items");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchItems();
    }
  }, [fetchItems]);

  // SSE listener for real-time updates
  useEffect(() => {
    const sseUrl = "/api/events";
    const es = new EventSource(sseUrl);

    es.addEventListener("freezer_item_created", (e) => {
      try {
        const data = JSON.parse(e.data);
        // Only add if not already present (avoids duplicates)
        setItems((prev) => {
          if (prev.some((item) => item.code === data.code)) {
            return prev;
          }
          return [...prev, data];
        });
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("freezer_item_updated", (e) => {
      try {
        const data = JSON.parse(e.data);
        setItems((prev) =>
          prev.map((item) => (item.code === data.code ? { ...item, ...data } : item))
        );
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("freezer_item_deleted", (e) => {
      try {
        const data = JSON.parse(e.data);
        setItems((prev) => prev.filter((item) => item.code !== data.code));
      } catch {
        // Ignore parse errors
      }
    });

    return () => {
      es.close();
    };
  }, []);

  // Clear undo after 30 seconds
  useEffect(() => {
    if (!lastDeleted) return;

    const timeout = setTimeout(() => {
      setLastDeleted(null);
    }, 30000);

    return () => clearTimeout(timeout);
  }, [lastDeleted]);

  // Create a new item
  const createItem = useCallback(async (code: string, description: string) => {
    const response = await fetch("/api/freezer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, description }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to create freezer item");
    }

    // SSE event will add it to state
    await response.json();
  }, []);

  // Update an item (partial update)
  const updateItem = useCallback(async (code: string, updates: { description?: string; added_at?: string }) => {
    const response = await fetch(`/api/freezer?code=${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update freezer item");
    }

    const updatedItem = await response.json();
    setItems((prev) =>
      prev.map((item) => (item.code === code ? { ...item, ...updatedItem } : item))
    );
  }, []);

  // Delete an item
  const deleteItem = useCallback(async (code: string) => {
    // Store the item before deleting for undo
    const itemToDelete = items.find((item) => item.code === code);

    const response = await fetch(`/api/freezer?code=${encodeURIComponent(code)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete freezer item");
    }

    // Store for undo
    if (itemToDelete) {
      setLastDeleted({ item: itemToDelete, timestamp: Date.now() });
    }

    setItems((prev) => prev.filter((item) => item.code !== code));
  }, [items]);

  // Undo last delete
  const undoDelete = useCallback(async () => {
    if (!lastDeleted) return;

    try {
      await createItem(lastDeleted.item.code, lastDeleted.item.description);
      setLastDeleted(null);
    } catch (err) {
      console.error("Failed to undo delete:", err);
      throw err;
    }
  }, [lastDeleted, createItem]);

  return {
    items,
    isLoading,
    error,
    refresh: fetchItems,
    createItem,
    updateItem,
    deleteItem,
    undoDelete,
    canUndo: lastDeleted !== null,
  };
};
