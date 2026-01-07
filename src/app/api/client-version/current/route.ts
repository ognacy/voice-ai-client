import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface VersionEntry {
  version: string;
  changes: string[];
}

// Parse whats-new.txt format into structured data
function parseWhatsNew(content: string): VersionEntry[] {
  const versions: VersionEntry[] = [];
  const lines = content.split("\n");

  let currentVersion: VersionEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Version header (e.g., "0.5:")
    const versionMatch = trimmed.match(/^(\d+\.\d+):$/);
    if (versionMatch) {
      if (currentVersion) {
        versions.push(currentVersion);
      }
      currentVersion = { version: versionMatch[1], changes: [] };
      continue;
    }

    // Change item (e.g., "- Added feature")
    if (trimmed.startsWith("- ") && currentVersion) {
      currentVersion.changes.push(trimmed.slice(2));
    }
  }

  // Don't forget the last version
  if (currentVersion) {
    versions.push(currentVersion);
  }

  return versions;
}

async function loadVersions(): Promise<VersionEntry[]> {
  try {
    const filePath = path.join(process.cwd(), "public", "whats-new.txt");
    const content = await fs.readFile(filePath, "utf-8");
    return parseWhatsNew(content);
  } catch (error) {
    console.error("Failed to load whats-new.txt:", error);
    return [];
  }
}

// GET /api/client-version/current - Get client version with current changes
export async function GET() {
  const versions = await loadVersions();

  if (versions.length === 0) {
    return NextResponse.json({ version: "0.0", changes: [] });
  }

  return NextResponse.json({
    version: versions[0].version,
    changes: versions[0].changes,
  });
}
