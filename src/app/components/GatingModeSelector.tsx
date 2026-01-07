"use client";

import { useState, useRef, useEffect } from "react";
import type { GatingMode } from "../hooks/useClientProfile";

interface GatingModeSelectorProps {
  modes: GatingMode[];
  currentMode: GatingMode | null;
  onSelectMode: (mode: GatingMode) => void;
  disabled?: boolean;
}

const MODE_LABELS: Record<GatingMode, string> = {
  word: "Word",
  toggle: "Toggle",
  "always-on": "Always On",
};

export const GatingModeSelector = ({
  modes,
  currentMode,
  onSelectMode,
  disabled = false,
}: GatingModeSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayText = currentMode ? MODE_LABELS[currentMode] : "Mode";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (mode: GatingMode) => {
    onSelectMode(mode);
    setIsOpen(false);
  };

  return (
    <div className="ascii-dropdown" ref={dropdownRef}>
      <button
        className="ascii-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || modes.length === 0}
      >
        [ {displayText} <span className="dropdown-arrow">{isOpen ? "^" : "v"}</span> ]
      </button>

      {isOpen && modes.length > 0 && (
        <div className="ascii-dropdown-menu">
          {modes.map((mode) => (
            <button
              key={mode}
              className={`ascii-dropdown-item ${
                mode === currentMode ? "selected" : ""
              }`}
              onClick={() => handleSelect(mode)}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
