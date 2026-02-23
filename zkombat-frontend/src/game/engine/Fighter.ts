import { GameSprite } from './Sprite'
import { CANVAS_H, GRAVITY, IMG } from './types'
import type { Facing, FighterOpts, SpriteData, SpriteName } from './types'

// ═══════════════════════════════════════════════════════
// FIGHTER CLASS
// ═══════════════════════════════════════════════════════

// Game constants (must match Noir circuit)
export const STARTING_HEALTH = 100
export const STARTING_STAMINA = 100
export const PUNCH_DAMAGE = 20
export const BLOCKED_DAMAGE = 10
export const PUNCH_STAMINA_COST = 15
export const BLOCK_STAMINA_COST = 5
export const STAMINA_REGEN = 3

export class Fighter extends GameSprite {
  velocity: { x: number; y: number }
  lastKey: string | null = null
  attackBox: {
    position: { x: number; y: number }
    offset: { x: number; y: number }
    width: number
    height: number
  }
  isAttacking = false
  isBlocking = false
  health = STARTING_HEALTH
  stamina = STARTING_STAMINA
  sprites: Record<SpriteName, SpriteData>
  dead = false
  nativeFacing: Facing
  flipped = false

  constructor(o: FighterOpts) {
    super({ position: o.position, imageSrc: o.imageSrc, scale: o.scale, framesMax: o.framesMax, offset: o.offset })
    this.nativeFacing = o.nativeFacing
    this.velocity = o.velocity
    this.attackBox = {
      position: { x: this.position.x, y: this.position.y },
      offset: o.attackBox.offset,
      width: o.attackBox.width,
      height: o.attackBox.height,
    }
    this.sprites = {} as Record<SpriteName, SpriteData>
    for (const key of Object.keys(o.sprites) as SpriteName[]) {
      const s = o.sprites[key]
      const img = new Image()
      img.src = s.imageSrc
      this.sprites[key] = { imageSrc: s.imageSrc, framesMax: s.framesMax, image: img }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.flipped) {
      super.draw(ctx)
    } else {
      const frameW = this.image.width / this.framesMax
      const drawX = this.position.x - this.offset.x
      const drawY = this.position.y - this.offset.y
      const drawW = frameW * this.scale
      const drawH = this.image.height * this.scale

      ctx.save()
      ctx.scale(-1, 1)
      ctx.drawImage(
        this.image,
        this.framesCurrent * frameW,
        0,
        frameW,
        this.image.height,
        -(drawX + drawW),
        drawY,
        drawW,
        drawH,
      )
      ctx.restore()
    }
  }

  update(ctx: CanvasRenderingContext2D) {
    this.draw(ctx)
    if (!this.dead) this.animateFrames()

    // Flip attack box offset when sprite is flipped
    if (this.flipped) {
      this.attackBox.position.x = this.position.x - this.attackBox.offset.x - this.attackBox.width
      this.attackBox.position.y = this.position.y + this.attackBox.offset.y
    } else {
      this.attackBox.position.x = this.position.x + this.attackBox.offset.x
      this.attackBox.position.y = this.position.y + this.attackBox.offset.y
    }

    this.position.x += this.velocity.x
    this.position.y += this.velocity.y

    if (this.position.y + this.height + this.velocity.y >= CANVAS_H - 96) {
      this.velocity.y = 0
      this.position.y = 330
    } else {
      this.velocity.y += GRAVITY
    }
  }

  attack() {
    if (this.isBlocking) return // can't attack while blocking
    if (this.stamina < PUNCH_STAMINA_COST) return // not enough stamina
    this.stamina -= PUNCH_STAMINA_COST
    this.switchSprite('attack1')
    this.isAttacking = true
  }

  startBlock() {
    if (this.isAttacking) return
    this.isBlocking = true
  }

  stopBlock() {
    this.isBlocking = false
  }

  takeHit() {
    const dmg = this.isBlocking ? BLOCKED_DAMAGE : PUNCH_DAMAGE
    if (this.isBlocking && this.stamina >= BLOCK_STAMINA_COST) {
      this.stamina -= BLOCK_STAMINA_COST
    }
    this.health -= dmg
    if (this.health <= 0) {
      this.health = 0
      this.switchSprite('death')
    } else {
      this.switchSprite('takeHit')
    }
  }

  regenStamina() {
    if (this.stamina < STARTING_STAMINA) {
      this.stamina = Math.min(this.stamina + STAMINA_REGEN, STARTING_STAMINA)
    }
  }

