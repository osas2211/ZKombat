import { useState, useEffect, useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import type { DataChannelMessage } from "../webrtc/types"
import "./CharacterSelect.css"

/* ── Character data ── */

export interface Character {
  id: string
  name: string
  /** Headshot image for grid thumbnails and portraits */
  portrait: string
}

const CHARACTERS: Character[] = [
  {
    id: "samurai-mack",
    name: "Samurai Mack",
    portrait: "/game/samuraiMack/samuraiMack-headshot.png",
  },
  {
    id: "kenji",
    name: "Kenji",
    portrait: "/game/kenji/kenji-headshot.png",
  },
  {
    id: "dezni",
    name: "Dezni",
    portrait: "/game/dezni/dezni-headshot.png",
  },
  {
    id: "warlock",
    name: "Warlock",
    portrait: "/game/warlock/warlock-headshot.png",
  },
  {
    id: "ronny",
    name: "Ronny",
    portrait: "/game/ronny/ronny-headshot.png",
  },
]

/* ── Props ── */

interface CharacterSelectProps {
  isOpen: boolean
  playerSide: "left" | "right"
  sendRaw: (data: object) => void
  rawMessage: DataChannelMessage | null
  onComplete: (localChar: Character, remoteChar: Character) => void
}

/* ── Component ── */

export function CharacterSelect({
  isOpen,
  playerSide,
  sendRaw,
  rawMessage,
  onComplete,
}: CharacterSelectProps) {
  const [localSelection, setLocalSelection] = useState<string | null>(null)
  const [remoteSelection, setRemoteSelection] = useState<string | null>(null)
  const [localConfirmed, setLocalConfirmed] = useState(false)
  const [remoteConfirmed, setRemoteConfirmed] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)
  const completeCalled = useRef(false)

  /* ── Audio ── */
  const bgMusicRef = useRef<HTMLAudioElement | null>(null)
  const selectSfxRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const bgMusic = new Audio("/music/select-player-screen-music.mp3")
    bgMusic.loop = true
    bgMusic.volume = 0.15
    bgMusic.play().catch(() => {})
    bgMusicRef.current = bgMusic

    selectSfxRef.current = new Audio("/music/on-select-sound.mp3")

    return () => {
      bgMusic.pause()
      bgMusic.currentTime = 0
      bgMusicRef.current = null
    }
  }, [isOpen])

  /* ── Handle incoming WebRTC messages ── */

  useEffect(() => {
    if (!rawMessage) return
    if (rawMessage.type === "character-select") {
      setRemoteSelection(rawMessage.characterId)
    } else if (rawMessage.type === "character-confirmed") {
      setRemoteSelection(rawMessage.characterId)
      setRemoteConfirmed(true)
    }
  }, [rawMessage])

  /* ── Both confirmed → success → callback ── */

  useEffect(() => {
    if (localConfirmed && remoteConfirmed && !completeCalled.current) {
      completeCalled.current = true
      setShowSuccess(true)
      if (bgMusicRef.current) {
        bgMusicRef.current.pause()
        bgMusicRef.current.currentTime = 0
      }
      const lc = CHARACTERS.find((c) => c.id === localSelection)!
      const rc = CHARACTERS.find((c) => c.id === remoteSelection)!
      setTimeout(() => onComplete(lc, rc), 2500)
    }
  }, [localConfirmed, remoteConfirmed, localSelection, remoteSelection, onComplete])

  /* ── GSAP entrance ── */

  useGSAP(
    () => {
      if (!isOpen || !overlayRef.current) return
      const el = overlayRef.current

      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" })
      gsap.fromTo(
        el.querySelector(".cs-title"),
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, delay: 0.15, ease: "power3.out" },
      )
      gsap.fromTo(
        el.querySelectorAll(".cs-cell"),
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, stagger: 0.04, delay: 0.2, ease: "back.out(2)" },
      )
      gsap.fromTo(
        el.querySelectorAll(".cs-portrait-panel"),
        { x: (_i: number, _t: Element, targets: Element[]) => (Array.from(targets).indexOf(_t) === 0 ? -80 : 80), opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, stagger: 0.1, delay: 0.25, ease: "power3.out" },
      )
    },
    { scope: overlayRef, dependencies: [isOpen] },
  )

  if (!isOpen) return null

  /* ── Handlers ── */

  const handleSelect = (id: string) => {
    if (localConfirmed) return
    if (selectSfxRef.current) {
      selectSfxRef.current.currentTime = 0
      selectSfxRef.current.play().catch(() => {})
    }
    setLocalSelection(id)
    const c = CHARACTERS.find((ch) => ch.id === id)!
    sendRaw({ type: "character-select", characterId: c.id, characterName: c.name })
  }

  const handleConfirm = () => {
    if (!localSelection || localConfirmed) return
    setLocalConfirmed(true)
    const c = CHARACTERS.find((ch) => ch.id === localSelection)!
    sendRaw({ type: "character-confirmed", characterId: c.id, characterName: c.name })
  }

  /* ── Derived state ── */

  const localChar = CHARACTERS.find((c) => c.id === localSelection)
  const remoteChar = CHARACTERS.find((c) => c.id === remoteSelection)

  const p1Sel = playerSide === "left" ? localSelection : remoteSelection
  const p2Sel = playerSide === "right" ? localSelection : remoteSelection
  const p1Char = playerSide === "left" ? localChar : remoteChar
  const p2Char = playerSide === "right" ? localChar : remoteChar
  const p1Locked = playerSide === "left" ? localConfirmed : remoteConfirmed
  const p2Locked = playerSide === "right" ? localConfirmed : remoteConfirmed

  const cellClass = (id: string) => {
    const c = ["cs-cell"]
    if (p1Sel === id) c.push("sel-p1")
    if (p2Sel === id) c.push("sel-p2")
    return c.join(" ")
  }

  const statusText = localConfirmed && remoteConfirmed
    ? "Both players ready!"
    : localConfirmed
      ? "Waiting for opponent..."
      : !localSelection
        ? "Select your character"
        : "Press confirm when ready"

  /* ── Success screen ── */

  if (showSuccess) {
    return (
      <div className="cs-success">
        <h1 className="cs-success-title">Get Ready</h1>
        <div className="cs-success-matchup">
          {p1Char && (
            <div className="cs-success-fighter">
              <img src={p1Char.portrait} alt={p1Char.name} style={{ border: "2px solid #00c8ff" }} />
              <p className="cs-success-fighter-name" style={{ color: "#00c8ff" }}>{p1Char.name}</p>
            </div>
          )}
          <span className="cs-success-vs">VS</span>
          {p2Char && (
            <div className="cs-success-fighter">
              <img src={p2Char.portrait} alt={p2Char.name} style={{ border: "2px solid #ff3264" }} />
              <p className="cs-success-fighter-name" style={{ color: "#ff3264" }}>{p2Char.name}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── Main render ── */

  return (
    <div ref={overlayRef} className="cs-overlay">
      {/* Atmospheric background */}
      <div className="cs-bg" />

      {/* Title */}
      <div className="cs-header">
        <h1 className="cs-title">Select Characters</h1>
        <p className="cs-headset-hint">Use headset for better experience</p>
      </div>

      {/* Arena: P1 portrait | Grid | P2 portrait */}
      <div className="cs-arena">
        {/* ── Player 1 (left) ── */}
        <div className="cs-portrait-panel p1">
          <div className={`cs-portrait-img-wrap ${p1Char ? "has-selection" : ""}`}>
            {p1Char && <img src={p1Char.portrait} alt={p1Char.name} />}
            {p1Locked && <span className="cs-locked-badge">Locked</span>}
          </div>
          <div className="cs-name-bar p1">
            <span className="cs-name-bar-label">Player 1</span>
            {p1Char ? (
              <span className="cs-name-bar-name">{p1Char.name}</span>
            ) : (
              <span className="cs-name-bar-empty">-- waiting --</span>
            )}
          </div>
        </div>

        {/* ── Character grid ── */}
        <div className="cs-center">
          <div className="cs-grid">
            {CHARACTERS.map((ch) => (
              <button
                key={ch.id}
                className={cellClass(ch.id)}
                onClick={() => handleSelect(ch.id)}
                disabled={localConfirmed}
              >
                <img src={ch.portrait} alt={ch.name} />
                <span className="cs-cell-name">{ch.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Player 2 (right) ── */}
        <div className="cs-portrait-panel p2">
          <div className={`cs-portrait-img-wrap ${p2Char ? "has-selection" : ""}`}>
            {p2Char && <img src={p2Char.portrait} alt={p2Char.name} />}
            {p2Locked && <span className="cs-locked-badge">Locked</span>}
          </div>
          <div className="cs-name-bar p2">
            <span className="cs-name-bar-label">Player 2</span>
            {p2Char ? (
              <span className="cs-name-bar-name">{p2Char.name}</span>
            ) : (
              <span className="cs-name-bar-empty">-- waiting --</span>
            )}
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className="cs-footer">
        <span className="cs-footer-status">{statusText}</span>
        <button
          className="cs-confirm-btn"
          onClick={handleConfirm}
          disabled={!localSelection || localConfirmed}
          style={{ "--neon-color": localConfirmed ? "#00ff88" : "#00fff0" } as React.CSSProperties}
        >
          {localConfirmed ? "Confirmed" : "Confirm"}
        </button>
      </div>
    </div>
  )
}
