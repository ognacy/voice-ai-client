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

  const connectArt = `┌───────────────┐
│   > CONNECT   │
└───────────────┘`;

  const disconnectArt = `┌───────────────┐
│ > DISCONNECT  │
└───────────────┘`;

  const connectingArt = `┌───────────────┐
│ CONNECTING... │
└───────────────┘`;

  let art = connectArt;
  if (isConnected) {
    art = disconnectArt;
  } else if (isConnecting) {
    art = connectingArt;
  }

  return (
    <button
      className={`ascii-button ${isConnected ? "connected" : "disconnected"}`}
      onClick={handleClick}
      disabled={isConnecting}
    >
      {art}
    </button>
  );
};
