// ═══════════════════════════════════════════════════════
// Shared types & constants for the fighting-game engine
// ═══════════════════════════════════════════════════════

export const CANVAS_W = 1024
export const CANVAS_H = 576
export const GRAVITY = 0.7
export const IMG = '/game'

export type SpriteName = 'idle' | 'run' | 'jump' | 'fall' | 'attack1' | 'takeHit' | 'death'

export interface SpriteOpts {
  position: { x: number; y: number }
  imageSrc: string
  scale?: number
  framesMax?: number
  offset?: { x: number; y: number }
}

export interface SpriteData {
  imageSrc: string
  framesMax: number
  image: HTMLImageElement
}

export interface FighterOpts {
  position: { x: number; y: number }
  velocity: { x: number; y: number }
  imageSrc: string
  scale?: number
  framesMax?: number
  offset?: { x: number; y: number }
  sprites: Record<SpriteName, { imageSrc: string; framesMax: number }>
  attackBox: { offset: { x: number; y: number }; width: number; height: number }
}

export type MoveDir = 'left' | 'right' | 'none'

export interface LocalInput {
  left: boolean
  right: boolean
  lastKey: 'left' | 'right' | null
  jumpC: number
  atkC: number
}

export interface RemoteInput {
  moveDir: MoveDir
  jumpC: number
  atkC: number
  seenJ: number
  seenA: number
}

export type GameResult = 'player1' | 'player2' | 'tie'
