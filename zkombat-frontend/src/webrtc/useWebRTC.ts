import { useCallback, useEffect, useRef, useState } from 'react';
import { RTCManager } from './RTCManager';
import type { ConnectionState, DataChannelMessage, GameInput, InputLogEntry } from './types';

export interface UseWebRTCReturn {
  /** Current connection lifecycle state */
  connectionState: ConnectionState;
  /** Latest game input received from the remote peer */
  remoteGameData: GameInput | null;
  /** Send a game input to the remote peer */
  sendGameData: (data: GameInput) => void;
  /** Send arbitrary JSON data over the data channel */
  sendRaw: (data: object) => void;
  /** Latest raw message received from the remote peer (character-select, etc.) */
  rawMessage: DataChannelMessage | null;
  /** Create a new match room (you become the host) */
  createRoom: () => void;
  /** Join an existing room by ID */
  joinRoom: (roomId: string) => void;
  /** The current room ID (null until created/joined) */
  roomId: string | null;
  /** Whether this peer is the room host */
  isHost: boolean;
  /** Append-only input log for both players — feed to the Noir ZK circuit */
  inputHistory: React.RefObject<InputLogEntry[]>;
  /** Latest measured round-trip latency in ms */
  latency: number;
  /** Last error message from signaling or peer connection */
  error: string | null;
  /** Tear down all connections */
  disconnect: () => void;
}

export function useWebRTC(signalingUrl: string): UseWebRTCReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [remoteGameData, setRemoteGameData] = useState<GameInput | null>(null);
  const [rawMessage, setRawMessage] = useState<DataChannelMessage | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [latency, setLatency] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const inputHistory = useRef<InputLogEntry[]>([]);
  const managerRef = useRef<RTCManager | null>(null);

  // Initialise RTCManager once per signalingUrl
  useEffect(() => {
    const manager = new RTCManager(signalingUrl);

    manager.on('onStateChange', (state) => setConnectionState(state));
    manager.on('onRoomCreated', (id) => setRoomId(id));
    manager.on('onConnected', () => setError(null));
    manager.on('onDisconnected', () => {});
    manager.on('onGameData', (data) => setRemoteGameData(data));
    manager.on('onRawMessage', (data) => setRawMessage(data));
    manager.on('onLatencyUpdate', (ms) => setLatency(ms));
    manager.on('onError', (msg) => setError(msg));
    manager.on('onInputLog', (entry) => {
      inputHistory.current.push(entry);
    });

    managerRef.current = manager;

    return () => {
      manager.close();
      managerRef.current = null;
    };
  }, [signalingUrl]);

  const createRoom = useCallback(() => {
    setError(null);
    setIsHost(true);
    managerRef.current?.createRoom();
  }, []);

  const joinRoom = useCallback((id: string) => {
    setError(null);
    setIsHost(false);
    managerRef.current?.joinRoom(id);
  }, []);

  const sendGameData = useCallback((data: GameInput) => {
    managerRef.current?.sendGameData(data);
  }, []);

  const sendRaw = useCallback((data: object) => {
    managerRef.current?.sendRaw(data);
  }, []);

  const disconnect = useCallback(() => {
    managerRef.current?.close();
    setRoomId(null);
    setIsHost(false);
    setError(null);
  }, []);

  return {
    connectionState,
    remoteGameData,
    sendGameData,
    sendRaw,
    rawMessage,
    createRoom,
    joinRoom,
    roomId,
    isHost,
    inputHistory,
    latency,
    error,
    disconnect,
  };
}
