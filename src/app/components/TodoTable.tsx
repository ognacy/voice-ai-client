"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";

interface TodoItem {
  id: string;
  content: string;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
}

type UndoAction =
  | { type: "create"; item: TodoItem }
  | { type: "update"; item: TodoItem; previousState: TodoItem }
  | { type: "delete"; item: TodoItem };

interface UndoEntry {
  action: UndoAction;
  timestamp: number;
}

export const TodoTable = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [filter, setFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newTodoInput, setNewTodoInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [lastAction, setLastAction] = useState<UndoEntry | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 3000);
  };

  // Fetch todos from API
  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/todos?include_completed=true");
      if (!response.ok) {
        throw new Error("Failed to fetch todos");
      }
      const data = await response.json();
      const todoList = Array.isArray(data) ? data : (data.todos || []);
      setTodos(todoList);
    } catch (err) {
      console.error("Failed to fetch todos:", err);
      setError("Failed to load todos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchTodos();
    }
  }, [fetchTodos]);

  // SSE listener for real-time updates
  useEffect(() => {
    const sseUrl = "/api/events";
    const es = new EventSource(sseUrl);

    es.addEventListener("todo_created", (e) => {
      try {
        const data = JSON.parse(e.data);
        // Only add if not already present (avoids duplicates)
        setTodos((prev) => {
          if (prev.some((item) => item.id === data.id)) {
            return prev;
          }
          return [...prev, data];
        });
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("todo_deleted", (e) => {
      try {
        const data = JSON.parse(e.data);
        setTodos((prev) => prev.filter((item) => item.id !== data.id));
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("todo_updated", (e) => {
      try {
        const data = JSON.parse(e.data);
        setTodos((prev) =>
          prev.map((item) => (item.id === data.id ? data : item))
        );
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
    if (!lastAction) return;

    const timeout = setTimeout(() => {
      setLastAction(null);
    }, 30000);

    return () => clearTimeout(timeout);
  }, [lastAction]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

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

  const handleAddTodo = async () => {
    if (!newTodoInput.trim() || isAdding) return;

    setIsAdding(true);
    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newTodoInput.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create todo");
      }

      const createdTodo = await response.json();
      // Store for undo (we can delete the newly created item)
      setLastAction({
        action: { type: "create", item: createdTodo },
        timestamp: Date.now(),
      });
      // SSE event will add it to state
      setNewTodoInput("");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add todo");
    } finally {
      setIsAdding(false);
      setTimeout(() => addInputRef.current?.focus(), 0);
    }
  };

  const handleDelete = async (id: string) => {
    // Store for undo before deleting
    const itemToDelete = todos.find((t) => t.id === id);

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete todo");
      }

      // Store for undo after successful API call
      if (itemToDelete) {
        setLastAction({
          action: { type: "delete", item: itemToDelete },
          timestamp: Date.now(),
        });
      }
      // SSE event will remove it from state, but also remove locally for immediate feedback
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete todo");
    }
  };

  const handleUndo = async () => {
    if (!lastAction || isUndoing) return;

    setIsUndoing(true);
    try {
      const { action } = lastAction;

      if (action.type === "delete") {
        // Undo delete: recreate the item
        const response = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: action.item.content }),
        });
        if (!response.ok) throw new Error("Failed to restore todo");
      } else if (action.type === "create") {
        // Undo create: delete the item
        const response = await fetch(`/api/todos/${action.item.id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to undo create");
        // Remove locally for immediate feedback
        setTodos((prev) => prev.filter((t) => t.id !== action.item.id));
      } else if (action.type === "update") {
        // Undo update: restore previous state
        const response = await fetch(`/api/todos/${action.item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: action.previousState.content,
            completed: action.previousState.completed,
          }),
        });
        if (!response.ok) throw new Error("Failed to undo edit");
      }

      // SSE events will update state
      setLastAction(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to undo");
    } finally {
      setIsUndoing(false);
    }
  };

  const handleToggleComplete = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    const previousState = { ...todo };
    const newCompleted = !todo.completed;

    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        };
      })
    );

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: newCompleted }),
      });

      if (!response.ok) {
        // Revert on failure
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? previousState : t))
        );
        throw new Error("Failed to update todo");
      }

      const updatedTodo = await response.json();
      // Store for undo
      setLastAction({
        action: { type: "update", item: updatedTodo, previousState },
        timestamp: Date.now(),
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to toggle todo");
    }
  };

  const handleStartEdit = (todo: TodoItem) => {
    setEditingId(todo.id);
    setEditValue(todo.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editValue.trim()) {
      handleCancelEdit();
      return;
    }

    const todo = todos.find((t) => t.id === editingId);
    if (!todo || todo.content === editValue.trim()) {
      handleCancelEdit();
      return;
    }

    const previousState = { ...todo };
    const newContent = editValue.trim();

    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === editingId ? { ...t, content: newContent } : t))
    );
    setEditingId(null);
    setEditValue("");

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });

      if (!response.ok) {
        // Revert on failure
        setTodos((prev) =>
          prev.map((t) => (t.id === todo.id ? previousState : t))
        );
        throw new Error("Failed to update todo");
      }

      const updatedTodo = await response.json();
      // Store for undo
      setLastAction({
        action: { type: "update", item: updatedTodo, previousState },
        timestamp: Date.now(),
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save edit");
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTodo();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const day = date.getDate().toString().padStart(2, "0");
      const month = date.toLocaleString("en-US", { month: "short" });
      return `${day}/${month}`;
    } catch {
      return timestamp;
    }
  };

  // Filter and sort: incomplete first, then by date (newest first)
  const filteredTodos = useMemo(() => {
    const lowerFilter = filter.toLowerCase();

    return todos
      .filter((t) => t.content.toLowerCase().includes(lowerFilter))
      .sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [todos, filter]);

  const itemCount = todos.length;
  const completedCount = todos.filter((t) => t.completed).length;
  const canUndo = lastAction !== null;

  return (
    <div className="todo-container">
      <div className="section-header">
        <span>{"// TO-DO"}</span>
        <span className="memory-count">
          {itemCount === 0
            ? "No items"
            : `${itemCount - completedCount}/${itemCount} pending`}
        </span>
      </div>

      <div className="memories-controls">
        <div className="filter-input-wrapper">
          <span className="filter-prompt">FILTER:</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="search..."
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
        <button className="refresh-button" onClick={fetchTodos} disabled={isLoading}>
          {isLoading ? "LOADING..." : "REFRESH"}
        </button>
      </div>

      <div className="todo-header">
        <span className="todo-col-check"></span>
        <span className="todo-col-content">ITEM</span>
        <span className="todo-col-added">ADDED</span>
        <span className="todo-col-done">DONE</span>
        <span className="todo-col-actions"></span>
      </div>

      <div className="todo-list">
        {error && (
          <div className="memories-error">
            <span className="error-text">{">"} Error: {error}</span>
          </div>
        )}

        {!error && filteredTodos.length === 0 && !isLoading && (
          <div className="memories-empty">
            <span className="content" style={{ opacity: 0.5 }}>
              {">"} {filter ? "No matches found" : "No to-do items yet"}
            </span>
          </div>
        )}

        {filteredTodos.map((todo) => (
          <div
            key={todo.id}
            className={`todo-row ${todo.completed ? "todo-completed" : ""}`}
          >
            <button
              className="todo-checkbox"
              onClick={() => handleToggleComplete(todo.id)}
              title={todo.completed ? "Mark as pending" : "Mark as complete"}
            >
              [{todo.completed ? "x" : " "}]
            </button>

            {editingId === todo.id ? (
              <input
                ref={editInputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={handleSaveEdit}
                className="todo-edit-input"
              />
            ) : (
              <span
                className="todo-col-content"
                onClick={() => handleStartEdit(todo)}
                title="Click to edit"
              >
                {todo.content}
              </span>
            )}

            <span className="todo-col-added">
              {formatTimestamp(todo.created_at)}
            </span>

            <span className="todo-col-done">
              {todo.completed_at ? formatTimestamp(todo.completed_at) : "-"}
            </span>

            <button
              className="todo-delete-btn"
              onClick={() => handleDelete(todo.id)}
              title="Delete this to-do"
            >
              [DEL]
            </button>
          </div>
        ))}
      </div>

      <div className="todo-add-row">
        <span className="memory-prompt">{">"} ADD:</span>
        <input
          ref={addInputRef}
          type="text"
          value={newTodoInput}
          onChange={(e) => setNewTodoInput(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="Enter a new to-do item..."
          className="todo-add-input"
          disabled={isAdding}
        />
        {isAdding && <span className="memory-adding">SAVING...</span>}
      </div>

      {errorMessage && (
        <div className="todo-toast">{errorMessage}</div>
      )}
    </div>
  );
};
