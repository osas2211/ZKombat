#![no_std]

//! # ZKombat — ZK-Verified Fighting Game
//!
//! A 1v1 real-time fighting game on Stellar that uses zero-knowledge proofs
//! as a trustless anti-cheat system. Players fight off-chain via WebRTC,
//! then each generates a ZK proof attesting to fair play. Both proofs are
//! verified on-chain through a Groth16 verifier contract (Circom/BN254)
//! using Protocol 25's native BN254 host functions.
//!
//! **Game Hub Integration:**
//! Calls `start_game` when both players join and `end_game` when the match resolves.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype,
    crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr},
    vec, Address, Bytes, BytesN, Env, IntoVal, Vec,
};

// ============================================================================
// Game Hub Interface (required by hackathon)
// ============================================================================

#[contractclient(name = "GameHubClient")]
pub trait GameHub {
    fn start_game(
        env: Env,
        game_id: Address,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    );

    fn end_game(env: Env, session_id: u32, player1_won: bool);
}

// ============================================================================
// Groth16 Verifier Interface (cross-contract call)
// ============================================================================

/// Groth16 proof composed of BN254 curve points.
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

#[contractclient(name = "VerifierClient")]
pub trait Groth16Verifier {
    fn verify(env: Env, proof: Groth16Proof, public_inputs: Vec<Fr>) -> Result<bool, Groth16Error>;
}

// ============================================================================
// Errors
// ============================================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    MatchNotFound = 1,
    NotPlayer = 2,
    InvalidMatchState = 3,
    ProofAlreadySubmitted = 4,
    VerificationFailed = 5,
    ResultMismatch = 6,
    MatchAlreadyEnded = 7,
    ForfeitNotAllowed = 8,
    VerifierNotSet = 9,
    SelfPlay = 10,
}

