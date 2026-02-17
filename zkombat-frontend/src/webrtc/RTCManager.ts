import type {
  ConnectionState,
  DataChannelMessage,
  GameInput,
  InputLogEntry,
  RTCManagerCallbacks,
  SignalingMessage,
} from './types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const INPUT_BUFFER_SIZE = 60; // last 60 frames per player
const PING_INTERVAL_MS = 1_000;

export class RTCManager {
  // ── Networking ───────────────────────────────────────────────────
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;

  // ── Room state ───────────────────────────────────────────────────
  private _roomId: string | null = null;
  private isHost = false;
  private reconnectAttempted = false;

  // ── Input buffers ────────────────────────────────────────────────
  private localBuffer: GameInput[] = [];
  private remoteBuffer: GameInput[] = [];
  private _inputLog: InputLogEntry[] = [];

  // ── Latency ──────────────────────────────────────────────────────
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastPingTs = 0;
  private _latency = 0;

  // ── Connection state ─────────────────────────────────────────────
  private _state: ConnectionState = 'disconnected';

  // ── Callbacks ────────────────────────────────────────────────────
  private cb: Partial<RTCManagerCallbacks> = {};

  constructor(private signalingUrl: string) {}

  // ── Public accessors ─────────────────────────────────────────────

  get roomId() {
    return this._roomId;
  }
  get state() {
    return this._state;
  }
  get latency() {
    return this._latency;
  }
  get inputLog(): readonly InputLogEntry[] {
    return this._inputLog;
  }
  get localInputBuffer(): readonly GameInput[] {
    return this.localBuffer;
  }
  get remoteInputBuffer(): readonly GameInput[] {
    return this.remoteBuffer;
  }

  // ── Callback registration ────────────────────────────────────────

  on<K extends keyof RTCManagerCallbacks>(event: K, fn: RTCManagerCallbacks[K]) {
    this.cb[event] = fn;
  }

  // ── Public API ───────────────────────────────────────────────────

  createRoom() {
    this.isHost = true;
    this.connectSignaling(() => {
      this.sendSignaling({ type: 'create-room' });
    });
  }

  joinRoom(roomId: string) {
    this.isHost = false;
    this.connectSignaling(() => {
      this.sendSignaling({ type: 'join-room', roomId });
    });
  }

