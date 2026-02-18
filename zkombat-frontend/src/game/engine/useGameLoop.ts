import { useRef, useState, useEffect } from 'react'
import type { DataChannelMessage } from '../../webrtc/types'
import { GameSprite } from './Sprite'
import { Fighter, collides, PLAYER_CONFIG, ENEMY_CONFIG, PLAYER_HIT_FRAME, ENEMY_HIT_FRAME } from './Fighter'
import { CANVAS_W, CANVAS_H, IMG } from './types'
import type { LocalInput, RemoteInput, MoveDir, GameResult } from './types'

// ═══════════════════════════════════════════════════════
// HOOK — manages canvas, game loop, timer, input, network
// ═══════════════════════════════════════════════════════

interface UseGameLoopOpts {
  isHost: boolean
  sendRaw: (data: object) => void
  rawMessage: DataChannelMessage | null
  onGameEnd?: (result: GameResult) => void
}

export interface GameHudState {
  p1Health: number
  p2Health: number
  timer: number
  displayText: string | null
  isHost: boolean
}

export function useGameLoop({ isHost, sendRaw, rawMessage, onGameEnd }: UseGameLoopOpts) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Game objects
  const playerRef = useRef<Fighter | null>(null)
  const enemyRef = useRef<Fighter | null>(null)

  // Loop bookkeeping
  const animRef = useRef(0)
  const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerValRef = useRef(60)
  const gameOverRef = useRef(false)

  // Stable refs for props that change identity
  const isHostRef = useRef(isHost)
  const sendRawRef = useRef(sendRaw)
  const onGameEndRef = useRef(onGameEnd)
  sendRawRef.current = sendRaw
  onGameEndRef.current = onGameEnd

  // Input
  const localRef = useRef<LocalInput>({ left: false, right: false, lastKey: null, jumpC: 0, atkC: 0 })
  const remoteRef = useRef<RemoteInput>({ moveDir: 'none', jumpC: 0, atkC: 0, seenJ: 0, seenA: 0 })

  // HUD (React state — only updates on hit / timer tick / game end)
  const [p1Health, setP1Health] = useState(100)
  const [p2Health, setP2Health] = useState(100)
  const [timer, setTimer] = useState(60)
  const [displayText, setDisplayText] = useState<string | null>(null)

  // ── Initialise engine + start loop ──
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H

    // Scenery
    const bg = new GameSprite({ position: { x: 0, y: 0 }, imageSrc: `${IMG}/background.png` })
    const shop = new GameSprite({ position: { x: 600, y: 128 }, imageSrc: `${IMG}/shop.png`, scale: 2.75, framesMax: 6 })

    // Fighters
    const player = new Fighter(PLAYER_CONFIG)
    const enemy = new Fighter(ENEMY_CONFIG)
    playerRef.current = player
    enemyRef.current = enemy

    // ── End game ──
    function endGame() {
      if (gameOverRef.current) return
      gameOverRef.current = true
      if (timerIdRef.current) clearTimeout(timerIdRef.current)

      let result: GameResult
      let text: string
      if (player.health === enemy.health) { result = 'tie'; text = 'Tie' }
      else if (player.health > enemy.health) { result = 'player1'; text = 'Player 1 Wins' }
      else { result = 'player2'; text = 'Player 2 Wins' }

      setDisplayText(text)
      setTimeout(() => onGameEndRef.current?.(result), 3000)
    }

    // ── Timer ──
    function tick() {
      if (timerValRef.current > 0 && !gameOverRef.current) {
        timerValRef.current--
        setTimer(timerValRef.current)
        timerIdRef.current = setTimeout(tick, 1000)
      }
      if (timerValRef.current === 0) endGame()
    }
    timerIdRef.current = setTimeout(tick, 1000)

    // ── Per-frame loop ──
    function animate() {
      animRef.current = requestAnimationFrame(animate)

      // Draw scene
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      bg.update(ctx)
      shop.update(ctx)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      player.update(ctx)
      enemy.update(ctx)

      // ── Resolve directions ──
      const li = localRef.current
      let localDir: MoveDir = 'none'
      if (li.left && li.lastKey === 'left') localDir = 'left'
      else if (li.right && li.lastKey === 'right') localDir = 'right'
      else if (li.left) localDir = 'left'
      else if (li.right) localDir = 'right'

      const remoteDir = remoteRef.current.moveDir
      const playerDir = isHostRef.current ? localDir : remoteDir
      const enemyDir = isHostRef.current ? remoteDir : localDir

      // Player (samuraiMack) movement
      player.velocity.x = 0
      if (playerDir === 'left') { player.velocity.x = -5; player.switchSprite('run') }
      else if (playerDir === 'right') { player.velocity.x = 5; player.switchSprite('run') }
      else { player.switchSprite('idle') }
      if (player.velocity.y < 0) player.switchSprite('jump')
      else if (player.velocity.y > 0) player.switchSprite('fall')

      // Enemy (kenji) movement
      enemy.velocity.x = 0
      if (enemyDir === 'left') { enemy.velocity.x = -5; enemy.switchSprite('run') }
      else if (enemyDir === 'right') { enemy.velocity.x = 5; enemy.switchSprite('run') }
      else { enemy.switchSprite('idle') }
      if (enemy.velocity.y < 0) enemy.switchSprite('jump')
      else if (enemy.velocity.y > 0) enemy.switchSprite('fall')

      // ── Collision: player → enemy ──
      if (collides(player, enemy) && player.isAttacking && player.framesCurrent === PLAYER_HIT_FRAME) {
        enemy.takeHit()
        player.isAttacking = false
        setP2Health(enemy.health)
      }
      if (player.isAttacking && player.framesCurrent === PLAYER_HIT_FRAME) {
        player.isAttacking = false
      }

      // ── Collision: enemy → player ──
      if (collides(enemy, player) && enemy.isAttacking && enemy.framesCurrent === ENEMY_HIT_FRAME) {
        player.takeHit()
        enemy.isAttacking = false
        setP1Health(player.health)
      }
      if (enemy.isAttacking && enemy.framesCurrent === ENEMY_HIT_FRAME) {
        enemy.isAttacking = false
      }

      // ── End check ──
      if (enemy.health <= 0 || player.health <= 0) endGame()
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animRef.current)
      if (timerIdRef.current) clearTimeout(timerIdRef.current)
    }
  }, [])

  // ── Handle remote input messages ──
  useEffect(() => {
    if (!rawMessage) return
    const msg = rawMessage as unknown as Record<string, unknown>
    if (msg.type !== 'game-input') return

    const ri = remoteRef.current
    ri.moveDir = msg.moveDir as MoveDir

    const remoteFighter = isHostRef.current ? enemyRef.current : playerRef.current
    if (remoteFighter && !remoteFighter.dead) {
      if ((msg.jumpC as number) > ri.seenJ) remoteFighter.velocity.y = -20
      if ((msg.atkC as number) > ri.seenA) remoteFighter.attack()
    }
    ri.seenJ = msg.jumpC as number
    ri.seenA = msg.atkC as number
  }, [rawMessage])

  // ── Keyboard handlers ──
  useEffect(() => {
    function sendInput() {
      const li = localRef.current
      let moveDir: MoveDir = 'none'
      if (li.left && li.lastKey === 'left') moveDir = 'left'
      else if (li.right && li.lastKey === 'right') moveDir = 'right'
      else if (li.left) moveDir = 'left'
      else if (li.right) moveDir = 'right'
      sendRawRef.current({ type: 'game-input', moveDir, jumpC: li.jumpC, atkC: li.atkC })
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (gameOverRef.current) return
      const li = localRef.current
      const lf = isHostRef.current ? playerRef.current : enemyRef.current

      switch (e.key) {
        case 'a': case 'A':
          e.preventDefault(); li.left = true; li.lastKey = 'left'; sendInput(); break
        case 'd': case 'D':
          e.preventDefault(); li.right = true; li.lastKey = 'right'; sendInput(); break
        case 'w': case 'W':
          e.preventDefault()
          if (lf && !lf.dead) lf.velocity.y = -20
          li.jumpC++; sendInput(); break
        case ' ':
          e.preventDefault()
          if (lf && !lf.dead) lf.attack()
          li.atkC++; sendInput(); break
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      const li = localRef.current
      switch (e.key) {
        case 'a': case 'A': li.left = false; sendInput(); break
        case 'd': case 'D': li.right = false; sendInput(); break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const hud: GameHudState = { p1Health, p2Health, timer, displayText, isHost }

  return { canvasRef, hud }
}
