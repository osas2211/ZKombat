import { GameSprite } from './Sprite'
import { CANVAS_H, GRAVITY, IMG } from './types'
import type { FighterOpts, SpriteData, SpriteName } from './types'

// ═══════════════════════════════════════════════════════
// FIGHTER CLASS
// ═══════════════════════════════════════════════════════

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
  health = 100
  sprites: Record<SpriteName, SpriteData>
  dead = false

  constructor(o: FighterOpts) {
    super({ position: o.position, imageSrc: o.imageSrc, scale: o.scale, framesMax: o.framesMax, offset: o.offset })
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

  update(ctx: CanvasRenderingContext2D) {
    this.draw(ctx)
    if (!this.dead) this.animateFrames()

    this.attackBox.position.x = this.position.x + this.attackBox.offset.x
    this.attackBox.position.y = this.position.y + this.attackBox.offset.y

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
    this.switchSprite('attack1')
    this.isAttacking = true
  }

  takeHit() {
    this.health -= 20
    if (this.health <= 0) {
      this.switchSprite('death')
    } else {
      this.switchSprite('takeHit')
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

export const PLAYER_CONFIG: FighterOpts = {
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
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
}

export const ENEMY_CONFIG: FighterOpts = {
  position: { x: 400, y: 100 },
  velocity: { x: 0, y: 0 },
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
}

/** Hit-frame for each fighter's attack animation */
export const PLAYER_HIT_FRAME = 4
export const ENEMY_HIT_FRAME = 2
