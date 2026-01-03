"use client";

import { useState } from "react";
import { useRTVIClientEvent } from "@pipecat-ai/client-react";
import { RTVIEvent } from "@pipecat-ai/client-js";

export const MicDots = () => {
  const [isActive, setIsActive] = useState(false);

  useRTVIClientEvent(RTVIEvent.UserStartedSpeaking, () => {
    setIsActive(true);
  });

  useRTVIClientEvent(RTVIEvent.UserStoppedSpeaking, () => {
    setIsActive(false);
  });

  return (
    <div className={`mic-dots ${isActive ? "active" : ""}`}>
      <div className="dot" />
      <div className="dot" />
      <div className="dot" />
      <div className="dot" />
      <div className="dot" />
    </div>
  );
};
