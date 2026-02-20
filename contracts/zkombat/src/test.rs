#![cfg(test)]

use crate::{
    Error, GameMatch, LeaderboardEntry, MatchStatus, PlayerStats, PointConfig, ProofSubmission,
    ZkombatContract, ZkombatContractClient,
};
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env, Vec};

// ============================================================================
// Mock GameHub
// ============================================================================

#[contract]
pub struct MockGameHub;

#[contractimpl]
impl MockGameHub {
    pub fn start_game(
        _env: Env,
        _game_id: Address,
        _session_id: u32,
        _player1: Address,
        _player2: Address,
        _player1_points: i128,
        _player2_points: i128,
    ) {
    }

    pub fn end_game(_env: Env, _session_id: u32, _player1_won: bool) {}

    pub fn add_game(_env: Env, _game_address: Address) {}
}

// ============================================================================
// Mock Verifier (always accepts proofs)
// ============================================================================

#[contract]
pub struct MockVerifier;

#[contractimpl]
impl MockVerifier {
    pub fn verify_proof(_env: Env, _public_inputs: Bytes, _proof_bytes: Bytes) {
        // Mock: always succeeds (doesn't panic)
    }
}

// ============================================================================
// Mock Verifier that rejects proofs
// ============================================================================

#[contract]
pub struct RejectingVerifier;

#[contractimpl]
impl RejectingVerifier {
    pub fn verify_proof(_env: Env, _public_inputs: Bytes, _proof_bytes: Bytes) {
        panic!("Invalid proof");
    }
}

// ============================================================================
// Test Helpers
// ============================================================================

fn setup_test() -> (
    Env,
    ZkombatContractClient<'static>,
    Address,
    Address,
    Address, // admin
) {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: 1441065600,
        protocol_version: 25,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: u32::MAX / 2,
        min_persistent_entry_ttl: u32::MAX / 2,
        max_entry_ttl: u32::MAX / 2,
    });

    let hub_addr = env.register(MockGameHub, ());
    let verifier_addr = env.register(MockVerifier, ());
    let admin = Address::generate(&env);
    let contract_id = env.register(ZkombatContract, (&admin, &hub_addr, &verifier_addr));
    let client = ZkombatContractClient::new(&env, &contract_id);

    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);

    (env, client, player1, player2, admin)
}

fn dummy_proof_bytes(env: &Env) -> Bytes {
    Bytes::from_array(env, &[0u8; 32])
}

fn dummy_public_inputs(env: &Env) -> Bytes {
    Bytes::from_array(env, &[0u8; 32])
}

fn dummy_input_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[1u8; 32])
}

fn assert_zkombat_error<T, E>(
    result: &Result<Result<T, E>, Result<Error, soroban_sdk::InvokeError>>,
    expected_error: Error,
) {
    match result {
        Err(Ok(actual_error)) => {
            assert_eq!(
                *actual_error, expected_error,
                "Expected {:?}, got {:?}",
                expected_error, actual_error
            );
        }
        Err(Err(_)) => {
            panic!("Expected {:?}, got invocation error", expected_error);
        }
        Ok(_) => {
            panic!("Expected {:?}, but operation succeeded", expected_error);
        }
    }
}

// ============================================================================
// Basic Match Flow Tests
// ============================================================================

