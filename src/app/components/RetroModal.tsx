"use client";

import { useEffect, useCallback } from "react";

interface RetroModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const RetroModal = ({ isOpen, onClose, title, children }: RetroModalProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="retro-modal-overlay" onClick={onClose}>
      <div className="retro-modal" onClick={(e) => e.stopPropagation()}>
        <div className="retro-modal-header">{">"} {title}</div>
        <div className="retro-modal-content">{children}</div>
        <div className="retro-modal-footer">Press ENTER or ESC to close</div>
      </div>
    </div>
  );
};
