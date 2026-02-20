import { MAX_INPUTS, emptyGameInput } from './types'
import type { GameInput } from './types'

// Action constants (must match useGameLoop.ts and Noir circuit)
const ACTION_NONE = 0
const ACTION_PUNCH = 1
const ACTION_BLOCK = 2

/**
 * Records game input events during a fight for ZK proof generation.
 * Collects up to MAX_INPUTS entries, zero-pads the rest.
 */
export class InputRecorder {
  private entries: GameInput[] = []
  private startTime = 0
  private started = false

  start() {
    this.entries = []
    this.startTime = performance.now()
    this.started = true
  }

  /**
   * Record a game event.
   * @param action - ACTION_NONE(0), ACTION_PUNCH(1), ACTION_BLOCK(2)
   * @param isMyAction - true if this is the local player's action
   * @param didHit - true if the attack landed (only relevant for punches)
   * @param opponentBlocking - true if the target was blocking when hit
   */
  record(action: number, isMyAction: boolean, didHit: boolean, opponentBlocking: boolean) {
    if (!this.started) return
    if (this.entries.length >= MAX_INPUTS) return

    const timestampMs = Math.floor(performance.now() - this.startTime)

    this.entries.push({
      action,
      timestamp_ms: timestampMs,
      is_my_action: isMyAction ? 1 : 0,
      did_hit: didHit ? 1 : 0,
      opponent_blocking: opponentBlocking ? 1 : 0,
    })
  }

  /**
   * Returns the full input log zero-padded to MAX_INPUTS.
   */
  getInputs(): GameInput[] {
    const padded = [...this.entries]
    while (padded.length < MAX_INPUTS) {
      padded.push(emptyGameInput())
    }
    return padded
  }

  /**
   * Returns the number of real (non-padded) inputs recorded.
   */
  getValidCount(): number {
    return this.entries.length
  }

  stop() {
    this.started = false
  }
}