#[test]
fn test_create_match() {
    let (_env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    let game = client.get_match(&1u32);
    assert_eq!(game.player1, player1);
    assert_eq!(game.player2, player2);
    assert_eq!(game.status, MatchStatus::Active);
    assert!(game.p1_proof.is_none());
    assert!(game.p2_proof.is_none());
    assert!(game.winner.is_none());
}

#[test]
fn test_full_match_flow_p1_wins() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // Player 1 submits proof: won with 60 health, opponent at 0
    client.submit_proof(
        &1u32,
        &player1,
        &dummy_proof_bytes(&env),
        &dummy_public_inputs(&env),
        &dummy_input_hash(&env),
        &60u32,
        &0u32,
        &100u32,
        &true,
    );

    let game = client.get_match(&1u32);
    assert_eq!(game.status, MatchStatus::ProofPhase);
    assert!(game.p1_proof.is_some());
    assert!(game.p2_proof.is_none());

    // Player 2 submits proof: lost with 0 health, opponent at 60
    client.submit_proof(
        &1u32,
        &player2,
        &dummy_proof_bytes(&env),
        &dummy_public_inputs(&env),
        &dummy_input_hash(&env),
        &0u32,
        &60u32,
        &40u32,
        &false,
    );

    let game = client.get_match(&1u32);
    assert_eq!(game.status, MatchStatus::Resolved);
    assert_eq!(game.winner, Some(player1.clone()));

    // Check stats
    let p1_stats = client.get_player_stats(&player1);
    assert_eq!(p1_stats.wins, 1);
    assert_eq!(p1_stats.losses, 0);
    assert_eq!(p1_stats.total_matches, 1);
    assert!(p1_stats.total_points >= 100); // win + potential streak

    let p2_stats = client.get_player_stats(&player2);
    assert_eq!(p2_stats.wins, 0);
    assert_eq!(p2_stats.losses, 1);
    assert_eq!(p2_stats.total_points, 10); // loss points
}

#[test]
fn test_full_match_flow_p2_wins() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // Player 1: lost with 0 health
    client.submit_proof(
        &1u32,
        &player1,
        &dummy_proof_bytes(&env),
        &dummy_public_inputs(&env),
        &dummy_input_hash(&env),
        &0u32,
        &80u32,
        &20u32,
        &false,
    );

    // Player 2: won with 80 health
    client.submit_proof(
        &1u32,
        &player2,
        &dummy_proof_bytes(&env),
        &dummy_public_inputs(&env),
        &dummy_input_hash(&env),
        &80u32,
        &0u32,
        &100u32,
        &true,
    );

    let game = client.get_match(&1u32);
    assert_eq!(game.status, MatchStatus::Resolved);
    assert_eq!(game.winner, Some(player2.clone()));
}

#[test]
fn test_draw() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // Both end with 40 health
    client.submit_proof(
        &1u32,
        &player1,
        &dummy_proof_bytes(&env),
        &dummy_public_inputs(&env),
        &dummy_input_hash(&env),
        &40u32,
        &40u32,
        &60u32,
        &false,
    );

    client.submit_proof(
        &1u32,
        &player2,
        &dummy_proof_bytes(&env),
        &dummy_public_inputs(&env),
        &dummy_input_hash(&env),
        &40u32,
        &40u32,
        &60u32,
        &false,
    );

    let game = client.get_match(&1u32);
    assert_eq!(game.status, MatchStatus::Draw);
    assert!(game.winner.is_none());

    let p1_stats = client.get_player_stats(&player1);
    assert_eq!(p1_stats.draws, 1);
    assert_eq!(p1_stats.total_points, 30); // draw points
}

// ============================================================================
// Points & Bonus Tests
// ============================================================================

#[test]
fn test_perfect_win_bonus() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // Perfect win: player1 at 100 health (untouched)
    client.submit_proof(
        &1u32,
        &player1,
        &dummy_proof_bytes(&env),
        &dummy_public_inputs(&env),
        &dummy_input_hash(&env),
        &100u32, // perfect - full health
        &0u32,
        &100u32,
        &true,
    );

    client.submit_proof(
        &1u32,
        &player2,
        &dummy_proof_bytes(&env),
        &dummy_public_inputs(&env),
        &dummy_input_hash(&env),
        &0u32,
        &100u32,
        &0u32,
        &false,
    );

    let stats = client.get_player_stats(&player1);
    assert_eq!(stats.perfect_wins, 1);
    // 100 (win) + 50 (perfect) + 10 (streak=1) = 160
    assert_eq!(stats.total_points, 160);
}

