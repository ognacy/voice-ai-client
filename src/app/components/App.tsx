import { useEffect } from "react";

import type { PipecatBaseChildProps } from "@pipecat-ai/voice-ui-kit";

import { Tabs } from "./Tabs";
import { TerminalConversation } from "./TerminalConversation";
import { TextTranscript } from "./TextTranscript";
import { TerminalEvents } from "./TerminalEvents";
import { MemoriesTable } from "./MemoriesTable";
import { StockTable } from "./StockTable";
import { AsciiConnectButton } from "./AsciiConnectButton";
import { AsciiResetButton } from "./AsciiResetButton";
import { MicDots } from "./MicDots";
import { useTextChat } from "../hooks/useTextChat";
import { useMemories } from "../hooks/useMemories";
import { useStock } from "../hooks/useStock";

interface AppProps extends PipecatBaseChildProps {}

const TABS = [
  { id: "interact", label: "Interact" },
  { id: "locations", label: "Locations" },
  { id: "inventory", label: "Inventory" },
];

export const App = ({
  client,
  handleConnect,
  handleDisconnect,
}: AppProps) => {
  const { messages: textMessages, sendMessage, resetSession, isConnected: textChatConnected } = useTextChat();
  const { memories, isLoading: memoriesLoading, error: memoriesError, refresh: refreshMemories, createMemory, updateMemory, deleteMemory } = useMemories();
  const { stock, isLoading: stockLoading, error: stockError, refresh: refreshStock, createStock, updateStock, deleteStock } = useStock();

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
      <Tabs tabs={TABS} defaultTab="interact">
        {(activeTab) => (
          <>
            {activeTab === "interact" && (
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
            )}
            {activeTab === "locations" && (
              <div className="content-area">
                <MemoriesTable
                  memories={memories}
                  isLoading={memoriesLoading}
                  error={memoriesError}
                  onRefresh={refreshMemories}
                  onAddMemory={createMemory}
                  onDeleteMemory={deleteMemory}
                  onUpdateMemory={updateMemory}
                />
              </div>
            )}
            {activeTab === "inventory" && (
              <div className="content-area">
                <StockTable
                  stock={stock}
                  isLoading={stockLoading}
                  error={stockError}
                  onRefresh={refreshStock}
                  onAddStock={createStock}
                  onDeleteStock={deleteStock}
                  onUpdateStock={updateStock}
                />
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
};
