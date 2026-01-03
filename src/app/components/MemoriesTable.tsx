"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { Memory } from "../hooks/useMemories";

interface MemoriesTableProps {
  memories: Memory[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAddMemory: (item: string, location: string) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onUpdateMemory: (id: string, updates: { item?: string; location?: string }) => Promise<void>;
}

type SortDirection = "asc" | "desc";

// Undo operation types
type UndoOperation =
  | { type: "delete"; memory: Memory }
  | { type: "add"; memoryId: string }
  | { type: "edit"; memoryId: string; field: "item" | "location"; oldValue: string; newValue: string };

export const MemoriesTable = ({
  memories,
  isLoading,
  error,
  onRefresh,
  onAddMemory,
  onDeleteMemory,
  onUpdateMemory,
}: MemoriesTableProps) => {
  const [filter, setFilter] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [newMemoryInput, setNewMemoryInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"item" | "location" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Undo buffer
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId, editingField]);

  // Keyboard shortcut: + to focus add input (when not in an input field)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on + key with no modifiers
      if (e.key === "+" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't trigger if already in an input or textarea
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

  // Push operation to undo stack
  const pushUndo = useCallback((operation: UndoOperation) => {
    setUndoStack((prev) => [...prev, operation]);
  }, []);

  // Handle undo
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0 || isUndoing) return;

    const operation = undoStack[undoStack.length - 1];
    setIsUndoing(true);

    try {
      switch (operation.type) {
        case "delete":
          // Re-create the deleted memory
          await onAddMemory(operation.memory.item, operation.memory.location);
          break;
        case "add":
          // Delete the added memory
          await onDeleteMemory(operation.memoryId);
          break;
        case "edit":
          // Revert to old value
          await onUpdateMemory(operation.memoryId, {
            [operation.field]: operation.oldValue,
          });
          break;
      }
      // Remove from undo stack on success
      setUndoStack((prev) => prev.slice(0, -1));
    } catch {
      // Error handling done in hook
    } finally {
      setIsUndoing(false);
    }
  }, [undoStack, isUndoing, onAddMemory, onDeleteMemory, onUpdateMemory]);

  const handleAddMemory = async () => {
    if (!newMemoryInput.trim() || isAdding) return;

    const slashIndex = newMemoryInput.indexOf("/");
    if (slashIndex === -1) {
      return;
    }

    const item = newMemoryInput.substring(0, slashIndex).trim();
    const location = newMemoryInput.substring(slashIndex + 1).trim();

    if (!item || !location) return;

    setIsAdding(true);
    try {
      await onAddMemory(item, location);
      // Track by item+location combo temporarily until we get the real ID
      const tempId = `pending|||${item}|||${location}`;
      pushUndo({ type: "add", memoryId: tempId });
      setNewMemoryInput("");
    } catch {
      // Error handling done in hook
    } finally {
      setIsAdding(false);
      // Refocus after state updates complete
      setTimeout(() => addInputRef.current?.focus(), 0);
    }
  };

  // Update undo stack with real ID when memory is added
  useEffect(() => {
    setUndoStack((prev) =>
      prev.map((op) => {
        if (op.type === "add" && op.memoryId.startsWith("pending|||")) {
          const pendingData = op.memoryId.substring("pending|||".length);
          const separatorIndex = pendingData.indexOf("|||");
          if (separatorIndex === -1) return op;
          const item = pendingData.substring(0, separatorIndex);
          const location = pendingData.substring(separatorIndex + 3);
          const found = memories.find(
            (m) => m.item === item && m.location === location
          );
          if (found) {
            return { ...op, memoryId: found.id };
          }
        }
        return op;
      })
    );
  }, [memories]);

  const handleDelete = async (memory: Memory) => {
    try {
      await onDeleteMemory(memory.id);
      pushUndo({ type: "delete", memory });
    } catch {
      // Error handling done in hook
    }
  };

  const startEditing = (memory: Memory, field: "item" | "location") => {
    setEditingId(memory.id);
    setEditingField(field);
    const value = field === "item" ? memory.item : memory.location;
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
      await onUpdateMemory(editingId, { [editingField]: trimmedValue });
      pushUndo({
        type: "edit",
        memoryId: editingId,
        field: editingField,
        oldValue: originalValue,
        newValue: trimmedValue,
      });
      cancelEditing();
    } catch {
      // Error handling done in hook
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
      handleAddMemory();
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

  const filteredMemories = useMemo(() => {
    const lowerFilter = filter.toLowerCase();

    return memories
      .filter(
        (m) =>
          m.item.toLowerCase().includes(lowerFilter) ||
          m.location.toLowerCase().includes(lowerFilter)
      )
      .sort((a, b) => {
        const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
        const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
        return sortDirection === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [memories, filter, sortDirection]);

  const toggleSort = () => {
    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  return (
    <div className="memories-container">
      <div className="section-header">
        <span>{"// LOCATIONS"}</span>
        <span className="memory-count">
          {memories.length === 0 ? "No items" : memories.length === 1 ? "1 item" : `${memories.length} items`}
        </span>
      </div>

      <div className="memories-controls">
        <div className="filter-input-wrapper">
          <span className="filter-prompt">FILTER:</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="item or location..."
            className="filter-input"
          />
        </div>
        <button className="sort-button" onClick={toggleSort}>
          TIME {sortDirection === "desc" ? "▼" : "▲"}
        </button>
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

      <div className="memories-list">
        {error && (
          <div className="memories-error">
            <span className="error-text">{">"} Error: {error}</span>
          </div>
        )}

        {!error && filteredMemories.length === 0 && !isLoading && (
          <div className="memories-empty">
            <span className="content" style={{ opacity: 0.5 }}>
              {">"} {filter ? "No matches found" : "No memories stored yet"}
            </span>
          </div>
        )}

        {filteredMemories.map((memory) => (
          <div key={memory.id} className="memory-row">
            <span className="memory-timestamp">
              [{formatTimestamp(memory.timestamp || memory.created_at || "")}]
            </span>

            {/* Editable Item */}
            {editingId === memory.id && editingField === "item" ? (
              <input
                ref={editInputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={cancelEditing}
                className="memory-edit-input memory-item-edit"
              />
            ) : (
              <span
                className="memory-item memory-editable"
                onClick={() => startEditing(memory, "item")}
                title="Click to edit"
              >
                {memory.item}
              </span>
            )}

            <span className="memory-arrow">→</span>

            {/* Editable Location */}
            {editingId === memory.id && editingField === "location" ? (
              <input
                ref={editInputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={cancelEditing}
                className="memory-edit-input memory-location-edit"
              />
            ) : (
              <span
                className="memory-location memory-editable"
                onClick={() => startEditing(memory, "location")}
                title="Click to edit"
              >
                {memory.location}
              </span>
            )}

            {/* Delete button */}
            <button
              className="memory-delete-btn"
              onClick={() => handleDelete(memory)}
              title="Delete this memory"
            >
              [DEL]
            </button>
          </div>
        ))}
      </div>

      <div className="memory-add-row">
        <span className="memory-prompt">{">"} ADD:</span>
        <input
          ref={addInputRef}
          type="text"
          value={newMemoryInput}
          onChange={(e) => setNewMemoryInput(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="item / location (e.g., keys / drawer by front door)"
          className="memory-add-input"
          disabled={isAdding}
        />
        {isAdding && <span className="memory-adding">SAVING...</span>}
      </div>

    </div>
  );
};