#[test]
fn test_comeback_win_bonus() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // Comeback win: player1 at 20 health (barely survived)
    client.submit_proof(
        &1u32,
        &player1,
        &dummy_proof_bytes(&env),
        &dummy_public_inputs(&env),
        &dummy_input_hash(&env),
        &20u32, // comeback threshold
        &0u32,
        &100u32,
        &true,
    );

    client.submit_proof(
        &1u32,
        &player2,
        &dummy_proof_bytes(&env),
        &dummy_public_inputs(&env),
        &dummy_input_hash(&env),
        &0u32,
        &20u32,
        &80u32,
        &false,
    );

    let stats = client.get_player_stats(&player1);
    assert_eq!(stats.comeback_wins, 1);
    // 100 (win) + 30 (comeback) + 10 (streak=1) = 140
    assert_eq!(stats.total_points, 140);
}

#[test]
fn test_win_streak_bonus() {
    let (env, client, player1, player2, _admin) = setup_test();

    // Win 3 matches in a row
    for session in 1u32..=3 {
        client.create_match(&session, &player1, &player2, &100_0000000, &100_0000000);

        client.submit_proof(
            &session,
            &player1,
            &dummy_proof_bytes(&env),
            &dummy_public_inputs(&env),
            &dummy_input_hash(&env),
            &60u32,
            &0u32,
            &100u32,
            &true,
        );

        client.submit_proof(
            &session,
            &player2,
            &dummy_proof_bytes(&env),
            &dummy_public_inputs(&env),
            &dummy_input_hash(&env),
            &0u32,
            &60u32,
            &40u32,
            &false,
        );
    }

    let stats = client.get_player_stats(&player1);
    assert_eq!(stats.wins, 3);
    assert_eq!(stats.win_streak, 3);
    assert_eq!(stats.best_streak, 3);
    // Match 1: 100 + 10*1 = 110
    // Match 2: 100 + 10*2 = 120
    // Match 3: 100 + 10*3 = 130
    // Total: 360
    assert_eq!(stats.total_points, 360);
}

#[test]
fn test_streak_resets_on_loss() {
    let (env, client, player1, player2, _admin) = setup_test();

    // Win 2 matches
    for session in 1u32..=2 {
        client.create_match(&session, &player1, &player2, &100_0000000, &100_0000000);
        client.submit_proof(
            &session, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
            &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
        );
        client.submit_proof(
            &session, &player2, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
            &dummy_input_hash(&env), &0u32, &60u32, &40u32, &false,
        );
    }

    let stats = client.get_player_stats(&player1);
    assert_eq!(stats.win_streak, 2);

    // Lose match 3
    client.create_match(&3u32, &player1, &player2, &100_0000000, &100_0000000);
    client.submit_proof(
        &3u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &0u32, &60u32, &40u32, &false,
    );
    client.submit_proof(
        &3u32, &player2, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );

    let stats = client.get_player_stats(&player1);
    assert_eq!(stats.win_streak, 0);
    assert_eq!(stats.best_streak, 2);
}

// ============================================================================
// Error Handling Tests
// ============================================================================

#[test]
fn test_self_play_rejected() {
    let (_env, client, player1, _player2, _admin) = setup_test();

    let result = client.try_create_match(&1u32, &player1, &player1, &100_0000000, &100_0000000);
    assert_zkombat_error(&result, Error::SelfPlay);
}

#[test]
fn test_cannot_submit_proof_twice() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    client.submit_proof(
        &1u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );

    let result = client.try_submit_proof(
        &1u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );
    assert_zkombat_error(&result, Error::ProofAlreadySubmitted);
}

#[test]
fn test_non_player_cannot_submit() {
    let (env, client, player1, player2, _admin) = setup_test();
    let outsider = Address::generate(&env);

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    let result = client.try_submit_proof(
        &1u32, &outsider, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );
    assert_zkombat_error(&result, Error::NotPlayer);
}

#[test]
fn test_cannot_submit_to_resolved_match() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // Resolve the match
    client.submit_proof(
        &1u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );
    client.submit_proof(
        &1u32, &player2, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &0u32, &60u32, &40u32, &false,
    );

    // Try submitting again
    let result = client.try_submit_proof(
        &1u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );
    assert_zkombat_error(&result, Error::MatchAlreadyEnded);
}

