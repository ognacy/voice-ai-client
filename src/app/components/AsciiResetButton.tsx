"use client";

interface AsciiResetButtonProps {
  onReset: () => void;
  isConnected: boolean;
}

export const AsciiResetButton = ({ onReset, isConnected }: AsciiResetButtonProps) => {
  return (
    <button
      className={`ascii-button ascii-reset-button ${isConnected ? "connected" : "disconnected"}`}
      onClick={onReset}
      disabled={!isConnected}
    >
      [ Reset Text Session ]
    </button>
  );
};
