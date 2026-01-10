"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";

interface TodoItem {
  id: string;
  content: string;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
}

interface DeletedTodo {
  item: TodoItem;
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
  const [lastDeleted, setLastDeleted] = useState<DeletedTodo | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
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
        setLastDeleted({ item: itemToDelete, timestamp: Date.now() });
      }
      // SSE event will remove it from state, but also remove locally for immediate feedback
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete todo");
    }
  };

  const handleUndo = async () => {
    if (!lastDeleted || isUndoing) return;

    setIsUndoing(true);
    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: lastDeleted.item.content }),
      });

      if (!response.ok) {
        throw new Error("Failed to restore todo");
      }

      // SSE event will add it to state
      setLastDeleted(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to undo");
    } finally {
      setIsUndoing(false);
    }
  };

  const handleToggleComplete = (id: string) => {
    // For now, just toggle locally (API integration coming later)
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          completed: !t.completed,
          completed_at: !t.completed ? new Date().toISOString() : null,
        };
      })
    );
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
  const canUndo = lastDeleted !== null;

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

            <span className="todo-col-content">{todo.content}</span>

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
