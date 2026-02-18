import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Copy, Check } from "lucide-react"
import { TopBar } from "../components/TopBar"
import { CharacterSelect } from "../components/CharacterSelect"
import type { Character } from "../components/CharacterSelect"
import { useWebRTC } from "../webrtc/useWebRTC"
import { FightingGame } from "../game/FightingGame"
import "./PlayPage.css"

const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL || "ws://localhost:3001"

type PlayPhase =
  | "lobby"
  | "waiting"
  | "connecting"
  | "character-select"
  | "ready"
  | "fighting"

export function PlayPage() {
  const navigate = useNavigate()
  const {
    connectionState,
    roomId,
    isHost,
    error,
    rawMessage,
    createRoom,
    joinRoom,
    sendRaw,
    disconnect,
  } = useWebRTC(SIGNALING_URL)

  const [phase, setPhase] = useState<PlayPhase>("lobby")
  const [joinInput, setJoinInput] = useState("")
  const [copied, setCopied] = useState(false)
  const [localChar, setLocalChar] = useState<Character | null>(null)
  const [remoteChar, setRemoteChar] = useState<Character | null>(null)

  /* ── Sync WebRTC state → phase ── */
  useEffect(() => {
    switch (connectionState) {
      case "connecting":
      case "signaling":
      case "reconnecting":
        setPhase("connecting")
        break
      case "waiting":
        setPhase("waiting")
        break
      case "connected":
        setPhase("character-select")
        break
      case "disconnected":
        if (phase !== "ready" && phase !== "fighting") setPhase("lobby")
        break
    }
  }, [connectionState])

  const handleCopy = async () => {
    if (!roomId) return
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const handleCharacterComplete = useCallback(
    (local: Character, remote: Character) => {
      setLocalChar(local)
      setRemoteChar(remote)
      setPhase("ready")
    },
    [],
  )

  const handleBack = () => {
    disconnect()
    navigate("/select-game")
  }

  const handleCancel = () => {
    disconnect()
    setPhase("lobby")
    setJoinInput("")
  }

  /* ── Auto-transition: ready → fighting ── */
  useEffect(() => {
    if (phase === "ready") {
      const id = setTimeout(() => setPhase("fighting"), 3000)
      return () => clearTimeout(id)
    }
  }, [phase])

  const playerSide = isHost ? "left" : "right"

  return (
    <div className="play-page relative min-h-screen overflow-x-hidden bg-[#07080c] text-white">
      <div className="play-page-bg" />
      <TopBar />

      {/* Back */}
      <div className="absolute top-16 left-5 z-20 md:left-10">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-[11px] font-medium text-white/30 transition-colors hover:text-white/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 pt-20 pb-10">

        {/* ── LOBBY ── */}
        {phase === "lobby" && (
          <div className="play-lobby">
            <div className="play-lobby-header">
              <h2 className="play-lobby-title">Match Lobby</h2>
              <p className="play-lobby-sub">Create a room or join with a code</p>
            </div>

            {error && <div className="play-error">{error}</div>}

            <button className="play-btn-primary" onClick={() => createRoom()}>
              Create Room
            </button>

            <div className="play-divider">
              <div className="play-divider-line" />
              <span className="play-divider-text">or</span>
              <div className="play-divider-line" />
            </div>

            <div className="play-join-row">
              <input
                type="text"
                placeholder="Enter room code"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                maxLength={6}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && joinInput.trim()) joinRoom(joinInput.trim())
                }}
              />
              <button
                className="play-btn-join"
                onClick={() => joinInput.trim() && joinRoom(joinInput.trim())}
                disabled={!joinInput.trim()}
              >
                Join
              </button>
            </div>
          </div>
        )}

        {/* ── WAITING ── */}
        {phase === "waiting" && (
          <div className="play-lobby">
            <div className="play-waiting">
              <span className="play-waiting-badge">Room Created</span>
              <p className="play-waiting-label">Share this code with your opponent</p>
              <div className="play-waiting-code">{roomId}</div>

              <button onClick={handleCopy} className="play-copy-btn">
                {copied ? (
                  <><Check className="h-3 w-3" /> Copied</>
                ) : (
                  <><Copy className="h-3 w-3" /> Copy code</>
                )}
              </button>

              <p className="play-waiting-status">
                Waiting for opponent
                <span className="play-dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </p>

              <div style={{ marginTop: "1.75rem" }}>
                <button className="play-btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CONNECTING ── */}
        {phase === "connecting" && (
          <div className="play-lobby">
            <div className="play-connecting">
              <div className="play-spinner" />
              <h3 className="play-connecting-title">Connecting</h3>
              <p className="play-connecting-sub">Establishing peer-to-peer connection</p>
            </div>
          </div>
        )}

        {/* ── READY ── */}
        {phase === "ready" && (
          <div className="play-ready">
            <h2 className="play-ready-title">Ready to Fight</h2>
            <div className="play-ready-matchup">
              {localChar && (
                <div className="play-ready-fighter">
                  <img
                    src={localChar.portrait}
                    alt={localChar.name}
                    style={{ border: "2px solid #00c8ff" }}
                  />
                  <p className="play-ready-fighter-name" style={{ color: "#00c8ff" }}>
                    {localChar.name}
                  </p>
                  <p className="play-ready-fighter-label">You</p>
                </div>
              )}
              <span className="play-ready-vs">VS</span>
              {remoteChar && (
                <div className="play-ready-fighter">
                  <img
                    src={remoteChar.portrait}
                    alt={remoteChar.name}
                    style={{ border: "2px solid #ff3264" }}
                  />
                  <p className="play-ready-fighter-name" style={{ color: "#ff3264" }}>
                    {remoteChar.name}
                  </p>
                  <p className="play-ready-fighter-label">Opponent</p>
                </div>
              )}
            </div>
            <p className="play-ready-hint">Game will start shortly...</p>
          </div>
        )}
      </div>

      {/* ── FIGHTING ── */}
      {phase === "fighting" && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black">
          <FightingGame
            isHost={isHost}
            sendRaw={sendRaw}
            rawMessage={rawMessage}
          />
        </div>
      )}

      {/* Character selection overlay */}
      <CharacterSelect
        isOpen={phase === "character-select"}
        playerSide={playerSide}
        sendRaw={sendRaw}
        rawMessage={rawMessage}
        onComplete={handleCharacterComplete}
      />
    </div>
  )
}
