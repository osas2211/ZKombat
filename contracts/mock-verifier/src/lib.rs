#![no_std]

//! Mock UltraHonk Verifier for ZKombat
//!
//! This is a placeholder verifier that accepts all proofs. It exists because
//! the real UltraHonk verifier (indextree/ultrahonk_soroban_contract) uses
//! Arkworks-based BN254 operations that exceed Soroban's 100M CPU instruction
//! limit (~560M required).
//!
//! ZK proofs are still fully generated and verified client-side using NoirJS
//! and Barretenberg WASM. This mock allows the on-chain match flow to proceed
//! while proofs can be verified off-chain by anyone with the verification key.
//!
//! When Soroban gains native BN254 host functions (Protocol 25+), this contract
//! should be replaced with the real UltraHonk verifier.

use soroban_sdk::{contract, contractimpl, symbol_short, Bytes, Env, Symbol};

#[contract]
pub struct MockVerifierContract;

#[contractimpl]
impl MockVerifierContract {
    fn key_vk() -> Symbol {
        symbol_short!("vk")
    }

    /// Store the verification key at deploy time (same interface as real verifier).
    pub fn __constructor(env: Env, vk_bytes: Bytes) {
        env.storage().instance().set(&Self::key_vk(), &vk_bytes);
    }

    /// Accept all proofs (mock). The real verifier would parse the VK and proof,
    /// then perform BN254 pairing checks.
    ///
    /// The function signature matches the real UltraHonk verifier contract.
    pub fn verify_proof(env: Env, public_inputs: Bytes, proof_bytes: Bytes) {
        // Log that we received a proof (for debugging)
        let _ = (&env, &public_inputs, &proof_bytes);
    }

    /// Read the stored VK (for off-chain verification).
    pub fn get_vk(env: Env) -> Bytes {
        env.storage()
            .instance()
            .get(&Self::key_vk())
            .expect("VK not set")
    }
}
