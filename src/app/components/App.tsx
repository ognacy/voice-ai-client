import { useEffect } from "react";

import type { PipecatBaseChildProps } from "@pipecat-ai/voice-ui-kit";

import { TerminalConversation } from "./TerminalConversation";
import { TextTranscript } from "./TextTranscript";
import { TerminalEvents } from "./TerminalEvents";
import { AsciiConnectButton } from "./AsciiConnectButton";
import { AsciiResetButton } from "./AsciiResetButton";
import { MicDots } from "./MicDots";
import { useTextChat } from "../hooks/useTextChat";

interface AppProps extends PipecatBaseChildProps {}

export const App = ({
  client,
  handleConnect,
  handleDisconnect,
}: AppProps) => {
  const { messages: textMessages, sendMessage, resetSession, isConnected: textChatConnected } = useTextChat();

  useEffect(() => {
    client?.initDevices();
  }, [client]);

  return (
    <div className="main-layout crt-container">
      <div className="control-bar">
        <div className="control-bar-left">
          <AsciiConnectButton
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
          <AsciiResetButton
            onReset={resetSession}
            isConnected={textChatConnected}
          />
        </div>
        <div className="control-bar-right">
          <MicDots />
        </div>
      </div>
      <div className="content-area">
        <div className="transcript-section">
          <TerminalConversation />
        </div>
        <div className="text-transcript-section">
          <TextTranscript
            messages={textMessages}
            onSendMessage={sendMessage}
            isConnected={textChatConnected}
          />
        </div>
        <div className="events-section">
          <TerminalEvents />
        </div>
      </div>
    </div>
  );
};
