import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CHAT_API_URL || "http://localhost:8765";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const response = await fetch(`${API_BASE}/chat/session/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to delete session" },
        { status: response.status }
      );
    }

    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    console.error("Chat session delete proxy error:", error);
    return NextResponse.json(
      { error: "Failed to connect to chat server" },
      { status: 503 }
    );
  }
}
