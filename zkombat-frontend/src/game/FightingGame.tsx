import type { DataChannelMessage } from '../webrtc/types'
import type { GameResult } from './engine/types'
import { useGameLoop } from './engine/useGameLoop'
import './FightingGame.css'

interface FightingGameProps {
  isHost: boolean
  sendRaw: (data: object) => void
  rawMessage: DataChannelMessage | null
  onGameEnd?: (result: GameResult) => void
}

export function FightingGame({ isHost, sendRaw, rawMessage, onGameEnd }: FightingGameProps) {
  const { canvasRef, hud } = useGameLoop({ isHost, sendRaw, rawMessage, onGameEnd })

  return (
    <div className="fighting-game">
      {/* HUD */}
      <div className="fg-hud">
        <div className="fg-health fg-health--p1">
          <div className="fg-health-bg" />
          <div className="fg-health-fill" style={{ width: `${hud.p1Health}%` }} />
        </div>
        <div className="fg-timer">{hud.timer}</div>
        <div className="fg-health fg-health--p2">
          <div className="fg-health-bg" />
          <div className="fg-health-fill" style={{ width: `${hud.p2Health}%` }} />
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
