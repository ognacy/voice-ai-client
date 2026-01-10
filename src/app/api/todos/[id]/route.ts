import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.CHAT_API_URL || "http://localhost:8765";

// DELETE /todos/{id} - Delete a todo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const response = await fetch(`${API_BASE}/todos/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      return NextResponse.json(
        { error: data.error || "Failed to delete todo" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Todo delete error:", error);
    return NextResponse.json(
      { error: "Failed to connect to server" },
      { status: 503 }
    );
  }
}