#[test]
fn test_match_not_found() {
    let (_env, client, _player1, _player2, _admin) = setup_test();

    let result = client.try_get_match(&999u32);
    assert_zkombat_error(&result, Error::MatchNotFound);
}

// ============================================================================
// Forfeit Tests
// ============================================================================

#[test]
fn test_forfeit_after_timeout() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // Player 1 submits proof
    client.submit_proof(
        &1u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );

    // Advance ledger past timeout
    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: 1441065600 + 3600,
        protocol_version: 25,
        sequence_number: 100 + 721, // Past PROOF_TIMEOUT_LEDGERS (720)
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: u32::MAX / 2,
        min_persistent_entry_ttl: u32::MAX / 2,
        max_entry_ttl: u32::MAX / 2,
    });

    let winner = client.claim_forfeit(&1u32, &player1);
    assert_eq!(winner, player1);

    let game = client.get_match(&1u32);
    assert_eq!(game.status, MatchStatus::Forfeit);
    assert_eq!(game.winner, Some(player1.clone()));

    // Check forfeit points
    let stats = client.get_player_stats(&player1);
    assert_eq!(stats.total_points, 75); // forfeit_win_points
}

#[test]
fn test_cannot_forfeit_before_timeout() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    client.submit_proof(
        &1u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );

    // Don't advance ledger
    let result = client.try_claim_forfeit(&1u32, &player1);
    assert_zkombat_error(&result, Error::ForfeitNotAllowed);
}

#[test]
fn test_cannot_forfeit_if_not_submitted() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // Player 1 submits proof
    client.submit_proof(
        &1u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );

    // Advance past timeout
    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: 1441065600 + 3600,
        protocol_version: 25,
        sequence_number: 100 + 721,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: u32::MAX / 2,
        min_persistent_entry_ttl: u32::MAX / 2,
        max_entry_ttl: u32::MAX / 2,
    });

    // Player 2 (who didn't submit) tries to claim forfeit
    let result = client.try_claim_forfeit(&1u32, &player2);
    assert_zkombat_error(&result, Error::ForfeitNotAllowed);
}

#[test]
fn test_cannot_forfeit_active_match() {
    let (_env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // No proofs submitted yet (still Active, not ProofPhase)
    let result = client.try_claim_forfeit(&1u32, &player1);
    assert_zkombat_error(&result, Error::ForfeitNotAllowed);
}

// ============================================================================
// Cross-Validation Tests
// ============================================================================

#[test]
fn test_cross_validation_agrees() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // P1: my_health=60, opp_health=0
    // P2: my_health=0, opp_health=60
    // Perfect agreement
    client.submit_proof(
        &1u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );
    client.submit_proof(
        &1u32, &player2, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &0u32, &60u32, &40u32, &false,
    );

    let game = client.get_match(&1u32);
    assert_eq!(game.winner, Some(player1));
}

#[test]
fn test_cross_validation_disagrees_uses_my_health() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    // Disagreement: P1 says opp has 20 health, P2 says they have 40
    // But each player's ZK proof validates their OWN health calc
    // So we trust my_final_health from each player
    client.submit_proof(
        &1u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &20u32, &80u32, &true,
    );
    client.submit_proof(
        &1u32, &player2, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &40u32, &50u32, &60u32, &false,
    );

    let game = client.get_match(&1u32);
    // P1 health (60) > P2 health (40), so P1 wins
    assert_eq!(game.winner, Some(player1));
}

// ============================================================================
// Leaderboard Tests
// ============================================================================

#[test]
fn test_leaderboard_updates() {
    let (env, client, player1, player2, _admin) = setup_test();

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);

    client.submit_proof(
        &1u32, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );
    client.submit_proof(
        &1u32, &player2, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &0u32, &60u32, &40u32, &false,
    );

    let lb = client.get_leaderboard();
    assert!(lb.len() > 0);

    // Player1 should be ranked higher (more points)
    let first = lb.get(0).unwrap();
    assert_eq!(first.player, player1);
}

