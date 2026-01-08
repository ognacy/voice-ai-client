"use client";

import { useState, useRef, useEffect } from "react";
import type { ClientProfile } from "../hooks/useClientProfile";

interface ProfileSelectorProps {
  clients: ClientProfile[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  isLoading: boolean;
}

export const ProfileSelector = ({
  clients,
  selectedClientId,
  onSelectClient,
  isLoading,
}: ProfileSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const displayText = isLoading
    ? "Loading..."
    : selectedClient?.display || "Select Profile";

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

  const handleSelect = (clientId: string) => {
    onSelectClient(clientId);
    setIsOpen(false);
  };

  return (
    <div className="ascii-dropdown" ref={dropdownRef}>
      <button
        className="ascii-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || clients.length === 0}
      >
        [ {displayText} <span className="dropdown-arrow">{isOpen ? "" : ""}</span> ]
      </button>

      {isOpen && clients.length > 0 && (
        <div className="ascii-dropdown-menu">
          {clients.map((client) => (
            <button
              key={client.id}
              className={`ascii-dropdown-item ${
                client.id === selectedClientId ? "selected" : ""
              }`}
              onClick={() => handleSelect(client.id)}
            >
              {client.display}
              <span className="dropdown-item-mode">({client.gating})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