  switchSprite(name: SpriteName) {
    if (this.image === this.sprites.death.image) {
      if (this.framesCurrent === this.sprites.death.framesMax - 1) this.dead = true
      return
    }
    if (this.image === this.sprites.attack1.image && this.framesCurrent < this.sprites.attack1.framesMax - 1) return
    if (this.image === this.sprites.takeHit.image && this.framesCurrent < this.sprites.takeHit.framesMax - 1) return

    const sp = this.sprites[name]
    if (sp && this.image !== sp.image) {
      this.image = sp.image
      this.framesMax = sp.framesMax
      this.framesCurrent = 0
    }
  }
}

// ═══════════════════════════════════════════════════════
// COLLISION
// ═══════════════════════════════════════════════════════

export function collides(attacker: Fighter, defender: Fighter): boolean {
  return (
    attacker.attackBox.position.x + attacker.attackBox.width >= defender.position.x &&
    attacker.attackBox.position.x <= defender.position.x + defender.width &&
    attacker.attackBox.position.y + attacker.attackBox.height >= defender.position.y &&
    attacker.attackBox.position.y <= defender.position.y + defender.height
  )
}

// ═══════════════════════════════════════════════════════
// FIGHTER CONFIGS (samuraiMack + kenji)
// ═══════════════════════════════════════════════════════

/** Base config for each character (position-independent). */
interface CharacterConfig {
  imageSrc: string
  framesMax: number
  scale: number
  offset: { x: number; y: number }
  sprites: Record<SpriteName, { imageSrc: string; framesMax: number }>
  attackBox: { offset: { x: number; y: number }; width: number; height: number }
  /** Which frame of attack1 registers the hit */
  hitFrame: number
  /** Which direction the sprite art naturally faces */
  nativeFacing: Facing
}

const SAMURAI_MACK_CONFIG: CharacterConfig = {
  imageSrc: `${IMG}/samuraiMack/Idle.png`,
  framesMax: 8,
  scale: 2.5,
  offset: { x: 215, y: 157 },
  sprites: {
    idle: { imageSrc: `${IMG}/samuraiMack/Idle.png`, framesMax: 8 },
    run: { imageSrc: `${IMG}/samuraiMack/Run.png`, framesMax: 8 },
    jump: { imageSrc: `${IMG}/samuraiMack/Jump.png`, framesMax: 2 },
    fall: { imageSrc: `${IMG}/samuraiMack/Fall.png`, framesMax: 2 },
    attack1: { imageSrc: `${IMG}/samuraiMack/Attack1.png`, framesMax: 6 },
    takeHit: { imageSrc: `${IMG}/samuraiMack/Take Hit - white silhouette.png`, framesMax: 4 },
    death: { imageSrc: `${IMG}/samuraiMack/Death.png`, framesMax: 6 },
  },
  attackBox: { offset: { x: 100, y: 50 }, width: 160, height: 50 },
  hitFrame: 4,
  nativeFacing: 'right',
}

const KENJI_CONFIG: CharacterConfig = {
  imageSrc: `${IMG}/kenji/Idle.png`,
  framesMax: 4,
  scale: 2.5,
  offset: { x: 215, y: 167 },
  sprites: {
    idle: { imageSrc: `${IMG}/kenji/Idle.png`, framesMax: 4 },
    run: { imageSrc: `${IMG}/kenji/Run.png`, framesMax: 8 },
    jump: { imageSrc: `${IMG}/kenji/Jump.png`, framesMax: 2 },
    fall: { imageSrc: `${IMG}/kenji/Fall.png`, framesMax: 2 },
    attack1: { imageSrc: `${IMG}/kenji/Attack1.png`, framesMax: 4 },
    takeHit: { imageSrc: `${IMG}/kenji/Take hit.png`, framesMax: 3 },
    death: { imageSrc: `${IMG}/kenji/Death.png`, framesMax: 7 },
  },
  attackBox: { offset: { x: -170, y: 50 }, width: 170, height: 50 },
  hitFrame: 2,
  nativeFacing: 'left',
}