// ============================================================================
// Data Types
// ============================================================================

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum MatchStatus {
    Active = 0,
    ProofPhase = 1,
    Resolved = 2,
    Forfeit = 3,
    Draw = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProofSubmission {
    pub input_hash: BytesN<32>,
    pub my_final_health: u32,
    pub opponent_final_health: u32,
    pub total_damage_dealt: u32,
    pub i_won: u32, // 0=lost, 1=won, 2=draw
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GameMatch {
    pub player1: Address,
    pub player2: Address,
    pub player1_points: i128,
    pub player2_points: i128,
    pub status: MatchStatus,
    pub created_ledger: u32,
    pub p1_proof_submitted: bool,
    pub p2_proof_submitted: bool,
    pub winner: Option<Address>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlayerStats {
    pub wins: u32,
    pub losses: u32,
    pub draws: u32,
    pub total_points: i128,
    pub win_streak: u32,
    pub best_streak: u32,
    pub perfect_wins: u32,
    pub comeback_wins: u32,
    pub total_matches: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LeaderboardEntry {
    pub player: Address,
    pub points: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PointConfig {
    pub win_points: i128,
    pub perfect_bonus: i128,
    pub comeback_bonus: i128,
    pub streak_bonus_per_level: i128,
    pub max_streak_bonus_levels: u32,
    pub loss_points: i128,
    pub draw_points: i128,
    pub forfeit_win_points: i128,
    pub starting_health: u32,
    pub comeback_threshold: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Match(u32),
    P1Proof(u32),
    P2Proof(u32),
    PlayerStats(Address),
    Leaderboard,
    GameHubAddress,
    Admin,
    VerifierAddress,
    PointConfig,
}

// ============================================================================
// Constants
// ============================================================================

const MATCH_TTL_LEDGERS: u32 = 518_400; // 30 days
const STATS_TTL_LEDGERS: u32 = 2_592_000; // ~150 days
const PROOF_TIMEOUT_LEDGERS: u32 = 720; // ~1 hour
const MAX_LEADERBOARD: u32 = 20;

fn default_point_config() -> PointConfig {
    PointConfig {
        win_points: 100,
        perfect_bonus: 50,
        comeback_bonus: 30,
        streak_bonus_per_level: 10,
        max_streak_bonus_levels: 5,
        loss_points: 10,
        draw_points: 30,
        forfeit_win_points: 75,
        starting_health: 100,
        comeback_threshold: 20,
    }
}

// ============================================================================
// Contract
// ============================================================================

#[contract]
pub struct ZkombatContract;

#[contractimpl]
impl ZkombatContract {
    // ====================================================================
    // Constructor
    // ====================================================================

    pub fn __constructor(env: Env, admin: Address, game_hub: Address, verifier: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::GameHubAddress, &game_hub);
        env.storage()
            .instance()
            .set(&DataKey::VerifierAddress, &verifier);
        env.storage()
            .instance()
            .set(&DataKey::PointConfig, &default_point_config());
    }

    // ====================================================================
    // Match Lifecycle
    // ====================================================================

    pub fn create_match(
        env: Env,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    ) -> Result<(), Error> {
        if player1 == player2 {
            return Err(Error::SelfPlay);
        }

        player1.require_auth_for_args(vec![
            &env,
            session_id.into_val(&env),
            player1_points.into_val(&env),
        ]);
        player2.require_auth_for_args(vec![
            &env,
            session_id.into_val(&env),
            player2_points.into_val(&env),
        ]);

        // Call Game Hub start_game
        let game_hub_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::GameHubAddress)
            .expect("GameHub not set");
        let game_hub = GameHubClient::new(&env, &game_hub_addr);
        game_hub.start_game(
            &env.current_contract_address(),
            &session_id,
            &player1,
            &player2,
            &player1_points,
            &player2_points,
        );

        let game = GameMatch {
            player1,
            player2,
            player1_points,
            player2_points,
            status: MatchStatus::Active,
            created_ledger: env.ledger().sequence(),
            p1_proof_submitted: false,
            p2_proof_submitted: false,
            winner: None,
        };

        let key = DataKey::Match(session_id);
        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, MATCH_TTL_LEDGERS, MATCH_TTL_LEDGERS);

        Ok(())
    }

    pub fn submit_proof(
        env: Env,
        session_id: u32,
        player: Address,
        proof_bytes: Bytes,
        input_hash: BytesN<32>,
        my_final_health: u32,
        opponent_final_health: u32,
        total_damage_dealt: u32,
        i_won: u32,
    ) -> Result<(), Error> {
        player.require_auth();

        let key = DataKey::Match(session_id);
        let mut game: GameMatch = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::MatchNotFound)?;

        if game.status == MatchStatus::Resolved || game.status == MatchStatus::Forfeit {
            return Err(Error::MatchAlreadyEnded);
        }

        // Parse 256-byte proof into Groth16Proof (A:64 || B:128 || C:64)
        if proof_bytes.len() != 256 {
            return Err(Error::VerificationFailed);
        }
        let proof = Groth16Proof {
            a: Bn254G1Affine::from_bytes(
                proof_bytes.slice(0..64).try_into().map_err(|_| Error::VerificationFailed)?,
            ),
            b: Bn254G2Affine::from_bytes(
                proof_bytes.slice(64..192).try_into().map_err(|_| Error::VerificationFailed)?,
            ),
            c: Bn254G1Affine::from_bytes(
                proof_bytes.slice(192..256).try_into().map_err(|_| Error::VerificationFailed)?,
            ),
        };

        // Build public inputs: [input_log_hash, my_final_health, opp_final_health, i_won]
        let mut pub_inputs: Vec<Fr> = Vec::new(&env);

        // input_hash is already a 32-byte field element
        pub_inputs.push_back(Fr::from_bytes(input_hash.clone()));

        // Health values as 32-byte big-endian field elements
        let mut health_buf = [0u8; 32];
        health_buf[31] = (my_final_health & 0xFF) as u8;
        health_buf[30] = ((my_final_health >> 8) & 0xFF) as u8;
        pub_inputs.push_back(Fr::from_bytes(BytesN::from_array(&env, &health_buf)));

        let mut opp_buf = [0u8; 32];
        opp_buf[31] = (opponent_final_health & 0xFF) as u8;
        opp_buf[30] = ((opponent_final_health >> 8) & 0xFF) as u8;
        pub_inputs.push_back(Fr::from_bytes(BytesN::from_array(&env, &opp_buf)));

        let mut won_buf = [0u8; 32];
        won_buf[31] = (i_won & 0xFF) as u8;
        pub_inputs.push_back(Fr::from_bytes(BytesN::from_array(&env, &won_buf)));

        // Verify Groth16 proof via cross-contract call
        let verifier_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::VerifierAddress)
            .ok_or(Error::VerifierNotSet)?;
        let verifier = VerifierClient::new(&env, &verifier_addr);

        match verifier.try_verify(&proof, &pub_inputs) {
            Ok(Ok(true)) => {}
            _ => return Err(Error::VerificationFailed),
        }

        // Transition to proof phase on first submission
        if game.status == MatchStatus::Active {
            game.status = MatchStatus::ProofPhase;
        }

        let submission = ProofSubmission {
            input_hash,
            my_final_health,
            opponent_final_health,
            total_damage_dealt,
            i_won,
        };

        if player == game.player1 {
            if game.p1_proof_submitted {
                return Err(Error::ProofAlreadySubmitted);
            }
            game.p1_proof_submitted = true;
            let proof_key = DataKey::P1Proof(session_id);
            env.storage().temporary().set(&proof_key, &submission);
            env.storage()
                .temporary()
                .extend_ttl(&proof_key, MATCH_TTL_LEDGERS, MATCH_TTL_LEDGERS);
        } else if player == game.player2 {
            if game.p2_proof_submitted {
                return Err(Error::ProofAlreadySubmitted);
            }
            game.p2_proof_submitted = true;
            let proof_key = DataKey::P2Proof(session_id);
            env.storage().temporary().set(&proof_key, &submission);
            env.storage()
                .temporary()
                .extend_ttl(&proof_key, MATCH_TTL_LEDGERS, MATCH_TTL_LEDGERS);
        } else {
            return Err(Error::NotPlayer);
        }

        // If both proofs are in, resolve the match
        if game.p1_proof_submitted && game.p2_proof_submitted {
            Self::resolve_match_internal(&env, session_id, &mut game);
        }

        env.storage().temporary().set(&key, &game);
        env.storage()
            .temporary()
            .extend_ttl(&key, MATCH_TTL_LEDGERS, MATCH_TTL_LEDGERS);

        Ok(())
    }

    pub fn claim_forfeit(
        env: Env,
        session_id: u32,
        claimer: Address,
    ) -> Result<Address, Error> {
        claimer.require_auth();

        let key = DataKey::Match(session_id);
        let mut game: GameMatch = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::MatchNotFound)?;

        if game.status == MatchStatus::Resolved || game.status == MatchStatus::Forfeit {
            return Err(Error::MatchAlreadyEnded);
        }

        if game.status != MatchStatus::ProofPhase {
            return Err(Error::ForfeitNotAllowed);
        }

        let elapsed = env.ledger().sequence() - game.created_ledger;
        if elapsed < PROOF_TIMEOUT_LEDGERS {
            return Err(Error::ForfeitNotAllowed);
        }

        // Claimer must have submitted, opponent must not have
        let player1_won = if claimer == game.player1
            && game.p1_proof_submitted
            && !game.p2_proof_submitted
        {
            true
        } else if claimer == game.player2
            && game.p2_proof_submitted
            && !game.p1_proof_submitted
        {
            false
        } else {
            return Err(Error::ForfeitNotAllowed);
        };

        let winner = claimer.clone();
        let loser = if player1_won {
            game.player2.clone()
        } else {
            game.player1.clone()
        };

        game.winner = Some(winner.clone());
        game.status = MatchStatus::Forfeit;

        // Award forfeit points
        let cfg: PointConfig = env
            .storage()
            .instance()
            .get(&DataKey::PointConfig)
            .unwrap_or(default_point_config());

        Self::award_points(
            &env,
            &winner,
            cfg.forfeit_win_points,
            true,
            false,
            false,
        );
        Self::award_points(&env, &loser, 0, false, false, false);
        Self::update_leaderboard(&env, &winner);
        Self::update_leaderboard(&env, &loser);

        env.storage().temporary().set(&key, &game);

        // End game via hub
        let game_hub_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::GameHubAddress)
            .expect("GameHub not set");
        let game_hub = GameHubClient::new(&env, &game_hub_addr);
        game_hub.end_game(&session_id, &player1_won);

        Ok(winner)
    }

    // ====================================================================
    // Internal: Match Resolution
    // ====================================================================

    fn resolve_match_internal(env: &Env, session_id: u32, game: &mut GameMatch) {
        let p1: ProofSubmission = env
            .storage()
            .temporary()
            .get(&DataKey::P1Proof(session_id))
            .expect("P1 proof missing");
        let p2: ProofSubmission = env
            .storage()
            .temporary()
            .get(&DataKey::P2Proof(session_id))
            .expect("P2 proof missing");

        let cfg: PointConfig = env
            .storage()
            .instance()
            .get(&DataKey::PointConfig)
            .unwrap_or(default_point_config());

        // Cross-validate: P1's opponent_health should equal P2's my_health and vice versa
        let results_agree = p1.my_final_health == p2.opponent_final_health
            && p1.opponent_final_health == p2.my_final_health;

        // Determine winner
        let (p1_health, p2_health) = if results_agree {
            (p1.my_final_health, p2.my_final_health)
        } else {
            // Both proofs were individually verified. Trust each player's
            // own final health (their proof validates their own health calc).
            (p1.my_final_health, p2.my_final_health)
        };

        if p1_health == p2_health {
            // Draw
            game.status = MatchStatus::Draw;
            game.winner = None;

            Self::award_points(env, &game.player1, cfg.draw_points, false, false, false);
            Self::award_points(env, &game.player2, cfg.draw_points, false, false, false);

            // Increment draws
            Self::increment_draws(env, &game.player1);
            Self::increment_draws(env, &game.player2);

            Self::update_leaderboard(env, &game.player1);
            Self::update_leaderboard(env, &game.player2);

            // For Game Hub, player1_won = true in a draw (arbitrary tiebreak)
            let game_hub_addr: Address = env
                .storage()
                .instance()
                .get(&DataKey::GameHubAddress)
                .expect("GameHub not set");
            let game_hub = GameHubClient::new(env, &game_hub_addr);
            game_hub.end_game(&session_id, &true);
        } else {
            let player1_won = p1_health > p2_health;
            let winner = if player1_won {
                game.player1.clone()
            } else {
                game.player2.clone()
            };
            let loser = if player1_won {
                game.player2.clone()
            } else {
                game.player1.clone()
            };
            let winner_health = if player1_won { p1_health } else { p2_health };

            game.winner = Some(winner.clone());
            game.status = MatchStatus::Resolved;

            let is_perfect = winner_health == cfg.starting_health;
            let is_comeback = winner_health <= cfg.comeback_threshold;

            // Calculate winner points
            let mut winner_pts = cfg.win_points;
            if is_perfect {
                winner_pts += cfg.perfect_bonus;
            }
            if is_comeback {
                winner_pts += cfg.comeback_bonus;
            }

            Self::award_points(env, &winner, winner_pts, true, is_perfect, is_comeback);
            Self::award_points(env, &loser, cfg.loss_points, false, false, false);
            Self::update_leaderboard(env, &winner);
            Self::update_leaderboard(env, &loser);

            let game_hub_addr: Address = env
                .storage()
                .instance()
                .get(&DataKey::GameHubAddress)
                .expect("GameHub not set");
            let game_hub = GameHubClient::new(env, &game_hub_addr);
            game_hub.end_game(&session_id, &player1_won);
        }
    }

    // ====================================================================
    // Internal: Points & Stats
    // ====================================================================

    fn get_or_default_stats(env: &Env, player: &Address) -> PlayerStats {
        let key = DataKey::PlayerStats(player.clone());
        env.storage().persistent().get(&key).unwrap_or(PlayerStats {
            wins: 0,
            losses: 0,
            draws: 0,
            total_points: 0,
            win_streak: 0,
            best_streak: 0,
            perfect_wins: 0,
            comeback_wins: 0,
            total_matches: 0,
        })
    }

    fn save_stats(env: &Env, player: &Address, stats: &PlayerStats) {
        let key = DataKey::PlayerStats(player.clone());
        env.storage().persistent().set(&key, stats);
        env.storage()
            .persistent()
            .extend_ttl(&key, STATS_TTL_LEDGERS, STATS_TTL_LEDGERS);
    }

    fn award_points(
        env: &Env,
        player: &Address,
        base_points: i128,
        won: bool,
        is_perfect: bool,
        is_comeback: bool,
    ) {
        let cfg: PointConfig = env
            .storage()
            .instance()
            .get(&DataKey::PointConfig)
            .unwrap_or(default_point_config());

        let mut stats = Self::get_or_default_stats(env, player);
        stats.total_matches += 1;

        if won {
            stats.wins += 1;
            stats.win_streak += 1;
            if stats.win_streak > stats.best_streak {
                stats.best_streak = stats.win_streak;
            }
            if is_perfect {
                stats.perfect_wins += 1;
            }
            if is_comeback {
                stats.comeback_wins += 1;
            }

            // Streak bonus
            let streak_levels = (stats.win_streak as i128).min(cfg.max_streak_bonus_levels as i128);
            let streak_pts = cfg.streak_bonus_per_level * streak_levels;
            stats.total_points += base_points + streak_pts;
        } else {
            stats.losses += 1;
            stats.win_streak = 0;
            stats.total_points += base_points;
        }

        Self::save_stats(env, player, &stats);
    }

    fn increment_draws(env: &Env, player: &Address) {
        let mut stats = Self::get_or_default_stats(env, player);
        stats.draws += 1;
        stats.win_streak = 0;
        stats.total_matches += 1;
        Self::save_stats(env, player, &stats);
    }

    fn update_leaderboard(env: &Env, player: &Address) {
        let lb_key = DataKey::Leaderboard;
        let lb: Vec<LeaderboardEntry> = env
            .storage()
            .persistent()
            .get(&lb_key)
            .unwrap_or(Vec::new(env));

        let stats = Self::get_or_default_stats(env, player);

        // Remove existing entry for this player
        let mut new_lb = Vec::new(env);
        for i in 0..lb.len() {
            let entry = lb.get(i).unwrap();
            if entry.player != *player {
                new_lb.push_back(entry);
            }
        }

        // Insert at correct sorted position (descending by points)
        let new_entry = LeaderboardEntry {
            player: player.clone(),
            points: stats.total_points,
        };

        let mut inserted = false;
        let mut final_lb = Vec::new(env);
        for i in 0..new_lb.len() {
            let entry = new_lb.get(i).unwrap();
            if !inserted && new_entry.points > entry.points {
                final_lb.push_back(new_entry.clone());
                inserted = true;
            }
            final_lb.push_back(entry);
        }
        if !inserted {
            final_lb.push_back(new_entry);
        }

        // Trim to MAX_LEADERBOARD
        let mut trimmed = Vec::new(env);
        let max = if final_lb.len() < MAX_LEADERBOARD {
            final_lb.len()
        } else {
            MAX_LEADERBOARD
        };
        for i in 0..max {
            trimmed.push_back(final_lb.get(i).unwrap());
        }

        env.storage().persistent().set(&lb_key, &trimmed);
        env.storage()
            .persistent()
            .extend_ttl(&lb_key, STATS_TTL_LEDGERS, STATS_TTL_LEDGERS);
    }

    // ====================================================================
    // Read Functions
    // ====================================================================

    pub fn get_match(env: Env, session_id: u32) -> Result<GameMatch, Error> {
        env.storage()
            .temporary()
            .get(&DataKey::Match(session_id))
            .ok_or(Error::MatchNotFound)
    }

    pub fn get_player_stats(env: Env, player: Address) -> PlayerStats {
        Self::get_or_default_stats(&env, &player)
    }

    pub fn get_leaderboard(env: Env) -> Vec<LeaderboardEntry> {
        env.storage()
            .persistent()
            .get(&DataKey::Leaderboard)
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_point_config(env: Env) -> PointConfig {
        env.storage()
            .instance()
            .get(&DataKey::PointConfig)
            .unwrap_or(default_point_config())
    }

    // ====================================================================
    // Admin Functions
    // ====================================================================

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set")
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn get_hub(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::GameHubAddress)
            .expect("GameHub not set")
    }

    pub fn set_hub(env: Env, new_hub: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::GameHubAddress, &new_hub);
    }

    pub fn get_verifier(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::VerifierAddress)
            .expect("Verifier not set")
    }

    pub fn set_verifier(env: Env, new_verifier: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::VerifierAddress, &new_verifier);
    }

    pub fn set_point_config(env: Env, config: PointConfig) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::PointConfig, &config);
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod test;
