// ZK proof types shared across the frontend

export const MAX_INPUTS = 128

// Must match Circom circuit input arrays
export interface GameInput {
  action: number       // 0=none, 1=punch, 2=block
  timestamp_ms: number // ms since match start
  is_my_action: number // 1=mine, 0=opponent's
  did_hit: number      // 1=landed, 0=missed/input-only
  opponent_blocking: number // 1=opponent was blocking, 0=not
}

// Public inputs visible on-chain (must match circuit public signals order)
export interface ZKPublicInputs {
  input_log_hash: string   // Poseidon hash of input log (field element as decimal string)
  my_final_health: number
  opponent_final_health: number
  i_won: number            // 0=lost, 1=won, 2=draw
}

// Proof submission to send to the contract
export interface ProofSubmission {
  input_hash: Uint8Array       // 32 bytes (Poseidon hash as big-endian)
  my_final_health: number
  opponent_final_health: number
  total_damage_dealt: number
  i_won: number                // 0=lost, 1=won, 2=draw
}

// Result from proof generation
export interface GeneratedProof {
  proofBytes: Uint8Array       // 256 bytes: A(64) || B(128) || C(64)
  publicInputs: ZKPublicInputs
  submission: ProofSubmission
}

export function emptyGameInput(): GameInput {
  return { action: 0, timestamp_ms: 0, is_my_action: 0, did_hit: 0, opponent_blocking: 0 }
}