const DEZNI_CONFIG: CharacterConfig = {
  imageSrc: `${IMG}/dezni/Idle.png`,
  framesMax: 10,
  scale: 3.0,
  offset: { x: 215, y: 155 },
  sprites: {
    idle: { imageSrc: `${IMG}/dezni/Idle.png`, framesMax: 10 },
    run: { imageSrc: `${IMG}/dezni/Run.png`, framesMax: 8 },
    jump: { imageSrc: `${IMG}/dezni/Jump.png`, framesMax: 3 },
    fall: { imageSrc: `${IMG}/dezni/Fall.png`, framesMax: 3 },
    attack1: { imageSrc: `${IMG}/dezni/Attack1.png`, framesMax: 7 },
    takeHit: { imageSrc: `${IMG}/dezni/Take hit.png`, framesMax: 3 },
    death: { imageSrc: `${IMG}/dezni/Death.png`, framesMax: 7 },
  },
  attackBox: { offset: { x: 100, y: 50 }, width: 160, height: 50 },
  hitFrame: 4,
  nativeFacing: 'right',
}

const WARLOCK_CONFIG: CharacterConfig = {
  imageSrc: `${IMG}/warlock/Idle.png`,
  framesMax: 8,
  scale: 2.0,
  offset: { x: 215, y: 181 },
  sprites: {
    idle: { imageSrc: `${IMG}/warlock/Idle.png`, framesMax: 8 },
    run: { imageSrc: `${IMG}/warlock/Run.png`, framesMax: 8 },
    jump: { imageSrc: `${IMG}/warlock/Jump.png`, framesMax: 2 },
    fall: { imageSrc: `${IMG}/warlock/Fall.png`, framesMax: 2 },
    attack1: { imageSrc: `${IMG}/warlock/Attack1.png`, framesMax: 8 },
    takeHit: { imageSrc: `${IMG}/warlock/Take hit.png`, framesMax: 3 },
    death: { imageSrc: `${IMG}/warlock/Death.png`, framesMax: 7 },
  },
  attackBox: { offset: { x: 100, y: 50 }, width: 160, height: 50 },
  hitFrame: 5,
  nativeFacing: 'right',
}

const RONNY_CONFIG: CharacterConfig = {
  imageSrc: `${IMG}/ronny/Idle.png`,
  framesMax: 10,
  scale: 2.0,
  offset: { x: 215, y: 5 },
  sprites: {
    idle: { imageSrc: `${IMG}/ronny/Idle.png`, framesMax: 10 },
    run: { imageSrc: `${IMG}/ronny/Run.png`, framesMax: 8 },
    jump: { imageSrc: `${IMG}/ronny/Jump.png`, framesMax: 3 },
    fall: { imageSrc: `${IMG}/ronny/Fall.png`, framesMax: 3 },
    attack1: { imageSrc: `${IMG}/ronny/Attack1.png`, framesMax: 7 },
    takeHit: { imageSrc: `${IMG}/ronny/Take Hit.png`, framesMax: 3 },
    death: { imageSrc: `${IMG}/ronny/Death.png`, framesMax: 11 },
  },
  attackBox: { offset: { x: 100, y: 50 }, width: 160, height: 50 },
  hitFrame: 4,
  nativeFacing: 'right',
}

/** Map character select IDs → fighter configs. Add new fighters here. */
const CHARACTER_CONFIGS: Record<string, CharacterConfig> = {
  'samurai-mack': SAMURAI_MACK_CONFIG,
  'kenji': KENJI_CONFIG,
  'dezni': DEZNI_CONFIG,
  'warlock': WARLOCK_CONFIG,
  'ronny': RONNY_CONFIG,
}

/** Build a FighterOpts for the left-side (P1) position from a character ID. */
export function getP1Config(characterId: string): FighterOpts {
  const cfg = CHARACTER_CONFIGS[characterId] ?? SAMURAI_MACK_CONFIG
  return {
    ...cfg,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    nativeFacing: cfg.nativeFacing,
  }
}

/** Build a FighterOpts for the right-side (P2) position from a character ID. */
export function getP2Config(characterId: string): FighterOpts {
  const cfg = CHARACTER_CONFIGS[characterId] ?? KENJI_CONFIG
  return {
    ...cfg,
    position: { x: 400, y: 100 },
    velocity: { x: 0, y: 0 },
    nativeFacing: cfg.nativeFacing,
  }
}

/** Get the hit frame for a character's attack animation. */
export function getHitFrame(characterId: string): number {
  return (CHARACTER_CONFIGS[characterId] ?? SAMURAI_MACK_CONFIG).hitFrame
}

// Legacy exports for backwards compatibility
export const PLAYER_CONFIG = getP1Config('samurai-mack')
export const ENEMY_CONFIG = getP2Config('kenji')
export const PLAYER_HIT_FRAME = SAMURAI_MACK_CONFIG.hitFrame
export const ENEMY_HIT_FRAME = KENJI_CONFIG.hitFrame
