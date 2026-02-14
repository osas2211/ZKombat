# ZKombat Frontend

1v1 real-time fighting game on Stellar with WebRTC peer-to-peer communication and ZK anti-cheat proofs.

## Quick Start

```bash
# Install dependencies
bun install

# Terminal 1 — signaling server
bun run dev:signaling

# Terminal 2 — frontend
bun run dev
```

The signaling server runs on `ws://localhost:3001` by default. The frontend runs on `http://localhost:3000`.

## WebRTC Infrastructure

All real-time gameplay data flows over WebRTC peer-to-peer data channels. WebSockets are only used for the initial matchmaking handshake and are closed once the peer connection is established.

### How a Match Connects

```
Player 1 (Host)                Signaling Server              Player 2 (Guest)
     |                              |                              |
     |--- create-room ------------->|                              |
     |<-- room-created (code) ------|                              |
     |                              |<--- join-room (code) --------|
     |<-- peer-joined --------------|--- room-joined ------------->|
     |                              |                              |
     |--- SDP offer --------------->|--- SDP offer --------------->|
     |<-- SDP answer ---------------|<-- SDP answer ---------------|
     |--- ICE candidates ---------->|--- ICE candidates ---------->|
     |<-- ICE candidates -----------|<-- ICE candidates -----------|
     |                              |                              |
     |============ WebRTC Data Channel Established ================|
     |                              |                              |
     |    (WebSocket closed)        X        (WebSocket closed)    |
     |                                                             |
     |<========== game-data (P2P, UDP-like) ======================>|
```

### File Structure

```
server/
  signaling.ts          # Bun WebSocket signaling server
src/
  webrtc/
    types.ts            # Shared TypeScript interfaces
    RTCManager.ts       # Core WebRTC lifecycle manager
    useWebRTC.ts        # React hook wrapping RTCManager
  components/
    MatchLobby.tsx      # Lobby UI (create/join room)
```

### Signaling Server (`server/signaling.ts`)

Lightweight Bun WebSocket server that handles room management and relays SDP/ICE messages between two players. It does not touch game data.

**Message types handled:**

| Message | Direction | Purpose |
|---|---|---|
| `create-room` | Client -> Server | Host requests a new room |
| `room-created` | Server -> Client | Returns the 6-character room code |
| `join-room` | Client -> Server | Guest joins by room code |
| `room-joined` | Server -> Client | Confirms join to the guest |
| `peer-joined` | Server -> Client | Notifies the host that a guest arrived |
| `offer` | Relayed | SDP offer from host to guest |
| `answer` | Relayed | SDP answer from guest to host |
| `ice-candidate` | Relayed | ICE candidate relay in both directions |

**Configuration:**

| Env Variable | Default | Description |
|---|---|---|
| `SIGNALING_PORT` | `3001` | Port for the signaling WebSocket server |

### RTCManager (`src/webrtc/RTCManager.ts`)

Manages the full WebRTC lifecycle as a plain TypeScript class (no React dependency).

**Key behaviors:**

- Creates `RTCPeerConnection` with Google STUN servers (`stun:stun.l.google.com:19302`)
- Opens a data channel named `game-data` with `ordered: false` and `maxRetransmits: 0` (UDP-like — speed over reliability)
- Buffers the last 60 frames of inputs per player for rollback
- Maintains an append-only input log of every input from both players (for ZK proof generation)
- Sends a ping every 1 second over the data channel and tracks RTT
- On peer disconnection, attempts one automatic reconnection before declaring disconnect

**Public API:**

```typescript
const manager = new RTCManager('ws://localhost:3001');

manager.on('onConnected', () => { /* peer connected */ });
manager.on('onDisconnected', () => { /* peer lost */ });
manager.on('onGameData', (input: GameInput) => { /* remote input */ });
manager.on('onLatencyUpdate', (ms: number) => { /* RTT updated */ });
manager.on('onError', (msg: string) => { /* error */ });

manager.createRoom();                // host a match
manager.joinRoom('ABC123');          // join a match
manager.sendGameData(input);         // send a frame's input
manager.close();                     // tear down everything

manager.inputLog;                    // readonly InputLogEntry[]
manager.latency;                     // latest RTT in ms
manager.state;                       // ConnectionState
```

### useWebRTC Hook (`src/webrtc/useWebRTC.ts`)

React hook that wraps RTCManager with state management.

```typescript
const {
  connectionState,   // 'disconnected' | 'connecting' | 'waiting' | 'signaling' | 'connected' | 'reconnecting'
  remoteGameData,    // latest GameInput from opponent (or null)
  sendGameData,      // (data: GameInput) => void
  createRoom,        // () => void
  joinRoom,          // (roomId: string) => void
  roomId,            // string | null
  inputHistory,      // React ref — append-only InputLogEntry[] for ZK circuit
  latency,           // number (ms)
  error,             // string | null
  disconnect,        // () => void
} = useWebRTC('ws://localhost:3001');
```

### MatchLobby Component (`src/components/MatchLobby.tsx`)

UI component that handles the matchmaking flow. Uses a render prop pattern — once connected, it renders its children with the `webrtc` handle:

```tsx
<MatchLobby>
  {(webrtc) => <YourGameComponent webrtc={webrtc} />}
</MatchLobby>
```

**States displayed:**

| State | UI |
|---|---|
| `disconnected` | "Create Match" button + "Join Match" input |
| `waiting` | Room code displayed, waiting for opponent |
| `signaling` / `reconnecting` | "Establishing Connection..." spinner |
| `connected` | Status bar (room code + latency) + game children |

**Configuration:**

| Env Variable | Default | Description |
|---|---|---|
| `VITE_SIGNALING_URL` | `ws://localhost:3001` | Signaling server WebSocket URL |

### Game Input Format

Every frame, the game loop sends input over the data channel:

```typescript
interface GameInput {
  type: 'move';
  action: 'punch' | 'kick' | 'block' | 'special';
  timestamp: number;     // Date.now() — required for ZK anti-cheat proof
  position: { x: number; y: number };
  health: number;
  stamina: number;
  frameNumber: number;
}
```

Send inputs from your game loop:

```typescript
webrtc.sendGameData({
  type: 'move',
  action: 'punch',
  timestamp: Date.now(),
  position: { x: 100, y: 200 },
  health: 85,
  stamina: 60,
  frameNumber: currentFrame,
});
```

Read opponent inputs:

```typescript
// Latest input (updates every frame)
const opponentInput = webrtc.remoteGameData;

// Full match history (feed to Noir ZK circuit at match end)
const fullLog = webrtc.inputHistory.current;
```

### ZK Proof Integration

The `inputHistory` ref accumulates every input from both players in an append-only array. At match end, pass this to the Noir ZK circuit for anti-cheat proof generation:

```typescript
const matchInputs = webrtc.inputHistory.current;
// matchInputs: InputLogEntry[] where each entry is:
// { player: 'local' | 'remote', input: GameInput }
```

The millisecond timestamps on each input are used by the ZK circuit to validate human reaction times.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the Vite dev server (port 3000) |
| `bun run dev:signaling` | Start the signaling server (port 3001) |
| `bun run build` | Type-check + production build |
| `bun run lint` | Run ESLint |
| `bun run preview` | Preview the production build |
