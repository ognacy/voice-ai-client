"use client";

import { useState } from "react";
import { VersionEntry } from "../hooks/useVersion";
import { VersionHistoryModal } from "./VersionHistoryModal";

interface VersionDisplayProps {
  clientVersion: string | null;
  serverVersion: string | null;
  clientHistory: VersionEntry[];
  serverHistory: VersionEntry[];
}

export const VersionDisplay = ({
  clientVersion,
  serverVersion,
  clientHistory,
  serverHistory,
}: VersionDisplayProps) => {
  const [modalType, setModalType] = useState<"client" | "server" | null>(null);

  const handleClientClick = () => {
    setModalType("client");
  };

  const handleServerClick = () => {
    setModalType("server");
  };

  const closeModal = () => {
    setModalType(null);
  };

  const serverOffline = !serverVersion;

  return (
    <>
      <div className="version-display">
        <span
          className="version-item"
          onClick={handleClientClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleClientClick()}
        >
          client: {clientVersion || "?"}
        </span>
        <span
          className={`version-item ${serverOffline ? "offline" : ""}`}
          onClick={handleServerClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleServerClick()}
        >
          server: {serverVersion || "offline"}
        </span>
      </div>

      {modalType && (
        <VersionHistoryModal
          type={modalType}
          history={modalType === "client" ? clientHistory : serverHistory}
          currentVersion={modalType === "client" ? clientVersion : serverVersion}
          onClose={closeModal}
        />
      )}
    </>
  );
};
