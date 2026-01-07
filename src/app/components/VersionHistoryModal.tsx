"use client";

import { useEffect, useRef } from "react";
import { VersionEntry } from "../hooks/useVersion";

interface VersionHistoryModalProps {
  type: "client" | "server";
  history: VersionEntry[];
  currentVersion: string | null;
  onClose: () => void;
}

export const VersionHistoryModal = ({
  type,
  history,
  currentVersion,
  onClose,
}: VersionHistoryModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const title = type === "client" ? "Client Version History" : "Server Version History";

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content version-modal" ref={modalRef}>
        <div className="modal-header">
          <span className="modal-title">{"// "}{title.toUpperCase()}</span>
          <button className="modal-close" onClick={onClose}>
            [X]
          </button>
        </div>
        <div className="modal-body">
          {history.length === 0 ? (
            <div className="version-entry">
              <span className="version-loading">Loading version history...</span>
            </div>
          ) : (
            history.map((entry, index) => (
              <div
                key={entry.version}
                className={`version-entry ${
                  entry.version === currentVersion ? "current" : ""
                }`}
              >
                <div className="version-header">
                  v{entry.version}
                  {entry.version === currentVersion && (
                    <span className="version-current-badge"> [CURRENT]</span>
                  )}
                  {index === 0 && entry.version !== currentVersion && (
                    <span className="version-latest-badge"> [LATEST]</span>
                  )}
                </div>
                <ul className="version-changes">
                  {entry.changes.map((change, i) => (
                    <li key={i}>- {change}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