  sendGameData(data: GameInput) {
    // Buffer locally
    this.pushBuffer(this.localBuffer, data);
    this.logInput({ player: 'local', input: data });

    // Send over data channel
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(data));
    }
  }

  /** Send arbitrary JSON over the data channel (for character selection, etc.) */
  sendRaw(data: object) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(data));
    }
  }

  close() {
    this.stopPing();
    this.dc?.close();
    this.pc?.close();
    this.ws?.close();
    this.dc = null;
    this.pc = null;
    this.ws = null;
    this.setState('disconnected');
  }

  // ── Signaling WebSocket ──────────────────────────────────────────

  private connectSignaling(onOpen: () => void) {
    this.setState('connecting');
    const ws = new WebSocket(this.signalingUrl);
    this.ws = ws;

    ws.onopen = () => onOpen();

    ws.onmessage = (ev) => {
      let msg: SignalingMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.handleSignaling(msg);
    };

    ws.onerror = () => {
      this.cb.onError?.('Signaling connection failed');
    };

    ws.onclose = () => {
      // Only flag as disconnected if we haven't established a peer connection
      if (this._state !== 'connected' && this._state !== 'reconnecting') {
        this.setState('disconnected');
      }
    };
  }

  private sendSignaling(msg: SignalingMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleSignaling(msg: SignalingMessage) {
    switch (msg.type) {
      case 'room-created':
        this._roomId = msg.roomId;
        this.setState('waiting');
        this.cb.onRoomCreated?.(msg.roomId);
        break;

      case 'room-joined':
        this._roomId = msg.roomId;
        this.setState('signaling');
        // Guest waits for the host's offer
        this.createPeerConnection();
        break;

      case 'peer-joined':
        // Host: peer arrived → create offer
        this.setState('signaling');
        this.createPeerConnection();
        this.createOffer();
        break;

      case 'offer':
        this.handleOffer(msg.sdp);
        break;

      case 'answer':
        this.handleAnswer(msg.sdp);
        break;

      case 'ice-candidate':
        this.handleRemoteIce(msg.candidate);
        break;

      case 'error':
        this.cb.onError?.(msg.message);
        if (this._state === 'reconnecting') {
          // Reconnect failed
          this.setState('disconnected');
          this.cb.onDisconnected?.();
        }
        break;
    }
  }

  // ── RTCPeerConnection ────────────────────────────────────────────

  private createPeerConnection() {
    this.pc?.close();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.sendSignaling({ type: 'ice-candidate', candidate: ev.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          this.onPeerConnected();
          break;
        case 'disconnected':
        case 'failed':
          this.onPeerDisconnected();
          break;
      }
    };

    // If we're the host, create the data channel
    if (this.isHost) {
      const dc = pc.createDataChannel('game-data', {
        ordered: false,
        maxRetransmits: 0,
      });
      this.setupDataChannel(dc);
    } else {
      // Guest receives the data channel
      pc.ondatachannel = (ev) => {
        this.setupDataChannel(ev.channel);
      };
    }
  }

  private async createOffer() {
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignaling({ type: 'offer', sdp: this.pc.localDescription! });
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(sdp);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.sendSignaling({ type: 'answer', sdp: this.pc.localDescription! });
  }

  private async handleAnswer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(sdp);
  }

  private async handleRemoteIce(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      // ICE candidate may arrive before remote description is set — safe to ignore
    }
  }

  // ── Data Channel ─────────────────────────────────────────────────

  private setupDataChannel(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      this.startPing();
    };

    dc.onmessage = (ev) => {
      let msg: DataChannelMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.handleChannelMessage(msg);
    };

    dc.onclose = () => {
      this.stopPing();
    };
  }

  private handleChannelMessage(msg: DataChannelMessage) {
    switch (msg.type) {
      case 'ping':
        // Respond immediately with pong
        if (this.dc?.readyState === 'open') {
          this.dc.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
        }
        break;

      case 'pong':
        this._latency = Date.now() - msg.timestamp;
        this.cb.onLatencyUpdate?.(this._latency);
        break;

      case 'move':
        this.pushBuffer(this.remoteBuffer, msg);
        this.logInput({ player: 'remote', input: msg });
        this.cb.onGameData?.(msg);
        break;

      case 'character-select':
      case 'character-confirmed':
        this.cb.onRawMessage?.(msg);
        break;
    }
  }

  // ── Ping / latency ──────────────────────────────────────────────

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.dc?.readyState === 'open') {
        this.lastPingTs = Date.now();
        this.dc.send(JSON.stringify({ type: 'ping', timestamp: this.lastPingTs }));
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  // ── Connection events ────────────────────────────────────────────

  private onPeerConnected() {
    this.reconnectAttempted = false;
    this.setState('connected');
    this.cb.onConnected?.();
    // Signaling WebSocket is no longer needed
    this.ws?.close();
    this.ws = null;
  }

  private onPeerDisconnected() {
    this.stopPing();

    if (!this.reconnectAttempted && this._roomId) {
      // Attempt one reconnection
      this.reconnectAttempted = true;
      this.setState('reconnecting');
      this.pc?.close();
      this.pc = null;
      this.dc = null;

      // Re-join the same room through signaling
      if (this.isHost) {
        this.connectSignaling(() => {
          this.sendSignaling({ type: 'create-room' });
        });
      } else {
        this.connectSignaling(() => {
          this.sendSignaling({ type: 'join-room', roomId: this._roomId! });
        });
      }
    } else {
      this.setState('disconnected');
      this.cb.onDisconnected?.();
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private setState(s: ConnectionState) {
    this._state = s;
    this.cb.onStateChange?.(s);
  }

  private pushBuffer(buffer: GameInput[], input: GameInput) {
    buffer.push(input);
    if (buffer.length > INPUT_BUFFER_SIZE) {
      buffer.shift();
    }
  }

  private logInput(entry: InputLogEntry) {
    this._inputLog.push(entry);
    this.cb.onInputLog?.(entry);
  }
}
