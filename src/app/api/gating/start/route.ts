import { NextResponse } from "next/server";

const API_BASE = process.env.CHAT_API_URL || "http://localhost:8765";

// POST /gating/start - Start listening (toggle mode only)
export async function POST() {
  try {
    const response = await fetch(`${API_BASE}/gating/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Failed to start listening" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Gating start error:", error);
    return NextResponse.json(
      { error: "Failed to connect to server" },
      { status: 503 }
    );
  }
}
