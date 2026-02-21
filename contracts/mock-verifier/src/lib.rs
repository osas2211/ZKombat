#![no_std]

//! Mock Groth16 Verifier for ZKombat
//!
//! This mock accepts all proofs for local testing. In production, the real
//! Circom Groth16 verifier contract performs BN254 pairing checks using
//! Soroban's native host functions (Protocol 25+).

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr},
    Env, Vec,
};

#[derive(Clone)]
#[contracttype]
pub struct Groth16Proof {
    pub a: Bn254G1Affine,
    pub b: Bn254G2Affine,
    pub c: Bn254G1Affine,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Groth16Error {
    InvalidProof = 100,
    MalformedPublicInputs = 101,
    MalformedProof = 102,
    NotInitialized = 103,
}

#[contract]
pub struct MockVerifierContract;

#[contractimpl]
impl MockVerifierContract {
    /// Mock constructor (no VK needed).
    pub fn __constructor(_env: Env) {}

    /// Accept all proofs (mock). Matches the real Groth16 verifier interface.
    pub fn verify(
        _env: Env,
        _proof: Groth16Proof,
        _public_inputs: Vec<Fr>,
    ) -> Result<bool, Groth16Error> {
        Ok(true)
    }
}
