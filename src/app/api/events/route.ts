import { NextRequest } from "next/server";

const API_BASE = process.env.CHAT_API_URL || "http://localhost:8765";

// GET /api/events - SSE proxy to backend events endpoint
export async function GET(request: NextRequest) {
  // Check if client disconnected
  const abortController = new AbortController();

  request.signal.addEventListener("abort", () => {
    abortController.abort();
  });

  try {
    const backendResponse = await fetch(`${API_BASE}/events`, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      signal: abortController.signal,
    });

    if (!backendResponse.ok) {
      return new Response(
        `data: ${JSON.stringify({ error: "Backend connection failed" })}\n\n`,
        {
          status: 502,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        }
      );
    }

    // Stream the SSE response from backend to client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = backendResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (error) {
          // Client disconnected or other error
          if (error instanceof Error && error.name !== "AbortError") {
            console.error("SSE proxy stream error:", error);
          }
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error("SSE proxy error:", error);
    return new Response(
      `data: ${JSON.stringify({ error: "Failed to connect to backend" })}\n\n`,
      {
        status: 503,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
        },
      }
    );
  }
}

// Disable static optimization for this route
export const dynamic = "force-dynamic";
