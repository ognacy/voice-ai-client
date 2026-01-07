# Networking Architecture

This document explains how the voice-ai client handles networking, particularly in remote/VPN environments like Tailscale.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Browser                                  │
│                        (e.g., iPhone via Tailscale)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    All traffic goes through HTTPS
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Next.js Web App (port 3000)                                  │
│              https://app.brotula-velociraptor.ts.net                        │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  /api/start     │  │  /api/events    │  │  /api/memories  │   ...       │
│  │  (WebRTC init)  │  │  (SSE proxy)    │  │  (REST proxy)   │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
└───────────┼─────────────────────┼─────────────────────┼──────────────────────┘
            │                     │                     │
            │ HTTP (internal)     │ HTTP (internal)     │ HTTP (internal)
            ▼                     ▼                     ▼
┌───────────────────────┐  ┌──────────────────────────────────────────────────┐
│  Pipecat Bot Server   │  │           Chat/Events Server                      │
│  localhost:7860       │  │           localhost:8765                          │
│                       │  │                                                   │
│  - /start             │  │  - /events (SSE)                                 │
│  - WebRTC signaling   │  │  - /memories (REST)                              │
│                       │  │  - /stock (REST)                                 │
│                       │  │  - /chat/* (REST)                                │
└───────────────────────┘  └──────────────────────────────────────────────────┘
            │
            │ WebRTC (DTLS encrypted)
            │ Peer-to-peer or via TURN
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Browser                                  │
│                           (Audio/Video streams)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why This Architecture Works with Tailscale

### The Problem with Direct Client Connections

Initially, the app used `NEXT_PUBLIC_SSE_URL=http://localhost:8765/events` for SSE connections. This caused issues because:

1. **`NEXT_PUBLIC_*` variables are embedded at build time** - They become part of the client JavaScript bundle
2. **`localhost` on the client means the client device** - When your iPhone connects, `localhost:8765` tries to connect to the iPhone itself, not your server
3. **Mixed content issues** - Even if you could reach the server, browsers block `http://` connections from `https://` pages

### The Solution: Server-Side Proxying

All client connections now go through Next.js API routes:

| Client Request | Server Proxy | Backend |
|---------------|--------------|---------|
| `GET /api/events` | → | `http://localhost:8765/events` |
| `GET /api/memories` | → | `http://localhost:8765/memories` |
| `POST /api/start` | → | `http://localhost:7860/start` |

Benefits:
- **Relative URLs work everywhere** - `/api/events` always resolves correctly
- **TLS termination at Tailscale** - Browser sees HTTPS, server sees HTTP internally
- **No mixed content** - All client traffic is HTTPS

## Why WebRTC "Just Works"

WebRTC is special because it separates **signaling** from **media transport**:

### 1. Signaling (HTTP/HTTPS)
- Client calls `POST /api/start` to initiate a session
- This is proxied through Next.js (HTTPS → HTTP)
- Server returns WebRTC offer/answer and ICE candidates

### 2. Media Transport (DTLS/SRTP)
- WebRTC media uses **DTLS** (Datagram TLS) for encryption
- This is peer-to-peer, encrypted at the WebRTC layer
- **Independent of HTTP/HTTPS** - WebRTC doesn't care if signaling was secure
- Uses STUN/TURN for NAT traversal

### 3. Why It Works Over Tailscale
- Tailscale creates a WireGuard mesh network
- All traffic between Tailscale nodes is encrypted at the network layer
- WebRTC ICE candidates can include Tailscale IP addresses
- TURN servers (if enabled via `enableDefaultIceServers: true`) handle NAT traversal

## SSE (Server-Sent Events) Proxy

The `/api/events` route streams SSE from the backend:

```
Browser ←──SSE──→ Next.js /api/events ←──HTTP──→ localhost:8765/events
```

This works because:
- The browser connects to the Next.js server (HTTPS via Tailscale)
- Next.js maintains a persistent connection to the backend (HTTP internally)
- Events are streamed through in real-time

## Known Limitations

### iOS Safari `setSinkId` Error

You may see this error on iOS:
```
NotAllowedError: The operation is not allowed.
```

With a call stack starting at `setSinkId`.

**Cause**: The Pipecat SDK tries to select audio output devices using `HTMLMediaElement.setSinkId()`. This API is not supported on iOS Safari.

**Impact**: Audio will still work - it just uses the default output device. The error can be safely ignored.

**Status**: This is a browser limitation, not a bug. Safari on iOS doesn't allow programmatic audio output selection for privacy/security reasons.

### WebSocket vs SSE

The pipecat SDK uses WebRTC for voice, not WebSockets. Our SSE implementation is separate and used for:
- Turn counter updates
- Memory CRUD events
- Stock CRUD events
- Bot text responses (for text chat mode)

If you need WebSocket support (wss://), you would need to:
1. Configure your server to support WSS with TLS certificates
2. Or use a separate TLS-terminating proxy for WebSocket traffic

Tailscale Services only proxies HTTP→HTTPS, not WS→WSS.

## Configuration

### Environment Variables

All these are **server-side only** (no `NEXT_PUBLIC_` prefix):

```bash
# Pipecat bot server for WebRTC
BOT_START_URL="http://localhost:7860/start"

# Chat/SSE/REST API server
CHAT_API_URL="http://localhost:8765"
```

### Tailscale Setup

1. **Web App Service**: Maps `app.your-tailnet.ts.net` → `localhost:3000` with HTTPS
2. **Both servers on same machine**: The Next.js app proxies to localhost, so pipecat and chat servers don't need external exposure

## Troubleshooting

### SSE Not Connecting
1. Check browser console for connection errors
2. Verify the backend is running on port 8765
3. Check `/api/events` returns `text/event-stream` content type

### WebRTC Not Working
1. Check browser console for ICE connection failures
2. Verify `BOT_START_URL` is correct
3. Check if TURN servers are needed (set `enableDefaultIceServers: true`)

### REST APIs Failing
1. Check Network tab for 503 errors (backend not reachable)
2. Verify `CHAT_API_URL` is set correctly
3. Check backend server logs
