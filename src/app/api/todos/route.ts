import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CHAT_API_URL || "http://localhost:8765";

// GET /todos - List all todos
export async function GET(request: NextRequest) {
  try {
    const includeCompleted = request.nextUrl.searchParams.get("include_completed") ?? "true";

    const response = await fetch(`${API_BASE}/todos?include_completed=${includeCompleted}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch todos" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Todos fetch error:", error);
    return NextResponse.json(
      { error: "Failed to connect to server" },
      { status: 503 }
    );
  }
}
