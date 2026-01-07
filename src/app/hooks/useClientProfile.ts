"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "voice-ai-selected-client";

export interface ClientProfile {
  id: string;
  display: string;
  gating: GatingMode;
}

export type GatingMode = "word" | "toggle" | "always-on";

interface ClientsResponse {
  clients: ClientProfile[];
  current_client: string | null;
  count: number;
}

interface GatingModesResponse {
  modes: GatingMode[];
  current: GatingMode;
}

interface UseClientProfileReturn {
  // Clients
  clients: ClientProfile[];
  selectedClientId: string | null;
  selectedClient: ClientProfile | null;
  selectClient: (clientId: string) => Promise<void>;
  isLoadingClients: boolean;

  // Gating
  gatingModes: GatingMode[];
  currentGatingMode: GatingMode | null;
  setGatingMode: (mode: GatingMode) => Promise<void>;

  // Toggle mode listening state
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  toggleListening: () => Promise<void>;
}

export const useClientProfile = (): UseClientProfileReturn => {
  // Clients state
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  // Gating state
  const [gatingModes, setGatingModes] = useState<GatingMode[]>([]);
  const [currentGatingMode, setCurrentGatingMode] = useState<GatingMode | null>(null);

  // Listening state for toggle mode
  const [isListening, setIsListening] = useState(false);

  // Track if initial load is done
  const initialLoadDone = useRef(false);

  // Get stored client ID from localStorage
  const getStoredClientId = (): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  };

  // Store client ID in localStorage
  const storeClientId = (id: string) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Ignore storage errors
    }
  };

  // Derive selected client from clients list
  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  // Fetch clients list
  const fetchClients = useCallback(async (): Promise<ClientsResponse | null> => {
    try {
      const response = await fetch("/api/clients");
      if (!response.ok) return null;
      return await response.json();
    } catch {
      console.warn("Failed to fetch clients");
      return null;
    }
  }, []);

  // Fetch gating modes
  const fetchGatingModes = useCallback(async (): Promise<GatingModesResponse | null> => {
    try {
      const response = await fetch("/api/gating/modes");
      if (!response.ok) return null;
      return await response.json();
    } catch {
      console.warn("Failed to fetch gating modes");
      return null;
    }
  }, []);

  // Select a client profile
  const selectClient = useCallback(async (clientId: string): Promise<void> => {
    try {
      const response = await fetch("/api/clients/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });

      if (!response.ok) {
        console.error("Failed to select client");
        return;
      }

      const data = await response.json();
      setSelectedClientId(data.client_id);
      setCurrentGatingMode(data.gating);
      storeClientId(data.client_id);

      // Reset listening state when changing client
      setIsListening(false);
    } catch (error) {
      console.error("Error selecting client:", error);
    }
  }, []);

  // Set gating mode
  const setGatingMode = useCallback(async (mode: GatingMode): Promise<void> => {
    try {
      const response = await fetch("/api/gating/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) {
        console.error("Failed to set gating mode");
        return;
      }

      // Don't update local state - wait for SSE event
    } catch (error) {
      console.error("Error setting gating mode:", error);
    }
  }, []);

  // Start listening (toggle mode)
  const startListening = useCallback(async (): Promise<void> => {
    if (currentGatingMode !== "toggle") {
      console.warn("startListening only works in toggle mode");
      return;
    }

    try {
      const response = await fetch("/api/gating/start", {
        method: "POST",
      });

      if (!response.ok) {
        console.error("Failed to start listening");
        return;
      }

      // Don't update local state - wait for SSE event
    } catch (error) {
      console.error("Error starting listening:", error);
    }
  }, [currentGatingMode]);

  // Stop listening (toggle mode)
  const stopListening = useCallback(async (): Promise<void> => {
    if (currentGatingMode !== "toggle") {
      console.warn("stopListening only works in toggle mode");
      return;
    }

    try {
      const response = await fetch("/api/gating/stop", {
        method: "POST",
      });

      if (!response.ok) {
        console.error("Failed to stop listening");
        return;
      }

      // Don't update local state - wait for SSE event
    } catch (error) {
      console.error("Error stopping listening:", error);
    }
  }, [currentGatingMode]);

  // Toggle listening state
  const toggleListening = useCallback(async (): Promise<void> => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Initialize: fetch clients and restore stored selection
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setIsLoadingClients(true);

      // Fetch clients and gating modes in parallel
      const [clientsData, modesData] = await Promise.all([
        fetchClients(),
        fetchGatingModes(),
      ]);

      if (!mounted) return;

      if (clientsData) {
        setClients(clientsData.clients);

        // Check localStorage for stored client
        const storedClientId = getStoredClientId();
        const validStoredClient = storedClientId &&
          clientsData.clients.some((c) => c.id === storedClientId);

        if (validStoredClient) {
          // Select the stored client
          await selectClient(storedClientId);
        } else if (clientsData.current_client) {
          // Use server's current client
          setSelectedClientId(clientsData.current_client);
          const currentClient = clientsData.clients.find(
            (c) => c.id === clientsData.current_client
          );
          if (currentClient) {
            setCurrentGatingMode(currentClient.gating);
            storeClientId(currentClient.id);
          }
        }
      }

      if (modesData) {
        setGatingModes(modesData.modes);
        // Only set current mode from modesData if we don't have it from client selection
        if (!mounted) return;
        setCurrentGatingMode((prev) => prev || modesData.current);
      }

      setIsLoadingClients(false);
      initialLoadDone.current = true;
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchClients, fetchGatingModes, selectClient]);

  // Set up SSE listener for gating events
  useEffect(() => {
    const es = new EventSource("/api/events");

    es.addEventListener("client_selected", (e) => {
      try {
        const data = JSON.parse(e.data);
        setSelectedClientId(data.client_id);
        setCurrentGatingMode(data.gating);
        setIsListening(false);
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("gating_mode_changed", (e) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentGatingMode(data.mode);
        // Reset listening state when mode changes
        if (data.mode !== "toggle") {
          setIsListening(false);
        }
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener("assistant_listening_started", () => {
      setIsListening(true);
    });

    es.addEventListener("assistant_listening_stopped", () => {
      setIsListening(false);
    });

    return () => {
      es.close();
    };
  }, []);

  return {
    // Clients
    clients,
    selectedClientId,
    selectedClient,
    selectClient,
    isLoadingClients,

    // Gating
    gatingModes,
    currentGatingMode,
    setGatingMode,

    // Toggle mode listening
    isListening,
    startListening,
    stopListening,
    toggleListening,
  };
};
