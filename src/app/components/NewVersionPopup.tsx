"use client";

import { useEffect, useRef } from "react";

interface NewVersionInfo {
  type: "client" | "server";
  version: string;
  changes: string[];
  previousVersion: string | null;
}

interface NewVersionPopupProps {
  newVersions: NewVersionInfo[];
  onDismiss: () => void;
}

export const NewVersionPopup = ({
  newVersions,
  onDismiss,
}: NewVersionPopupProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onDismiss();
    }
  };

  if (newVersions.length === 0) return null;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content new-version-modal" ref={modalRef}>
        <div className="modal-header">
          <span className="modal-title">{"// "}WHAT&apos;S NEW</span>
          <button className="modal-close" onClick={onDismiss}>
            [X]
          </button>
        </div>
        <div className="modal-body">
          {newVersions.map((info) => (
            <div key={info.type} className="new-version-section">
              <div className="new-version-header">
                {info.type === "client" ? "CLIENT" : "SERVER"} v{info.version}
                {info.previousVersion && (
                  <span className="new-version-from">
                    {" "}(was v{info.previousVersion})
                  </span>
                )}
              </div>
              {info.changes.length > 0 ? (
                <ul className="new-version-changes">
                  {info.changes.map((change, i) => (
                    <li key={i}>- {change}</li>
                  ))}
                </ul>
              ) : (
                <p className="new-version-no-changes">No changelog available</p>
              )}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="modal-dismiss-btn" onClick={onDismiss}>
            [OK]
          </button>
        </div>
      </div>
    </div>
  );
};
