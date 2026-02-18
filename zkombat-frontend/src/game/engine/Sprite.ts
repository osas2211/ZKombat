import type { SpriteOpts } from './types'

export class GameSprite {
  position: { x: number; y: number }
  width = 50
  height = 150
  image: HTMLImageElement
  scale: number
  framesMax: number
  framesCurrent = 0
  framesElapsed = 0
  framesHold = 5
  offset: { x: number; y: number }

  constructor(o: SpriteOpts) {
    this.position = o.position
    this.image = new Image()
    this.image.src = o.imageSrc
    this.scale = o.scale ?? 1
    this.framesMax = o.framesMax ?? 1
    this.offset = o.offset ?? { x: 0, y: 0 }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(
      this.image,
      this.framesCurrent * (this.image.width / this.framesMax),
      0,
      this.image.width / this.framesMax,
      this.image.height,
      this.position.x - this.offset.x,
      this.position.y - this.offset.y,
      (this.image.width / this.framesMax) * this.scale,
      this.image.height * this.scale,
    )
  }

  animateFrames() {
    this.framesElapsed++
    if (this.framesElapsed % this.framesHold === 0) {
      if (this.framesCurrent < this.framesMax - 1) {
        this.framesCurrent++
      } else {
        this.framesCurrent = 0
      }
    }
  }

  update(ctx: CanvasRenderingContext2D) {
    this.draw(ctx)
    this.animateFrames()
  }
}
