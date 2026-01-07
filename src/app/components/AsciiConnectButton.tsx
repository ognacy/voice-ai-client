"use client";

import { usePipecatConnectionState } from "@pipecat-ai/voice-ui-kit";

interface AsciiConnectButtonProps {
  onConnect: () => void;
  onDisconnect: () => void;
}

export const AsciiConnectButton = ({
  onConnect,
  onDisconnect,
}: AsciiConnectButtonProps) => {
  const { isConnected, isConnecting } = usePipecatConnectionState();

  const handleClick = () => {
    if (isConnected) {
      onDisconnect();
    } else if (!isConnecting) {
      onConnect();
    }
  };

  let label = "Connect";
  if (isConnected) {
    label = "Disconnect";
  } else if (isConnecting) {
    label = "Connecting...";
  }

  return (
    <button
      className={`ascii-button ${isConnected ? "connected" : "disconnected"}`}
      onClick={handleClick}
      disabled={isConnecting}
    >
      [ {label} ]
    </button>
  );
};
