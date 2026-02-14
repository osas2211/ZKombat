// ── Game Input (sent every frame over the data channel) ──────────────

export interface GameInput {
  type: 'move';
  action: 'punch' | 'kick' | 'block' | 'special';
  timestamp: number; // Date.now() — feeds into ZK anti-cheat proof
  position: { x: number; y: number };
  health: number;
  stamina: number;
  frameNumber: number;
}

// ── Data-channel control messages ────────────────────────────────────

export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
}

export type DataChannelMessage = GameInput | PingMessage | PongMessage;

// ── Input log (append-only, fed to Noir ZK circuit at match end) ─────

export interface InputLogEntry {
  player: 'local' | 'remote';
  input: GameInput;
}

// ── Connection state ─────────────────────────────────────────────────

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'waiting'     // room created, waiting for opponent
  | 'signaling'   // both players present, exchanging SDP/ICE
  | 'connected'
  | 'reconnecting';

// ── Signaling messages (WebSocket ↔ signaling server) ────────────────

export interface CreateRoomMessage {
  type: 'create-room';
}

export interface RoomCreatedMessage {
  type: 'room-created';
  roomId: string;
}

export interface JoinRoomMessage {
  type: 'join-room';
  roomId: string;
}

export interface RoomJoinedMessage {
  type: 'room-joined';
  roomId: string;
}

export interface PeerJoinedMessage {
  type: 'peer-joined';
}

export interface OfferMessage {
  type: 'offer';
  sdp: RTCSessionDescriptionInit;
}

export interface AnswerMessage {
  type: 'answer';
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidateMessage {
  type: 'ice-candidate';
  candidate: RTCIceCandidateInit;
}

export interface SignalingErrorMessage {
  type: 'error';
  message: string;
}

export type SignalingMessage =
  | CreateRoomMessage
  | RoomCreatedMessage
  | JoinRoomMessage
  | RoomJoinedMessage
  | PeerJoinedMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | SignalingErrorMessage;

// ── RTCManager callback interface ────────────────────────────────────

export interface RTCManagerCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onRoomCreated: (roomId: string) => void;
  onConnected: () => void;
  onDisconnected: () => void;
  onGameData: (data: GameInput) => void;
  onLatencyUpdate: (ms: number) => void;
  onError: (message: string) => void;
  onInputLog: (entry: InputLogEntry) => void;
}
