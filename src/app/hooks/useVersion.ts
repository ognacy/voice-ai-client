"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "voice-ai-versions";

export interface VersionEntry {
  version: string;
  changes: string[];
}

export interface VersionHistory {
  versions: VersionEntry[];
  count: number;
}

interface StoredVersions {
  clientVersion: string | null;
  serverVersion: string | null;
}

interface NewVersionInfo {
  type: "client" | "server";
  version: string;
  changes: string[];
  previousVersion: string | null;
}

interface UseVersionReturn {
  clientVersion: string | null;
  serverVersion: string | null;
  clientHistory: VersionEntry[];
  serverHistory: VersionEntry[];
  isLoading: boolean;
  newVersions: NewVersionInfo[];
  dismissNewVersions: () => void;
  fetchHistory: (type: "client" | "server") => Promise<VersionEntry[]>;
}

// Compare versions (returns true if v1 > v2)
function isNewerVersion(v1: string | null, v2: string | null): boolean {
  if (!v1 || !v2) return false;
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }
  return false;
}

// Get changes between versions from history
function getChangesSince(
  history: VersionEntry[],
  oldVersion: string | null
): string[] {
  if (!oldVersion) {
    // First time - just show current version changes
    return history[0]?.changes || [];
  }

  const changes: string[] = [];
  for (const entry of history) {
    if (entry.version === oldVersion) break;
    if (isNewerVersion(entry.version, oldVersion) || entry.version === history[0]?.version) {
      changes.push(...entry.changes);
    }
  }
  return changes;
}

export const useVersion = (): UseVersionReturn => {
  const [clientVersion, setClientVersion] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [clientHistory, setClientHistory] = useState<VersionEntry[]>([]);
  const [serverHistory, setServerHistory] = useState<VersionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newVersions, setNewVersions] = useState<NewVersionInfo[]>([]);

  // Get stored versions from localStorage
  const getStoredVersions = (): StoredVersions => {
    if (typeof window === "undefined") {
      return { clientVersion: null, serverVersion: null };
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { clientVersion: null, serverVersion: null };
    } catch {
      return { clientVersion: null, serverVersion: null };
    }
  };

  // Save versions to localStorage
  const saveVersions = (client: string | null, server: string | null) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ clientVersion: client, serverVersion: server })
      );
    } catch {
      // Ignore storage errors
    }
  };

  // Fetch version history
  const fetchHistory = useCallback(
    async (type: "client" | "server"): Promise<VersionEntry[]> => {
      try {
        const endpoint =
          type === "client" ? "/api/client-version/history" : "/api/version/history";
        const response = await fetch(endpoint);
        if (!response.ok) return [];
        const data: VersionHistory = await response.json();
        return data.versions || [];
      } catch {
        return [];
      }
    },
    []
  );

  // Dismiss new version notifications
  const dismissNewVersions = useCallback(() => {
    setNewVersions([]);
    // Save current versions as "seen"
    saveVersions(clientVersion, serverVersion);
  }, [clientVersion, serverVersion]);

  // Initial fetch
  useEffect(() => {
    const fetchVersions = async () => {
      setIsLoading(true);
      const stored = getStoredVersions();
      const newVersionsList: NewVersionInfo[] = [];

      try {
        // Fetch client version and history
        const [clientRes, clientHistoryRes] = await Promise.all([
          fetch("/api/client-version"),
          fetch("/api/client-version/history"),
        ]);

        let currentClientVersion: string | null = null;
        let clientVersionHistory: VersionEntry[] = [];

        if (clientRes.ok) {
          const data = await clientRes.json();
          currentClientVersion = data.version;
          setClientVersion(data.version);
        }

        if (clientHistoryRes.ok) {
          const data: VersionHistory = await clientHistoryRes.json();
          clientVersionHistory = data.versions || [];
          setClientHistory(clientVersionHistory);
        }

        // Check for new client version
        if (
          currentClientVersion &&
          isNewerVersion(currentClientVersion, stored.clientVersion)
        ) {
          newVersionsList.push({
            type: "client",
            version: currentClientVersion,
            changes: getChangesSince(clientVersionHistory, stored.clientVersion),
            previousVersion: stored.clientVersion,
          });
        }

        // Fetch server version and history
        const [serverRes, serverHistoryRes] = await Promise.all([
          fetch("/api/version"),
          fetch("/api/version/history"),
        ]);

        let currentServerVersion: string | null = null;
        let serverVersionHistory: VersionEntry[] = [];

        if (serverRes.ok) {
          const data = await serverRes.json();
          currentServerVersion = data.version;
          setServerVersion(data.version);
        }

        if (serverHistoryRes.ok) {
          const data: VersionHistory = await serverHistoryRes.json();
          serverVersionHistory = data.versions || [];
          setServerHistory(serverVersionHistory);
        }

        // Check for new server version
        if (
          currentServerVersion &&
          isNewerVersion(currentServerVersion, stored.serverVersion)
        ) {
          newVersionsList.push({
            type: "server",
            version: currentServerVersion,
            changes: getChangesSince(serverVersionHistory, stored.serverVersion),
            previousVersion: stored.serverVersion,
          });
        }

        // Set new versions if any
        if (newVersionsList.length > 0) {
          setNewVersions(newVersionsList);
        } else {
          // No new versions - save current as seen
          saveVersions(currentClientVersion, currentServerVersion);
        }
      } catch (error) {
        console.error("Failed to fetch versions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersions();
  }, []);

  return {
    clientVersion,
    serverVersion,
    clientHistory,
    serverHistory,
    isLoading,
    newVersions,
    dismissNewVersions,
    fetchHistory,
  };
};
