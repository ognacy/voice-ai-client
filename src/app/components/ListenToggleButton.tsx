"use client";

interface ListenToggleButtonProps {
  isListening: boolean;
  onToggle: () => void;
}

export const ListenToggleButton = ({
  isListening,
  onToggle,
}: ListenToggleButtonProps) => {
  return (
    <button
      className={`ascii-button listen-toggle ${isListening ? "listening" : "muted"}`}
      onClick={onToggle}
    >
      [ {isListening ? "Listening" : "Muted"} ]
    </button>
  );
};
