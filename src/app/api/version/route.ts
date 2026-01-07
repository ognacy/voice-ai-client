import { NextResponse } from "next/server";

const API_BASE = process.env.CHAT_API_URL || "http://localhost:8765";

// GET /api/version - Get server version number
export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/version`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch server version" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Server version fetch error:", error);
    return NextResponse.json(
      { error: "Failed to connect to server", version: "?" },
      { status: 503 }
    );
  }
}
