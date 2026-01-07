import { NextResponse } from "next/server";

const API_BASE = process.env.CHAT_API_URL || "http://localhost:8765";

// GET /gating/modes - List available gating modes
export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/gating/modes`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch gating modes" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Gating modes fetch error:", error);
    return NextResponse.json(
      { error: "Failed to connect to server" },
      { status: 503 }
    );
  }
}
