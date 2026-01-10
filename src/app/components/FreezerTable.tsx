"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { FreezerItem } from "../hooks/useFreezer";

type SortField = "code" | "description" | "added_at";
type SortDirection = "asc" | "desc";

interface FreezerTableProps {
  items: FreezerItem[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAddItem: (code: string, description: string) => Promise<void>;
  onDeleteItem: (code: string) => Promise<void>;
  onUpdateItem: (code: string, updates: { description?: string; added_at?: string }) => Promise<void>;
  onUndo: () => Promise<void>;
  canUndo: boolean;
}

export const FreezerTable = ({
  items,
  isLoading,
  error,
  onRefresh,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  onUndo,
  canUndo,
}: FreezerTableProps) => {
  const [filter, setFilter] = useState("");
  const [newItemInput, setNewItemInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  // Sorting state - default: oldest first (asc by added_at)
  const [sortField, setSortField] = useState<SortField>("added_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Editing state (description and date are editable, code is immutable)
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"description" | "added_at" | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingCode && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCode]);

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

  const isCodeDuplicate = (code: string) => {
    return items.some((item) => item.code.toUpperCase() === code.toUpperCase());
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 3000);
  };

  const handleAddItem = async () => {
    if (!newItemInput.trim() || isAdding) return;

    const slashIndex = newItemInput.indexOf("/");
    if (slashIndex === -1) {
      showError("Use format: CODE / description (e.g., ADM / goulash)");
      return;
    }

    const code = newItemInput.substring(0, slashIndex).trim().toUpperCase();
    const description = newItemInput.substring(slashIndex + 1).trim();

    if (!code || !description) {
      showError("Both code and description are required");
      return;
    }

    // Validate code format (3 alphanumeric characters)
    if (!/^[A-Z0-9]{3}$/.test(code)) {
      showError("Code must be 3 alphanumeric characters");
      return;
    }

    // Check for duplicate code
    if (isCodeDuplicate(code)) {
      showError(`Code "${code}" already exists`);
      return;
    }

    setIsAdding(true);
    try {
      await onAddItem(code, description);
      setNewItemInput("");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setIsAdding(false);
      setTimeout(() => addInputRef.current?.focus(), 0);
    }
  };

  const handleDelete = async (code: string) => {
    try {
      await onDeleteItem(code);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleUndo = async () => {
    if (!canUndo || isUndoing) return;
    setIsUndoing(true);
    try {
      await onUndo();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to undo");
    } finally {
      setIsUndoing(false);
    }
  };

  const startEditing = (item: FreezerItem, field: "description" | "added_at") => {
    setEditingCode(item.code);
    setEditingField(field);
    if (field === "description") {
      setEditValue(item.description);
    } else {
      // Format date as YYYY-MM-DD for the date input
      const date = new Date(item.added_at);
      setEditValue(date.toISOString().split("T")[0]);
    }
  };

  const cancelEditing = () => {
    setEditingCode(null);
    setEditingField(null);
    setEditValue("");
  };

  const saveEditing = async () => {
    if (!editingCode || !editingField) return;

    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      cancelEditing();
      return;
    }

    const originalItem = items.find((item) => item.code === editingCode);
    if (!originalItem) {
      cancelEditing();
      return;
    }

    // Check if value changed
    if (editingField === "description" && trimmedValue === originalItem.description) {
      cancelEditing();
      return;
    }
    if (editingField === "added_at") {
      const originalDate = new Date(originalItem.added_at).toISOString().split("T")[0];
      if (trimmedValue === originalDate) {
        cancelEditing();
        return;
      }
    }

    try {
      if (editingField === "description") {
        await onUpdateItem(editingCode, { description: trimmedValue });
      } else {
        // Convert date input to ISO string
        const newDate = new Date(trimmedValue);
        newDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
        await onUpdateItem(editingCode, { added_at: newDate.toISOString() });
      }
      cancelEditing();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update item");
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
      handleAddItem();
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "added_at" ? "asc" : "asc");
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDirection === "asc" ? " ^" : " v";
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const day = date.getDate().toString().padStart(2, "0");
      const month = date.toLocaleString("en-US", { month: "short" });
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return timestamp;
    }
  };

  const getDaysInFreezer = (timestamp: string) => {
    try {
      const frozenDate = new Date(timestamp);
      const now = new Date();
      const diffTime = now.getTime() - frozenDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 0;
    }
  };

  const getAgeClass = (timestamp: string) => {
    const days = getDaysInFreezer(timestamp);
    if (days > 180) return "freezer-old-red"; // > 6 months
    if (days > 90) return "freezer-old-yellow"; // > 3 months
    return "";
  };

