import { useEffect, useRef } from 'react'
import type { DataChannelMessage } from '../webrtc/types'
import type { GameResult } from './engine/types'
import type { InputRecorder } from '../zk/InputRecorder'
import { useGameLoop } from './engine/useGameLoop'
import './FightingGame.css'

interface FightingGameProps {
  isHost: boolean
  sendRaw: (data: object) => void
  rawMessage: DataChannelMessage | null
  onGameEnd?: (result: GameResult, p1Health: number, p2Health: number) => void
  inputRecorder?: InputRecorder | null
  /** Character ID for P1 (left side) */
  p1CharacterId?: string
  /** Character ID for P2 (right side) */
  p2CharacterId?: string
}

export function FightingGame({ isHost, sendRaw, rawMessage, onGameEnd, inputRecorder, p1CharacterId, p2CharacterId }: FightingGameProps) {
  const { canvasRef, hud } = useGameLoop({ isHost, sendRaw, rawMessage, onGameEnd, inputRecorder, p1CharacterId, p2CharacterId })

  /* ── Fight music ── */
  const fightMusicRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const music = new Audio("/music/in-game-fight-music.mp3")
    music.loop = true
    music.volume = 0.35
    music.play().catch(() => {})
    fightMusicRef.current = music
    return () => {
      music.pause()
      music.currentTime = 0
    }
  }, [])

  return (
    <div className="fighting-game">
      {/* HUD */}
      <div className="fg-hud">
        <div className="fg-bars fg-bars--p1">
          <div className="fg-health fg-health--p1">
            <div className="fg-health-bg" />
            <div className="fg-health-fill" style={{ width: `${hud.p1Health}%` }} />
          </div>
          <div className="fg-stamina fg-stamina--p1">
            <div className="fg-stamina-bg" />
            <div className="fg-stamina-fill" style={{ width: `${hud.p1Stamina}%` }} />
          </div>
        </div>
        <div className="fg-timer">{hud.timer}</div>
        <div className="fg-bars fg-bars--p2">
          <div className="fg-health fg-health--p2">
            <div className="fg-health-bg" />
            <div className="fg-health-fill" style={{ width: `${hud.p2Health}%` }} />
          </div>
          <div className="fg-stamina fg-stamina--p2">
            <div className="fg-stamina-bg" />
            <div className="fg-stamina-fill" style={{ width: `${hud.p2Stamina}%` }} />
          </div>
        </div>
      </div>

      {/* Player labels */}
      <div className="fg-hud-labels">
        <span className="fg-hud-label">P1{hud.isHost ? ' (You)' : ''}</span>
        <span className="fg-hud-label">P2{!hud.isHost ? ' (You)' : ''}</span>
      </div>

      <canvas ref={canvasRef} />

      {hud.displayText && <div className="fg-display-text">{hud.displayText}</div>}
    </div>
  )
}
