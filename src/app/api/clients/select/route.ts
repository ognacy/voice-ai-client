import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CHAT_API_URL || "http://localhost:8765";

// POST /clients/select - Select a client profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_BASE}/clients/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Failed to select client" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Client select error:", error);
    return NextResponse.json(
      { error: "Failed to connect to server" },
      { status: 503 }
    );
  }
}
