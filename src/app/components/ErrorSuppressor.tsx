"use client";

import { useEffect } from "react";

// Patch APIs immediately on module load (before any component mounts)
// This prevents errors from ever being thrown
if (typeof window !== "undefined") {
  // Patch setSinkId - iOS Safari doesn't support audio output selection
  if (typeof HTMLMediaElement !== "undefined") {
    const originalSetSinkId = HTMLMediaElement.prototype.setSinkId;

    if (originalSetSinkId) {
      HTMLMediaElement.prototype.setSinkId = function (sinkId: string) {
        return originalSetSinkId.call(this, sinkId).catch((err: Error) => {
          if (err.name === "NotAllowedError") {
            console.debug("[Suppressed] setSinkId not supported on this browser");
            return;
          }
          throw err;
        });
      };
    }
  }

  // Patch RTCDataChannel.send - suppress InvalidStateError during disconnect
  if (typeof RTCDataChannel !== "undefined") {
    const originalSend = RTCDataChannel.prototype.send;

    RTCDataChannel.prototype.send = function (data: string | Blob | ArrayBuffer | ArrayBufferView) {
      try {
        // Check if channel is open before sending
        if (this.readyState !== "open") {
          console.debug("[Suppressed] RTCDataChannel.send() called while not open, state:", this.readyState);
          return;
        }
        return originalSend.call(this, data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "InvalidStateError") {
          console.debug("[Suppressed] RTCDataChannel.send() InvalidStateError during disconnect");
          return;
        }
        throw err;
      }
    };
  }
}

/**
 * Suppresses known harmless errors from showing in the Next.js dev overlay.
 *
 * Currently suppresses:
 * - setSinkId NotAllowedError: iOS Safari doesn't support audio output selection.
 *   The Pipecat SDK tries to use it, fails, but audio still works fine.
 */
export const ErrorSuppressor = () => {
  useEffect(() => {
    // Suppress unhandled promise rejections for known harmless errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;

      // Suppress setSinkId errors (iOS Safari doesn't support audio output selection)
      if (
        error instanceof DOMException &&
        error.name === "NotAllowedError" &&
        (error.message?.includes("setSinkId") || event.reason?.stack?.includes("setSinkId"))
      ) {
        event.preventDefault();
        console.debug("[Suppressed] setSinkId not supported on this browser");
        return;
      }

      // Also catch by stack trace in case message differs
      if (
        error instanceof Error &&
        error.stack?.includes("setSinkId")
      ) {
        event.preventDefault();
        console.debug("[Suppressed] setSinkId not supported on this browser");
        return;
      }

      // Suppress InvalidStateError from send() on closed WebRTC/WebSocket during disconnect
      if (
        error instanceof DOMException &&
        error.name === "InvalidStateError" &&
        error.stack?.includes("send")
      ) {
        event.preventDefault();
        console.debug("[Suppressed] send() called on closed connection during disconnect");
        return;
      }
    };

    // Suppress window errors for the same
    const handleError = (event: ErrorEvent) => {
      if (
        event.message?.includes("setSinkId") ||
        event.error?.stack?.includes("setSinkId")
      ) {
        event.preventDefault();
        console.debug("[Suppressed] setSinkId not supported on this browser");
        return;
      }

      // Suppress InvalidStateError from send() on closed connection
      if (
        event.error?.name === "InvalidStateError" &&
        (event.message?.includes("invalid state") || event.error?.stack?.includes("send"))
      ) {
        event.preventDefault();
        console.debug("[Suppressed] send() called on closed connection during disconnect");
        return;
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return null;
};