  // Filter and sort items
  const filteredItems = useMemo(() => {
    const lowerFilter = filter.toLowerCase();

    return items
      .filter(
        (item) =>
          item.code.toLowerCase().includes(lowerFilter) ||
          item.description.toLowerCase().includes(lowerFilter)
      )
      .sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case "code":
            comparison = a.code.localeCompare(b.code);
            break;
          case "description":
            comparison = a.description.localeCompare(b.description);
            break;
          case "added_at":
            comparison = new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
            break;
        }
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [items, filter, sortField, sortDirection]);

  const itemCount = items.length;

  return (
    <div className="freezer-container">
      <div className="section-header">
        <span>{"// FREEZER"}</span>
        <span className="memory-count">
          {itemCount === 0 ? "Empty" : itemCount === 1 ? "1 item" : `${itemCount} items`}
        </span>
      </div>

      <div className="memories-controls">
        <div className="filter-input-wrapper">
          <span className="filter-prompt">FILTER:</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="code or description..."
            className="filter-input"
          />
        </div>
        <button
          className="undo-button"
          onClick={handleUndo}
          disabled={!canUndo || isUndoing}
          title={canUndo ? "Undo last delete" : "Nothing to undo"}
        >
          {isUndoing ? "UNDOING..." : "UNDO"}
        </button>
        <button className="refresh-button" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? "LOADING..." : "REFRESH"}
        </button>
      </div>

      {/* Column headers */}
      <div className="freezer-header">
        <span
          className="freezer-col-code freezer-sortable"
          onClick={() => handleSort("code")}
          title="Sort by code"
        >
          CODE{getSortIndicator("code")}
        </span>
        <span
          className="freezer-col-desc freezer-sortable"
          onClick={() => handleSort("description")}
          title="Sort by description"
        >
          DESCRIPTION{getSortIndicator("description")}
        </span>
        <span
          className="freezer-col-date freezer-sortable"
          onClick={() => handleSort("added_at")}
          title="Sort by date"
        >
          FROZEN{getSortIndicator("added_at")}
        </span>
        <span className="freezer-col-age">AGE</span>
        <span className="freezer-col-actions"></span>
      </div>

      <div className="freezer-list">
        {error && (
          <div className="memories-error">
            <span className="error-text">{">"} Error: {error}</span>
          </div>
        )}

        {!error && filteredItems.length === 0 && !isLoading && (
          <div className="memories-empty">
            <span className="content" style={{ opacity: 0.5 }}>
              {">"} {filter ? "No matches found" : "Freezer is empty"}
            </span>
          </div>
        )}

        {filteredItems.map((item) => {
          const daysInFreezer = getDaysInFreezer(item.added_at);
          const ageClass = getAgeClass(item.added_at);

          return (
            <div key={item.code} className={`freezer-row ${ageClass}`}>
              {/* Code (not editable - it's the primary key) */}
              <span className="freezer-col-code">
                [{item.code}]
              </span>

              {/* Editable Description */}
              {editingCode === item.code && editingField === "description" ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={cancelEditing}
                  className="freezer-edit-input freezer-col-desc"
                />
              ) : (
                <span
                  className="freezer-col-desc freezer-editable"
                  onClick={() => startEditing(item, "description")}
                  title="Click to edit"
                >
                  {item.description}
                </span>
              )}

              {/* Editable Date */}
              {editingCode === item.code && editingField === "added_at" ? (
                <input
                  ref={editInputRef}
                  type="date"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={cancelEditing}
                  className="freezer-edit-input freezer-col-date"
                />
              ) : (
                <span
                  className="freezer-col-date freezer-editable"
                  onClick={() => startEditing(item, "added_at")}
                  title="Click to edit date"
                >
                  {formatTimestamp(item.added_at)}
                </span>
              )}

              <span className="freezer-col-age" title={`${daysInFreezer} days in freezer`}>
                {daysInFreezer}d
              </span>

              {/* Delete button */}
              <button
                className="freezer-delete-btn"
                onClick={() => handleDelete(item.code)}
                title="Delete this item"
              >
                [DEL]
              </button>
            </div>
          );
        })}
      </div>

      <div className="memory-add-row">
        <span className="memory-prompt">{">"} ADD:</span>
        <input
          ref={addInputRef}
          type="text"
          value={newItemInput}
          onChange={(e) => setNewItemInput(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="CODE / description (e.g., ADM / goulash)"
          className="memory-add-input"
          disabled={isAdding}
        />
        {isAdding && <span className="memory-adding">SAVING...</span>}
      </div>

      {errorMessage && (
        <div className="freezer-toast">{errorMessage}</div>
      )}
    </div>
  );
};
