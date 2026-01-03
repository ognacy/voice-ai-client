import { useEffect } from "react";

import type { PipecatBaseChildProps } from "@pipecat-ai/voice-ui-kit";

import { TerminalConversation } from "./TerminalConversation";
import { TerminalEvents } from "./TerminalEvents";
import { AsciiConnectButton } from "./AsciiConnectButton";
import { MicDots } from "./MicDots";

interface AppProps extends PipecatBaseChildProps {}

export const App = ({
  client,
  handleConnect,
  handleDisconnect,
}: AppProps) => {
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
        </div>
        <div className="control-bar-right">
          <MicDots />
        </div>
      </div>
      <div className="content-area">
        <div className="transcript-section">
          <TerminalConversation />
        </div>
        <div className="events-section">
          <TerminalEvents />
        </div>
      </div>
    </div>
  );
};
