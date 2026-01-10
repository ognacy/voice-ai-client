"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";

interface TodoItem {
  id: string;
  content: string;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
}

export const TodoTable = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTodoInput, setNewTodoInput] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);

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

  const handleAddTodo = () => {
    if (!newTodoInput.trim()) return;

    // For now, just add locally (API integration coming later)
    const newTodo: TodoItem = {
      id: Date.now().toString(),
      content: newTodoInput.trim(),
      completed: false,
      created_at: new Date().toISOString(),
      completed_at: null,
    };

    setTodos((prev) => [newTodo, ...prev]);
    setNewTodoInput("");
    setTimeout(() => addInputRef.current?.focus(), 0);
  };

  const handleDelete = (id: string) => {
    // For now, just delete locally (API integration coming later)
    setTodos((prev) => prev.filter((t) => t.id !== id));
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

  // Sort: incomplete first, then by date (newest first)
  const sortedTodos = useMemo(() => {
    return [...todos].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [todos]);

  const itemCount = todos.length;
  const completedCount = todos.filter((t) => t.completed).length;

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

        {!error && sortedTodos.length === 0 && !isLoading && (
          <div className="memories-empty">
            <span className="content" style={{ opacity: 0.5 }}>
              {">"} No to-do items yet
            </span>
          </div>
        )}

        {sortedTodos.map((todo) => (
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
        />
      </div>
    </div>
  );
};
