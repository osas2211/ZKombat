/**
 * ZKombat Signaling Server
 *
 * Lightweight Bun WebSocket server for WebRTC handshake
 * (SDP offer/answer + ICE candidate relay).
 * Once the peer connection is established the WebSocket can be closed.
 *
 * Deploy on Railway / Render / Fly.io (any platform supporting WebSockets).
 */

interface Room {
  id: string
  host: unknown
  guest: unknown | null
}

interface SignalingMsg {
  type: string
  [key: string]: unknown
}

const rooms = new Map<string, Room>()
const socketToRoom = new Map<unknown, string>()

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

function send(ws: unknown, data: SignalingMsg) {
  (ws as { send: (d: string) => void }).send(JSON.stringify(data))
}

function peer(room: Room, ws: unknown): unknown | null {
  if (room.host === ws) return room.guest
  if (room.guest === ws) return room.host
  return null
}

function cleanupSocket(ws: unknown) {
  const roomId = socketToRoom.get(ws)
  if (!roomId) return
  const room = rooms.get(roomId)
  socketToRoom.delete(ws)
  if (!room) return
  const remaining = peer(room, ws)
  if (remaining) {
    send(remaining, { type: 'error', message: 'Peer disconnected' })
    socketToRoom.delete(remaining)
  }
  rooms.delete(roomId)
  console.log(`[room ${roomId}] destroyed`)
}

const PORT = Number(process.env.PORT) || 3001

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',

  fetch(req, server) {
    // CORS preflight for health checks
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      })
    }
    if (server.upgrade(req)) return undefined
    return new Response('ZKombat signaling server', { status: 200 })
  },

  websocket: {
    open() { },

    message(ws, raw) {
      let msg: SignalingMsg
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw as any))
      } catch {
        send(ws, { type: 'error', message: 'Invalid JSON' })
        return
      }

      switch (msg.type) {
        case 'create-room': {
          cleanupSocket(ws)
          const roomId = generateRoomId()
          const room: Room = { id: roomId, host: ws, guest: null }
          rooms.set(roomId, room)
          socketToRoom.set(ws, roomId)
          send(ws, { type: 'room-created', roomId })
          console.log(`[room ${roomId}] created`)
          break
        }

        case 'join-room': {
          const roomId = (msg.roomId as string)?.toUpperCase()
          if (!roomId) { send(ws, { type: 'error', message: 'Missing roomId' }); return }
          const room = rooms.get(roomId)
          if (!room) { send(ws, { type: 'error', message: 'Room not found' }); return }
          if (room.guest) { send(ws, { type: 'error', message: 'Room is full' }); return }
          if (room.host === ws) { send(ws, { type: 'error', message: 'Cannot join your own room' }); return }
          cleanupSocket(ws)
          room.guest = ws
          socketToRoom.set(ws, roomId)
          send(ws, { type: 'room-joined', roomId })
          send(room.host, { type: 'peer-joined' })
          console.log(`[room ${roomId}] guest joined`)
          break
        }

        case 'offer':
        case 'answer':
        case 'ice-candidate': {
          const roomId = socketToRoom.get(ws)
          if (!roomId) { send(ws, { type: 'error', message: 'Not in a room' }); return }
          const room = rooms.get(roomId)
          if (!room) return
          const target = peer(room, ws)
          if (target) send(target, msg)
          break
        }

        default:
          send(ws, { type: 'error', message: `Unknown message type: ${msg.type}` })
      }
    },

    close(ws) {
      cleanupSocket(ws)
    },
  },
})

console.log(`ZKombat signaling server listening on port ${PORT}`)
