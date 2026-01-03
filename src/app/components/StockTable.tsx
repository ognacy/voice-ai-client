"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { Stock, StockLevel } from "../hooks/useStock";
import { RetroModal } from "./RetroModal";

interface StockTableProps {
  stock: Stock[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAddStock: (item: string, quantity: string, stockLevel: StockLevel) => Promise<void>;
  onDeleteStock: (id: string) => Promise<void>;
  onUpdateStock: (id: string, updates: { item?: string; quantity?: string; stock_level?: StockLevel }) => Promise<void>;
}

// Undo operation types
type UndoOperation =
  | { type: "delete"; stock: Stock }
  | { type: "add"; stockId: string }
  | { type: "edit"; stockId: string; field: "item" | "quantity" | "stock_level"; oldValue: string; newValue: string };

// Stock level priority for sorting (lower = more urgent)
const STOCK_LEVEL_PRIORITY: Record<StockLevel, number> = {
  out_of_stock: 0,
  running_low: 1,
  sufficient: 2,
};

// Display labels for stock levels
const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
  out_of_stock: "OUT",
  running_low: "LOW",
  sufficient: "OK",
};

export const StockTable = ({
  stock,
  isLoading,
  error,
  onRefresh,
  onAddStock,
  onDeleteStock,
  onUpdateStock,
}: StockTableProps) => {
  const [filter, setFilter] = useState("");
  const [newStockInput, setNewStockInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"item" | "quantity" | "stock_level" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Undo buffer
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  // Error modal
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId, editingField]);

  // Keyboard shortcut: + to focus add input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "+" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeEl = document.activeElement;
        if (activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA") {
          return;
        }
        e.preventDefault();
        addInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const pushUndo = useCallback((operation: UndoOperation) => {
    setUndoStack((prev) => [...prev, operation]);
  }, []);

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0 || isUndoing) return;

    const operation = undoStack[undoStack.length - 1];
    setIsUndoing(true);

    try {
      switch (operation.type) {
        case "delete":
          await onAddStock(operation.stock.item, operation.stock.quantity, operation.stock.stock_level);
          break;
        case "add":
          await onDeleteStock(operation.stockId);
          break;
        case "edit":
          if (operation.field === "stock_level") {
            await onUpdateStock(operation.stockId, { [operation.field]: operation.oldValue as StockLevel });
          } else {
            await onUpdateStock(operation.stockId, { [operation.field]: operation.oldValue });
          }
          break;
      }
      setUndoStack((prev) => prev.slice(0, -1));
    } catch {
      // Error handling done in hook
    } finally {
      setIsUndoing(false);
    }
  }, [undoStack, isUndoing, onAddStock, onDeleteStock, onUpdateStock]);

  const parseStockInput = (input: string): { item: string; quantity: string; stockLevel: StockLevel } | null => {
    // Format: item / quantity / +|-|0
    const parts = input.split("/").map((p) => p.trim());

    if (parts.length !== 3) {
      return null;
    }

    const [item, quantity, levelCode] = parts;

    if (!item || !quantity || !levelCode) {
      return null;
    }

    let stockLevel: StockLevel;
    switch (levelCode) {
      case "+":
        stockLevel = "sufficient";
        break;
      case "-":
        stockLevel = "running_low";
        break;
      case "0":
        stockLevel = "out_of_stock";
        break;
      default:
        return null;
    }

    return { item, quantity, stockLevel };
  };

  const handleAddStock = async () => {
    if (!newStockInput.trim() || isAdding) return;

    const parsed = parseStockInput(newStockInput);

    if (!parsed) {
      setErrorMessage("Invalid format. Expected: item / quantity / status");
      setShowError(true);
      return;
    }

    const { item, quantity, stockLevel } = parsed;

    setIsAdding(true);
    try {
      await onAddStock(item, quantity, stockLevel);
      const tempId = `pending|||${item}|||${quantity}|||${stockLevel}`;
      pushUndo({ type: "add", stockId: tempId });
      setNewStockInput("");
    } catch {
      // Error handling done in hook
    } finally {
      setIsAdding(false);
      setTimeout(() => addInputRef.current?.focus(), 0);
    }
  };

  // Update undo stack with real ID when stock is added
  useEffect(() => {
    setUndoStack((prev) =>
      prev.map((op) => {
        if (op.type === "add" && op.stockId.startsWith("pending|||")) {
          const pendingData = op.stockId.substring("pending|||".length);
          const parts = pendingData.split("|||");
          if (parts.length >= 2) {
            const [item, quantity] = parts;
            const found = stock.find((s) => s.item === item && s.quantity === quantity);
            if (found) {
              return { ...op, stockId: found.id };
            }
          }
        }
        return op;
      })
    );
  }, [stock]);

  const handleDelete = async (stockItem: Stock) => {
    try {
      await onDeleteStock(stockItem.id);
      pushUndo({ type: "delete", stock: stockItem });
    } catch {
      // Error handling done in hook
    }
  };

  const startEditing = (stockItem: Stock, field: "item" | "quantity" | "stock_level") => {
    setEditingId(stockItem.id);
    setEditingField(field);
    let value: string;
    if (field === "stock_level") {
      // Convert stock_level to display code for editing
      switch (stockItem.stock_level) {
        case "sufficient":
          value = "+";
          break;
        case "running_low":
          value = "-";
          break;
        case "out_of_stock":
          value = "0";
          break;
        default:
          value = "+";
      }
    } else {
      value = stockItem[field];
    }
    setEditValue(value);
    setOriginalValue(value);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue("");
    setOriginalValue("");
  };

  const saveEditing = async () => {
    if (!editingId || !editingField) return;

    const trimmedValue = editValue.trim();
    if (!trimmedValue || trimmedValue === originalValue) {
      cancelEditing();
      return;
    }

    try {
      let updates: { item?: string; quantity?: string; stock_level?: StockLevel };
      let actualNewValue = trimmedValue;

      if (editingField === "stock_level") {
        let stockLevel: StockLevel;
        switch (trimmedValue) {
          case "+":
            stockLevel = "sufficient";
            break;
          case "-":
            stockLevel = "running_low";
            break;
          case "0":
            stockLevel = "out_of_stock";
            break;
          default:
            cancelEditing();
            return;
        }
        updates = { stock_level: stockLevel };
        actualNewValue = stockLevel;
      } else {
        updates = { [editingField]: trimmedValue };
      }

      await onUpdateStock(editingId, updates);
      pushUndo({
        type: "edit",
        stockId: editingId,
        field: editingField,
        oldValue: originalValue,
        newValue: actualNewValue,
      });
      cancelEditing();
    } catch {
      cancelEditing();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEditing();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddStock();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const day = date.getDate().toString().padStart(2, "0");
      const month = date.toLocaleString("en-US", { month: "short" });
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${day}/${month} ${hours}:${minutes}`;
    } catch {
      return timestamp;
    }
  };

  const getRowClassName = (stockLevel: StockLevel) => {
    switch (stockLevel) {
      case "out_of_stock":
        return "stock-row level-out-of-stock";
      case "running_low":
        return "stock-row level-running-low";
      default:
        return "stock-row level-sufficient";
    }
  };

  // Filter and sort stock by scarcity
  const filteredStock = useMemo(() => {
    const lowerFilter = filter.toLowerCase();

    return stock
      .filter(
        (s) =>
          s.item.toLowerCase().includes(lowerFilter) ||
          s.quantity.toLowerCase().includes(lowerFilter)
      )
      .sort((a, b) => {
        // First sort by stock level priority (out_of_stock first)
        const priorityDiff = STOCK_LEVEL_PRIORITY[a.stock_level] - STOCK_LEVEL_PRIORITY[b.stock_level];
        if (priorityDiff !== 0) return priorityDiff;
        // Then by timestamp (newest first within same priority)
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });
  }, [stock, filter]);

  const itemCount = stock.length;

  return (
    <div className="stock-container">
      <div className="section-header">
        <span>{"// INVENTORY"}</span>
        <span className="memory-count">
          {itemCount === 0 ? "No items" : itemCount === 1 ? "1 item" : `${itemCount} items`}
        </span>
      </div>

      <div className="memories-controls">
        <div className="filter-input-wrapper">
          <span className="filter-prompt">FILTER:</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="item or quantity..."
            className="filter-input"
          />
        </div>
        <button
          className="undo-button"
          onClick={handleUndo}
          disabled={undoStack.length === 0 || isUndoing}
          title={undoStack.length > 0 ? `Undo (${undoStack.length})` : "Nothing to undo"}
        >
          {isUndoing ? "UNDOING..." : `UNDO${undoStack.length > 0 ? ` (${undoStack.length})` : ""}`}
        </button>
        <button className="refresh-button" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? "LOADING..." : "REFRESH"}
        </button>
      </div>

      <div className="stock-list">
        {error && (
          <div className="memories-error">
            <span className="error-text">{">"} Error: {error}</span>
          </div>
        )}

        {!error && filteredStock.length === 0 && !isLoading && (
          <div className="memories-empty">
            <span className="content" style={{ opacity: 0.5 }}>
              {">"} {filter ? "No matches found" : "No stock entries yet"}
            </span>
          </div>
        )}

        {filteredStock.map((stockItem) => (
          <div key={stockItem.id} className={getRowClassName(stockItem.stock_level)}>
            <span className="stock-timestamp">
              [{formatTimestamp(stockItem.timestamp)}]
            </span>

            {/* Editable Item */}
            {editingId === stockItem.id && editingField === "item" ? (
              <input
                ref={editInputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={cancelEditing}
                className="stock-edit-input"
              />
            ) : (
              <span
                className="stock-item stock-editable"
                onClick={() => startEditing(stockItem, "item")}
                title="Click to edit"
              >
                {stockItem.item}
              </span>
            )}

            <span className="stock-arrow">→</span>

            {/* Editable Quantity */}
            {editingId === stockItem.id && editingField === "quantity" ? (
              <input
                ref={editInputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={cancelEditing}
                className="stock-edit-input"
                style={{ flex: 1 }}
              />
            ) : (
              <span
                className="stock-quantity stock-editable"
                onClick={() => startEditing(stockItem, "quantity")}
                title="Click to edit"
              >
                {stockItem.quantity}
              </span>
            )}

            {/* Editable Stock Level */}
            {editingId === stockItem.id && editingField === "stock_level" ? (
              <input
                ref={editInputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={cancelEditing}
                className="stock-edit-input"
                style={{ width: 40 }}
                placeholder="+/-/0"
              />
            ) : (
              <span
                className="stock-level-indicator stock-editable"
                onClick={() => startEditing(stockItem, "stock_level")}
                title="Click to edit (+/-/0)"
              >
                [{STOCK_LEVEL_LABELS[stockItem.stock_level]}]
              </span>
            )}

            {/* Delete button */}
            <button
              className="stock-delete-btn"
              onClick={() => handleDelete(stockItem)}
              title="Delete this stock entry"
            >
              [DEL]
            </button>
          </div>
        ))}
      </div>

      <div className="stock-add-row">
        <span className="memory-prompt">{">"} ADD:</span>
        <input
          ref={addInputRef}
          type="text"
          value={newStockInput}
          onChange={(e) => setNewStockInput(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="item / quantity / +|-|0 (e.g., milk / 2 gallons / +)"
          className="stock-add-input"
          disabled={isAdding}
        />
        {isAdding && <span className="memory-adding">SAVING...</span>}
      </div>

      <RetroModal
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Input Error"
      >
        <p>{errorMessage}</p>
        <p style={{ marginTop: 12 }}>
          Expected format: <code>item / quantity / status</code>
        </p>
        <p style={{ marginTop: 8 }}>
          Status codes:
        </p>
        <ul style={{ marginTop: 4, paddingLeft: 20 }}>
          <li><code>+</code> = sufficient stock</li>
          <li><code>-</code> = running low</li>
          <li><code>0</code> = out of stock</li>
        </ul>
        <p style={{ marginTop: 12 }}>
          Example: <code>milk / 2 gallons / +</code>
        </p>
      </RetroModal>
    </div>
  );
};
