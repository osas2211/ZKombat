import { useState } from 'react';
import { useWebRTC } from '../webrtc/useWebRTC';
import type { UseWebRTCReturn } from '../webrtc/useWebRTC';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:3001';

interface MatchLobbyProps {
  children: (webrtc: UseWebRTCReturn) => React.ReactNode;
}

export function MatchLobby({ children }: MatchLobbyProps) {
  const webrtc = useWebRTC(SIGNALING_URL);
  const { connectionState, roomId, latency, error, createRoom, joinRoom, disconnect } = webrtc;
  const [joinInput, setJoinInput] = useState('');

  const isLobby = connectionState === 'disconnected' || connectionState === 'waiting' || connectionState === 'connecting';
  const isNegotiating = connectionState === 'signaling' || connectionState === 'reconnecting';
  const isConnected = connectionState === 'connected';

  // ── Connected: render the game ───────────────────────────────────
  if (isConnected) {
    return (
      <>
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <StatusDot state={connectionState} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              Room <strong>{roomId}</strong>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
              {latency}ms
            </span>
          </div>
          <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }} onClick={disconnect}>
            Leave
          </button>
        </div>
        {children(webrtc)}
      </>
    );
  }

  // ── Negotiating: show spinner ────────────────────────────────────
  if (isNegotiating) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <StatusDot state={connectionState} />
        <h3 className="gradient-text" style={{ marginTop: '1rem' }}>
          {connectionState === 'reconnecting' ? 'Reconnecting...' : 'Establishing Connection...'}
        </h3>
        <p style={{ color: 'var(--color-ink-muted)', marginTop: '0.75rem', fontSize: '0.9rem' }}>
          Exchanging encryption keys with your opponent
        </p>
      </div>
    );
  }

  // ── Lobby: create or join ────────────────────────────────────────
  return (
    <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
      <h3 className="gradient-text" style={{ marginBottom: '1.5rem' }}>Match Lobby</h3>

      {error && (
        <div className="notice error" style={{ marginBottom: '1.25rem' }}>{error}</div>
      )}

      {/* Waiting for opponent */}
      {connectionState === 'waiting' && roomId && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="notice info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <StatusDot state={connectionState} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Waiting for opponent</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                Share this code: <strong style={{ fontSize: '1.1rem', letterSpacing: '0.15em' }}>{roomId}</strong>
              </div>
            </div>
          </div>
          <button className="btn-secondary" style={{ marginTop: '1rem', width: '100%' }} onClick={disconnect}>
            Cancel
          </button>
        </div>
      )}

      {/* Create / Join — hidden while waiting */}
      {connectionState !== 'waiting' && (
        <>
          <button
            onClick={createRoom}
            disabled={connectionState === 'connecting'}
            style={{ width: '100%', marginBottom: '1.5rem' }}
          >
            {connectionState === 'connecting' ? 'Connecting...' : 'Create Match'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Room code"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              maxLength={6}
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase', flex: 1 }}
            />
            <button
              className="btn-secondary"
              onClick={() => joinInput.trim() && joinRoom(joinInput.trim())}
              disabled={!joinInput.trim() || connectionState === 'connecting'}
            >
              Join
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Status indicator ───────────────────────────────────────────────

function StatusDot({ state }: { state: string }) {
  const color =
    state === 'connected'
      ? 'var(--color-success)'
      : state === 'waiting' || state === 'signaling' || state === 'reconnecting'
        ? 'var(--color-warning)'
        : 'var(--color-error)';

  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}`,
        flexShrink: 0,
      }}
    />
  );
}