#[test]
fn test_leaderboard_sorted() {
    let (env, client, player1, player2, _admin) = setup_test();
    let player3 = Address::generate(&env);

    // Player1 wins 2 matches
    for session in 1u32..=2 {
        client.create_match(&session, &player1, &player2, &100_0000000, &100_0000000);
        client.submit_proof(
            &session, &player1, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
            &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
        );
        client.submit_proof(
            &session, &player2, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
            &dummy_input_hash(&env), &0u32, &60u32, &40u32, &false,
        );
    }

    // Player3 wins 1 match
    client.create_match(&3u32, &player3, &player2, &100_0000000, &100_0000000);
    client.submit_proof(
        &3u32, &player3, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &60u32, &0u32, &100u32, &true,
    );
    client.submit_proof(
        &3u32, &player2, &dummy_proof_bytes(&env), &dummy_public_inputs(&env),
        &dummy_input_hash(&env), &0u32, &60u32, &40u32, &false,
    );

    let lb = client.get_leaderboard();
    // Player1 has more points (2 wins) than Player3 (1 win)
    let first = lb.get(0).unwrap();
    assert_eq!(first.player, player1);
}

// ============================================================================
// Multiple Sessions Test
// ============================================================================

#[test]
fn test_multiple_independent_sessions() {
    let (env, client, player1, player2, _admin) = setup_test();
    let player3 = Address::generate(&env);
    let player4 = Address::generate(&env);

    client.create_match(&1u32, &player1, &player2, &100_0000000, &100_0000000);
    client.create_match(&2u32, &player3, &player4, &50_0000000, &50_0000000);

    let game1 = client.get_match(&1u32);
    let game2 = client.get_match(&2u32);
    assert_eq!(game1.player1, player1);
    assert_eq!(game2.player1, player3);
    assert_eq!(game1.status, MatchStatus::Active);
    assert_eq!(game2.status, MatchStatus::Active);
}

// ============================================================================
// Admin Tests
// ============================================================================

#[test]
fn test_admin_functions() {
    let (env, client, _player1, _player2, admin) = setup_test();

    assert_eq!(client.get_admin(), admin);

    let new_admin = Address::generate(&env);
    client.set_admin(&new_admin);
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_set_verifier() {
    let (env, client, _player1, _player2, _admin) = setup_test();

    let new_verifier = Address::generate(&env);
    client.set_verifier(&new_verifier);
    assert_eq!(client.get_verifier(), new_verifier);
}

#[test]
fn test_set_point_config() {
    let (_env, client, _player1, _player2, _admin) = setup_test();

    let config = PointConfig {
        win_points: 200,
        perfect_bonus: 100,
        comeback_bonus: 60,
        streak_bonus_per_level: 20,
        max_streak_bonus_levels: 10,
        loss_points: 20,
        draw_points: 50,
        forfeit_win_points: 150,
        starting_health: 100,
        comeback_threshold: 25,
    };

    client.set_point_config(&config);
    let saved = client.get_point_config();
    assert_eq!(saved.win_points, 200);
    assert_eq!(saved.perfect_bonus, 100);
}

#[test]
fn test_default_player_stats() {
    let (env, client, _player1, _player2, _admin) = setup_test();

    let new_player = Address::generate(&env);
    let stats = client.get_player_stats(&new_player);
    assert_eq!(stats.wins, 0);
    assert_eq!(stats.losses, 0);
    assert_eq!(stats.total_points, 0);
    assert_eq!(stats.total_matches, 0);
}

#[test]
fn test_upgrade_exists() {
    let (env, client, _player1, _player2, _admin) = setup_test();

    let new_wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
    let result = client.try_upgrade(&new_wasm_hash);
    // Will fail because WASM doesn't exist, but confirms function signature works
    assert!(result.is_err());
}
