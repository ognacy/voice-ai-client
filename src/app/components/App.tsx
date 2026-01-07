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
import { ProfileSelector } from "./ProfileSelector";
import { GatingModeSelector } from "./GatingModeSelector";
import { ListenToggleButton } from "./ListenToggleButton";
import { MicDots } from "./MicDots";
import { VersionDisplay } from "./VersionDisplay";
import { NewVersionPopup } from "./NewVersionPopup";
import { useTextChat } from "../hooks/useTextChat";
import { useMemories } from "../hooks/useMemories";
import { useStock } from "../hooks/useStock";
import { useVersion } from "../hooks/useVersion";
import { useClientProfile } from "../hooks/useClientProfile";

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
  const {
    clientVersion,
    serverVersion,
    clientHistory,
    serverHistory,
    newVersions,
    dismissNewVersions,
  } = useVersion();
  const {
    clients,
    selectedClientId,
    selectClient,
    isLoadingClients,
    gatingModes,
    currentGatingMode,
    setGatingMode,
    isListening,
    toggleListening,
  } = useClientProfile();

  useEffect(() => {
    client?.initDevices();
  }, [client]);

  return (
    <div className="main-layout crt-container">
      {newVersions.length > 0 && (
        <NewVersionPopup
          newVersions={newVersions}
          onDismiss={dismissNewVersions}
        />
      )}
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
          <ProfileSelector
            clients={clients}
            selectedClientId={selectedClientId}
            onSelectClient={selectClient}
            isLoading={isLoadingClients}
          />
          <GatingModeSelector
            modes={gatingModes}
            currentMode={currentGatingMode}
            onSelectMode={setGatingMode}
            disabled={!selectedClientId}
          />
          {currentGatingMode === "toggle" && (
            <ListenToggleButton
              isListening={isListening}
              onToggle={toggleListening}
            />
          )}
        </div>
        <div className="control-bar-right">
          <VersionDisplay
            clientVersion={clientVersion}
            serverVersion={serverVersion}
            clientHistory={clientHistory}
            serverHistory={serverHistory}
          />
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
