import type { GameInput, ZKPublicInputs, GeneratedProof, ProofSubmission } from './types'
import { MAX_INPUTS } from './types'
import { STARTING_HEALTH, PUNCH_DAMAGE, BLOCKED_DAMAGE, PUNCH_STAMINA_COST, BLOCK_STAMINA_COST, STAMINA_REGEN } from '../game/engine/Fighter'

/**
 * Generates ZK proofs using NoirJS + Barretenberg WASM in the browser.
 *
 * Usage:
 *   const gen = new ProofGenerator()
 *   await gen.init()
 *   const proof = await gen.generateProof(inputs, numValid, myHealth, oppHealth)
 */
export class ProofGenerator {
  private noir: any = null
  private backend: any = null
  private initialized = false

  /**
   * Load the compiled circuit and initialize the backend.
   * Call once before generating proofs.
   */
  async init() {
    if (this.initialized) return

    // Dynamic imports to avoid bundling these large WASM modules unless needed
    const [{ Noir }, { UltraHonkBackend }] = await Promise.all([
      import('@noir-lang/noir_js'),
      import('@aztec/bb.js'),
    ])

    // Load compiled circuit artifact from public directory
    const res = await fetch('/zkombat.json')
    if (!res.ok) throw new Error('Failed to load circuit artifact /zkombat.json')
    const circuit = await res.json()

    this.backend = new UltraHonkBackend(circuit)
    this.noir = new Noir(circuit)
    this.initialized = true
  }

  /**
   * Generate a ZK proof from recorded game inputs.
   *
   * @param inputs - Full input log (MAX_INPUTS entries, zero-padded)
   * @param numValidInputs - Number of real entries
   * @param myFinalHealth - Local player's final health
   * @param opponentFinalHealth - Opponent's final health
   * @returns Proof bytes, public inputs, and contract submission data
   */
  async generateProof(
    inputs: GameInput[],
    numValidInputs: number,
    myFinalHealth: number,
    opponentFinalHealth: number,
  ): Promise<GeneratedProof> {
    if (!this.initialized) throw new Error('ProofGenerator not initialized. Call init() first.')

    // Determine winner
    const iWon = myFinalHealth > opponentFinalHealth ? 1 : 0

    // Calculate total damage dealt by simulating from the local player's perspective
    let totalDamageDealt = 0
    for (let i = 0; i < numValidInputs; i++) {
      const inp = inputs[i]
      if (inp.action === 1 && inp.is_my_action === 1 && inp.did_hit === 1) {
        totalDamageDealt += inp.opponent_blocking === 1 ? BLOCKED_DAMAGE : PUNCH_DAMAGE
      }
    }

    // Prepare circuit inputs
    // The circuit expects arrays of field elements
    const circuitInputs = {
      inputs: inputs.map(inp => ({
        action: inp.action,
        timestamp_ms: inp.timestamp_ms,
        is_my_action: inp.is_my_action,
        did_hit: inp.did_hit,
        opponent_blocking: inp.opponent_blocking,
      })),
      num_valid_inputs: numValidInputs,
      // Public inputs
      input_log_hash: 0, // Will be computed by the circuit (witness generation)
      my_final_health: myFinalHealth,
      opponent_final_health: opponentFinalHealth,
      i_won: iWon,
    }

    // Generate witness (executes the circuit, computes intermediate values)
    const { witness } = await this.noir.execute(circuitInputs)

    // Generate proof
    const proof = await this.backend.generateProof(witness)

    // Extract public inputs from the proof
    const publicInputs: ZKPublicInputs = {
      input_log_hash: proof.publicInputs[0],
      my_final_health: myFinalHealth,
      opponent_final_health: opponentFinalHealth,
      i_won: iWon,
    }

    // Build contract submission
    const submission: ProofSubmission = {
      input_hash: hexToBytes(proof.publicInputs[0]),
      my_final_health: myFinalHealth,
      opponent_final_health: opponentFinalHealth,
      total_damage_dealt: totalDamageDealt,
      i_won: iWon === 1,
    }

    return {
      proofBytes: proof.proof,
      publicInputs,
      submission,
    }
  }

  /**
   * Verify a proof locally (for testing/debugging).
   */
  async verifyProof(proofBytes: Uint8Array, publicInputs: string[]): Promise<boolean> {
    if (!this.initialized) throw new Error('ProofGenerator not initialized.')
    return this.backend.verifyProof({ proof: proofBytes, publicInputs })
  }

  destroy() {
    this.backend?.destroy?.()
    this.initialized = false
    this.noir = null
    this.backend = null
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const padded = clean.padStart(64, '0')
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
