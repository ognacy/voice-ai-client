"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type StockLevel = "out_of_stock" | "running_low" | "sufficient";

export interface Stock {
  id: string;
  item: string;
  quantity: string;
  stock_level: StockLevel;
  timestamp: string;
}

interface UseStockReturn {
  stock: Stock[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createStock: (item: string, quantity: string, stockLevel: StockLevel) => Promise<void>;
  updateStock: (id: string, updates: { item?: string; quantity?: string; stock_level?: StockLevel }) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
}

export const useStock = (): UseStockReturn => {
  const [stock, setStock] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Fetch all stock from API
  const fetchStock = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stock");
      if (!response.ok) {
        throw new Error("Failed to fetch stock");
      }
      const data = await response.json();
      // Handle both array response and object with stock property
      const stockList = Array.isArray(data) ? data : (data.stock || []);
      setStock(stockList);
    } catch (err) {
      console.error("Failed to fetch stock:", err);
      setError("Failed to load stock");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchStock();
    }
  }, [fetchStock]);

  // SSE listener for real-time updates
  useEffect(() => {
    // Use proxied SSE endpoint to work in remote/Tailscale environments
    const sseUrl = "/api/events";
    const es = new EventSource(sseUrl);

    es.addEventListener("stock_created", (e) => {
      try {
        const data = JSON.parse(e.data);
        // Only add if not already present (avoids duplicates)
        setStock((prev) => {
          if (prev.some((s) => s.id === data.id)) {
            return prev;
          }
          return [...prev, data];
        });
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("stock_updated", (e) => {
      try {
        const data = JSON.parse(e.data);
        setStock((prev) =>
          prev.map((s) => (s.id === data.id ? { ...s, ...data } : s))
        );
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("stock_deleted", (e) => {
      try {
        const data = JSON.parse(e.data);
        setStock((prev) => prev.filter((s) => s.id !== data.id));
      } catch {
        // Ignore parse errors
      }
    });

    return () => {
      es.close();
    };
  }, []);

  // Create a new stock entry (SSE will add it to state)
  const createStock = useCallback(async (item: string, quantity: string, stockLevel: StockLevel) => {
    try {
      const response = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, quantity, stock_level: stockLevel }),
      });

      if (!response.ok) {
        throw new Error("Failed to create stock entry");
      }

      // Don't add locally - SSE stock_created event will add it
      await response.json();
    } catch (err) {
      console.error("Failed to create stock entry:", err);
      throw err;
    }
  }, []);

  // Update a stock entry
  const updateStock = useCallback(
    async (id: string, updates: { item?: string; quantity?: string; stock_level?: StockLevel }) => {
      try {
        const response = await fetch(`/api/stock?id=${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error("Failed to update stock entry");
        }

        const updatedStock = await response.json();
        setStock((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...updatedStock } : s))
        );
      } catch (err) {
        console.error("Failed to update stock entry:", err);
        throw err;
      }
    },
    []
  );

  // Delete a stock entry
  const deleteStock = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/stock?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete stock entry");
      }

      setStock((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Failed to delete stock entry:", err);
      throw err;
    }
  }, []);

  return {
    stock,
    isLoading,
    error,
    refresh: fetchStock,
    createStock,
    updateStock,
    deleteStock,
  };
};
