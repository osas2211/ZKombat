import type { GameInput, ZKPublicInputs, GeneratedProof, ProofSubmission } from './types'
import { MAX_INPUTS } from './types'
import { PUNCH_DAMAGE, BLOCKED_DAMAGE } from '../game/engine/Fighter'
import * as snarkjsLib from 'snarkjs'
import { buildPoseidon } from 'circomlibjs'

const CIRCUIT_WASM_PATH = '/zkombat-circuit.wasm'
const CIRCUIT_ZKEY_PATH = '/zkombat.zkey'

/**
 * Generates ZK proofs using snarkjs (Groth16) + circomlibjs (Poseidon) in the browser.
 *
 * Usage:
 *   const gen = new ProofGenerator()
 *   await gen.init()
 *   const proof = await gen.generateProof(inputs, numValid, myHealth, oppHealth)
 */
export class ProofGenerator {
  private snarkjs = snarkjsLib
  private poseidon: any = null
  private poseidonF: any = null
  private initialized = false

  /**
   * Initialize Poseidon hasher. Call once before generating proofs.
   */
  async init() {
    if (this.initialized) return

    this.poseidon = await buildPoseidon()
    this.poseidonF = this.poseidon.F
    this.initialized = true
  }

  /**
   * Compute Poseidon hash chain matching the Circom circuit.
   * Chain: acc = poseidon(acc + f1, f2) for each active input.
   */
  private computeInputLogHash(inputs: GameInput[], numValid: number): bigint {
    let acc = BigInt(0)
    for (let i = 0; i < numValid; i++) {
      const inp = inputs[i]
      const f1 = BigInt(inp.action) * BigInt(10000000) + BigInt(inp.timestamp_ms)
      const f2 = BigInt(inp.is_my_action) * BigInt(100) +
                 BigInt(inp.did_hit) * BigInt(10) +
                 BigInt(inp.opponent_blocking)
      const hash = this.poseidon([acc + f1, f2])
      acc = this.poseidonF.toObject(hash)
    }
    return acc
  }

  /**
   * Generate a Groth16 proof from recorded game inputs.
   */
  async generateProof(
    inputs: GameInput[],
    numValidInputs: number,
    myFinalHealth: number,
    opponentFinalHealth: number,
  ): Promise<GeneratedProof> {
    if (!this.initialized) {
      throw new Error('ProofGenerator not initialized. Call init() first.')
    }

    // Determine winner: 0=lost, 1=won, 2=draw
    let iWon: number
    if (myFinalHealth > opponentFinalHealth) iWon = 1
    else if (myFinalHealth < opponentFinalHealth) iWon = 0
    else iWon = 2

    // Calculate total damage dealt
    let totalDamageDealt = 0
    for (let i = 0; i < numValidInputs; i++) {
      const inp = inputs[i]
      if (inp.action === 1 && inp.is_my_action === 1 && inp.did_hit === 1) {
        totalDamageDealt += inp.opponent_blocking === 1 ? BLOCKED_DAMAGE : PUNCH_DAMAGE
      }
    }

    // Compute Poseidon hash of input log (must match circuit)
    const inputLogHash = this.computeInputLogHash(inputs, numValidInputs)

    // Build circuit input object
    const circuitInput: Record<string, any> = {
      action: inputs.map(inp => inp.action),
      timestamp_ms: inputs.map(inp => inp.timestamp_ms),
      is_my_action: inputs.map(inp => inp.is_my_action),
      did_hit: inputs.map(inp => inp.did_hit),
      opponent_blocking: inputs.map(inp => inp.opponent_blocking),
      num_valid: numValidInputs,
      input_log_hash: inputLogHash.toString(),
      my_final_health: myFinalHealth,
      opponent_final_health: opponentFinalHealth,
      i_won: iWon,
    }

    // Generate proof via snarkjs
    const { proof, publicSignals } = await this.snarkjs.groth16.fullProve(
      circuitInput,
      CIRCUIT_WASM_PATH,
      CIRCUIT_ZKEY_PATH,
    )

    // Convert proof to 256-byte format: A(64) || B(128) || C(64)
    // G1 point: x(32) || y(32)
    // G2 point: x.c1(32) || x.c0(32) || y.c1(32) || y.c0(32)  (Soroban c1||c0 ordering)
    const proofBytes = this.proofToBytes(proof)

    // Public inputs
    const publicInputs: ZKPublicInputs = {
      input_log_hash: publicSignals[0],
      my_final_health: myFinalHealth,
      opponent_final_health: opponentFinalHealth,
      i_won: iWon,
    }

    // Build contract submission data
    const submission: ProofSubmission = {
      input_hash: this.fieldToBytes32(publicSignals[0]),
      my_final_health: myFinalHealth,
      opponent_final_health: opponentFinalHealth,
      total_damage_dealt: totalDamageDealt,
      i_won: iWon,
    }

    return { proofBytes, publicInputs, submission }
  }

  /**
   * Convert snarkjs proof object to 256-byte Uint8Array.
   *
   * Format: A(G1, 64 bytes) || B(G2, 128 bytes) || C(G1, 64 bytes)
   *
   * G2 byte ordering swap: snarkjs gives pi_b[i] = [c0, c1],
   * but Soroban expects c1 || c0 (imaginary first).
   */
  private proofToBytes(proof: any): Uint8Array {
    const result = new Uint8Array(256)

    // A (G1): x || y
    const ax = this.toBE32(proof.pi_a[0])
    const ay = this.toBE32(proof.pi_a[1])
    result.set(ax, 0)
    result.set(ay, 32)

    // B (G2): x.c1 || x.c0 || y.c1 || y.c0  (swap c0/c1)
    const bx_c0 = this.toBE32(proof.pi_b[0][0])
    const bx_c1 = this.toBE32(proof.pi_b[0][1])
    const by_c0 = this.toBE32(proof.pi_b[1][0])
    const by_c1 = this.toBE32(proof.pi_b[1][1])
    result.set(bx_c1, 64)   // x.c1 (imaginary)
    result.set(bx_c0, 96)   // x.c0 (real)
    result.set(by_c1, 128)  // y.c1 (imaginary)
    result.set(by_c0, 160)  // y.c0 (real)

    // C (G1): x || y
    const cx = this.toBE32(proof.pi_c[0])
    const cy = this.toBE32(proof.pi_c[1])
    result.set(cx, 192)
    result.set(cy, 224)

    return result
  }

  /**
   * Convert a decimal string to a 32-byte big-endian Uint8Array.
   */
  private toBE32(decStr: string): Uint8Array {
    let n = BigInt(decStr)
    const buf = new Uint8Array(32)
    for (let i = 31; i >= 0; i--) {
      buf[i] = Number(n & 0xffn)
      n >>= 8n
    }
    return buf
  }

  /**
   * Convert a field element (decimal string) to 32-byte big-endian.
   */
  private fieldToBytes32(decStr: string): Uint8Array {
    return this.toBE32(decStr)
  }

  /**
   * Verify a proof locally using snarkjs (for testing/debugging).
   */
  async verifyProof(publicSignals: string[]): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('ProofGenerator not initialized.')
    }
    const vkRes = await fetch('/zkombat-vk.json')
    const vk = await vkRes.json()
    // Note: need the proof object, not bytes. This is a simplified interface.
    return false // Local verification not typically needed
  }

  destroy() {
    this.initialized = false
    this.poseidon = null
    this.poseidonF = null
  }
}
