/**
 * ZKombat Signaling Server
 *
 * Lightweight Bun WebSocket server used ONLY for the initial WebRTC
 * handshake (SDP offer/answer + ICE candidate relay).
 * Once the peer connection is established the WebSocket can be closed.
 *
 * Usage:  bun run server/signaling.ts
 */

// ── Types (duplicated subset — server has no access to src/) ─────────

interface Room {
  id: string;
  host: unknown;           // Bun ServerWebSocket — typed as unknown for portability
  guest: unknown | null;
}

interface SignalingMsg {
  type: string;
  [key: string]: unknown;
}

// ── State ────────────────────────────────────────────────────────────

const rooms = new Map<string, Room>();
const socketToRoom = new Map<unknown, string>();

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function send(ws: unknown, data: SignalingMsg) {
  (ws as { send: (d: string) => void }).send(JSON.stringify(data));
}

function peer(room: Room, ws: unknown): unknown | null {
  if (room.host === ws) return room.guest;
  if (room.guest === ws) return room.host;
  return null;
}

// ── Server ───────────────────────────────────────────────────────────

const PORT = Number(process.env.SIGNALING_PORT) || 3001;

Bun.serve({
  port: PORT,

  fetch(req, server) {
    if (server.upgrade(req)) return undefined;
    return new Response('ZKombat signaling server', { status: 200 });
  },

  websocket: {
    open(ws) {
      // nothing to do until a message arrives
    },

    message(ws, raw) {
      let msg: SignalingMsg;
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer));
      } catch {
        send(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      switch (msg.type) {
        // ── Room lifecycle ─────────────────────────────────────────
        case 'create-room': {
          // Clean up any previous room this socket was in
          cleanupSocket(ws);

          const roomId = generateRoomId();
          const room: Room = { id: roomId, host: ws, guest: null };
          rooms.set(roomId, room);
          socketToRoom.set(ws, roomId);
          send(ws, { type: 'room-created', roomId });
          console.log(`[room ${roomId}] created`);
          break;
        }

        case 'join-room': {
          const roomId = (msg.roomId as string)?.toUpperCase();
          if (!roomId) {
            send(ws, { type: 'error', message: 'Missing roomId' });
            return;
          }
          const room = rooms.get(roomId);
          if (!room) {
            send(ws, { type: 'error', message: 'Room not found' });
            return;
          }
          if (room.guest) {
            send(ws, { type: 'error', message: 'Room is full' });
            return;
          }
          if (room.host === ws) {
            send(ws, { type: 'error', message: 'Cannot join your own room' });
            return;
          }

          // Clean up any previous room this socket was in
          cleanupSocket(ws);

          room.guest = ws;
          socketToRoom.set(ws, roomId);
          send(ws, { type: 'room-joined', roomId });
          // Tell the host that a peer arrived so it can create the offer
          send(room.host, { type: 'peer-joined' });
          console.log(`[room ${roomId}] guest joined`);
          break;
        }

        // ── SDP / ICE relay ────────────────────────────────────────
        case 'offer':
        case 'answer':
        case 'ice-candidate': {
          const roomId = socketToRoom.get(ws);
          if (!roomId) {
            send(ws, { type: 'error', message: 'Not in a room' });
            return;
          }
          const room = rooms.get(roomId);
          if (!room) return;

          const target = peer(room, ws);
          if (target) {
            send(target, msg);
          }
          break;
        }

        default:
          send(ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
      }
    },

    close(ws) {
      cleanupSocket(ws);
    },
  },
});

function cleanupSocket(ws: unknown) {
  const roomId = socketToRoom.get(ws);
  if (!roomId) return;

  const room = rooms.get(roomId);
  socketToRoom.delete(ws);

  if (!room) return;

  // Notify the remaining peer
  const remaining = peer(room, ws);
  if (remaining) {
    send(remaining, { type: 'error', message: 'Peer disconnected' });
    // Let the remaining socket know it's no longer in a room
    socketToRoom.delete(remaining);
  }

  rooms.delete(roomId);
  console.log(`[room ${roomId}] destroyed`);
}

console.log(`ZKombat signaling server listening on ws://localhost:${PORT}`);
