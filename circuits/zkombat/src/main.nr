// ZKombat Anti-Cheat Circuit
//
// Proves four properties about a player's match without revealing inputs:
//   1. Input log integrity  - inputs hash to the committed Poseidon hash
//   2. Human reaction time  - >=80 ms between consecutive player actions
//   3. Valid damage/stamina  - health only decreases by correct amounts,
//                              stamina spent/regenerated correctly
//   4. Result consistency   - simulated health matches claimed values,
//                              winner consistent with final health

// Compile-time maximum number of input entries per match.
// A 60-second fight at ~2 actions/second = ~120 actions max.
// 128 gives headroom. Zero-padded entries are skipped.
global MAX_INPUTS: u32 = 128;

// Action type constants
global ACTION_NONE: u8 = 0;
global ACTION_PUNCH: u8 = 1;
global ACTION_BLOCK: u8 = 2;

// Game constants (must match frontend engine)
global STARTING_HEALTH: u32 = 100;
global STARTING_STAMINA: u32 = 100;
global PUNCH_DAMAGE: u32 = 20;
global BLOCKED_DAMAGE: u32 = 10; // punch damage when opponent is blocking
global PUNCH_STAMINA_COST: u32 = 15;
global BLOCK_STAMINA_COST: u32 = 5;
global STAMINA_REGEN: u32 = 3; // regen on opponent's action
global MIN_REACTION_MS: u32 = 80;

// Input entry: one action in the match log
struct GameInput {
    action: u8,           // ACTION_NONE / ACTION_PUNCH / ACTION_BLOCK
    timestamp_ms: u32,    // milliseconds since match start
    is_my_action: u8,     // 1 = my action, 0 = opponent's action
    did_hit: u8,          // 1 = this attack landed, 0 = missed or non-attack
    opponent_blocking: u8, // 1 = opponent was blocking when this hit
}

// Main circuit entry point
fn main(
    // Private inputs
    inputs: [GameInput; MAX_INPUTS],
    num_valid: u32,

    // Public inputs (committed on-chain)
    input_log_hash: pub Field,
    my_final_health: pub u32,
    opponent_final_health: pub u32,
    i_won: pub u8, // 1 = I won, 0 = I lost, 2 = draw
) {
    // Ensure num_valid is within bounds
    assert(num_valid <= MAX_INPUTS, "num_valid exceeds MAX_INPUTS");

    // PROPERTY 1: Input log integrity
    // The Poseidon hash of the input array must match the committed hash.
    let computed_hash = hash_input_log(inputs, num_valid);
    assert(computed_hash == input_log_hash, "Input log hash mismatch");

    // PROPERTY 2: Human reaction time bounds
    // Consecutive actions from the same player must be >= 80ms apart.
    let mut last_my_ts: u32 = 0;
    let mut seen_my_first: bool = false;

    for i in 0..MAX_INPUTS {
        if i < num_valid {
            let inp = inputs[i];
            if inp.is_my_action == 1 {
                if seen_my_first {
                    let delta = inp.timestamp_ms - last_my_ts;
                    assert(
                        delta >= MIN_REACTION_MS,
                        "Superhuman reaction time detected",
                    );
                }
                last_my_ts = inp.timestamp_ms;
                seen_my_first = true;
            }
        }
    }

    // PROPERTY 3: Valid damage calculation and state transitions
    // Simulate the entire match from the input log.
    // - Health only decreases (never increases)
    // - Damage values match the action type
    // - Stamina is correctly spent and regenerated
    let mut my_health: u32 = STARTING_HEALTH;
    let mut opp_health: u32 = STARTING_HEALTH;
    let mut my_stamina: u32 = STARTING_STAMINA;

    for i in 0..MAX_INPUTS {
        if i < num_valid {
            let inp = inputs[i];

            if inp.is_my_action == 1 {
                // My action
                if inp.action == ACTION_PUNCH {
                    // Must have enough stamina to attack
                    assert(
                        my_stamina >= PUNCH_STAMINA_COST,
                        "Insufficient stamina for punch",
                    );
                    my_stamina -= PUNCH_STAMINA_COST;

                    if inp.did_hit == 1 {
                        let dmg = if inp.opponent_blocking == 1 {
                            BLOCKED_DAMAGE
                        } else {
                            PUNCH_DAMAGE
                        };

                        if dmg >= opp_health {
                            opp_health = 0;
                        } else {
                            opp_health -= dmg;
                        }
                    }
                } else if inp.action == ACTION_BLOCK {
                    // Block costs stamina
                    assert(
                        my_stamina >= BLOCK_STAMINA_COST,
                        "Insufficient stamina for block",
                    );
                    my_stamina -= BLOCK_STAMINA_COST;
                }
                // ACTION_NONE: no stamina cost, no effect
            } else {
                // Opponent's action
                if inp.action == ACTION_PUNCH {
                    if inp.did_hit == 1 {
                        // Opponent hit me
                        let dmg = PUNCH_DAMAGE;
                        if dmg >= my_health {
                            my_health = 0;
                        } else {
                            my_health -= dmg;
                        }
                    }
                }

                // Stamina regeneration on opponent's turn
                if my_stamina < STARTING_STAMINA {
                    my_stamina += STAMINA_REGEN;
                    if my_stamina > STARTING_STAMINA {
                        my_stamina = STARTING_STAMINA;
                    }
                }
            }
        }
    }

    // PROPERTY 4: Result consistency
    // Simulated health must match claimed values.
    // Winner must be consistent with final health.
    assert(my_health == my_final_health, "My final health mismatch");
    assert(
        opp_health == opponent_final_health,
        "Opponent final health mismatch",
    );

    // Winner consistency
    if my_health > opp_health {
        assert(i_won == 1, "Should claim win when health is higher");
    } else if my_health < opp_health {
        assert(i_won == 0, "Should claim loss when health is lower");
    } else {
        assert(i_won == 2, "Should claim draw when health is equal");
    }
}

// Helper: Compute Pedersen hash of the input log
// Uses Pedersen (built-in stdlib hash over field elements, ZK-friendly)
fn hash_input_log(inputs: [GameInput; MAX_INPUTS], count: u32) -> Field {
    let mut acc: Field = 0;

    for i in 0..MAX_INPUTS {
        if i < count {
            let inp = inputs[i];

            // Pack each input into two field elements for hashing:
            // f1 = action * 10_000_000 + timestamp_ms
            // f2 = is_my_action * 100 + did_hit * 10 + opponent_blocking
            let f1 = (inp.action as Field) * 10_000_000 + (inp.timestamp_ms as Field);
            let f2 = (inp.is_my_action as Field) * 100
                + (inp.did_hit as Field) * 10
                + (inp.opponent_blocking as Field);

            acc = std::hash::pedersen_hash([acc + f1, f2]);
        }
    }

    acc
}

// Tests

#[test]
fn test_valid_simple_match() {
    // Simple match: player punches once, hits, opponent has 80 health
    let mut inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    // My punch at 1000ms, hit, not blocked
    inputs[0] = GameInput {
        action: ACTION_PUNCH,
        timestamp_ms: 1000,
        is_my_action: 1,
        did_hit: 1,
        opponent_blocking: 0,
    };

    let num_valid: u32 = 1;
    let hash = hash_input_log(inputs, num_valid);

    main(inputs, num_valid, hash, 100, 80, 1);
}

#[test]
fn test_blocked_damage() {
    let mut inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    // My punch at 1000ms, hit, opponent blocking -> 10 damage
    inputs[0] = GameInput {
        action: ACTION_PUNCH,
        timestamp_ms: 1000,
        is_my_action: 1,
        did_hit: 1,
        opponent_blocking: 1,
    };

    let num_valid: u32 = 1;
    let hash = hash_input_log(inputs, num_valid);

    // Opponent health = 100 - 10 = 90
    main(inputs, num_valid, hash, 100, 90, 1);
}

#[test]
fn test_opponent_hits_me() {
    let mut inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    // Opponent punches at 500ms, hits me
    inputs[0] = GameInput {
        action: ACTION_PUNCH,
        timestamp_ms: 500,
        is_my_action: 0,
        did_hit: 1,
        opponent_blocking: 0,
    };

    let num_valid: u32 = 1;
    let hash = hash_input_log(inputs, num_valid);

    // My health = 100 - 20 = 80, opponent health = 100
    main(inputs, num_valid, hash, 80, 100, 0);
}

#[test]
fn test_draw_result() {
    let mut inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    // I hit opponent once, opponent hits me once => both at 80
    inputs[0] = GameInput {
        action: ACTION_PUNCH,
        timestamp_ms: 500,
        is_my_action: 1,
        did_hit: 1,
        opponent_blocking: 0,
    };

    inputs[1] = GameInput {
        action: ACTION_PUNCH,
        timestamp_ms: 800,
        is_my_action: 0,
        did_hit: 1,
        opponent_blocking: 0,
    };

    let num_valid: u32 = 2;
    let hash = hash_input_log(inputs, num_valid);

    main(inputs, num_valid, hash, 80, 80, 2); // draw
}

#[test]
fn test_stamina_and_regen() {
    let mut inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    // I punch 6 times with opponent idle actions in between for regen
    // Stamina flow: 100 -> 85 -> 88 -> 73 -> 76 -> 61 -> 64 -> 49 -> 52 -> 37 -> 40 -> 25 -> 28
    let mut t: u32 = 100;
    for i in 0..6 {
        // My punch
        inputs[i * 2] = GameInput {
            action: ACTION_PUNCH,
            timestamp_ms: t,
            is_my_action: 1,
            did_hit: 1,
            opponent_blocking: 0,
        };
        t += 200;

        // Opponent action (just idle, no hit)
        inputs[i * 2 + 1] = GameInput {
            action: ACTION_NONE,
            timestamp_ms: t,
            is_my_action: 0,
            did_hit: 0,
            opponent_blocking: 0,
        };
        t += 200;
    }

    let num_valid: u32 = 12;
    let hash = hash_input_log(inputs, num_valid);

    // 5 punches * 20 damage = 100, opponent health hits 0 after 5th punch
    // 6th punch: opp already at 0, stays 0
    main(inputs, num_valid, hash, 100, 0, 1);
}

#[test(should_fail_with = "Superhuman reaction time detected")]
fn test_rejects_superhuman_timing() {
    let mut inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    // Two actions 50ms apart (below 80ms threshold)
    inputs[0] = GameInput {
        action: ACTION_PUNCH,
        timestamp_ms: 1000,
        is_my_action: 1,
        did_hit: 0,
        opponent_blocking: 0,
    };
    inputs[1] = GameInput {
        action: ACTION_PUNCH,
        timestamp_ms: 1050, // Only 50ms gap!
        is_my_action: 1,
        did_hit: 0,
        opponent_blocking: 0,
    };

    let num_valid: u32 = 2;
    let hash = hash_input_log(inputs, num_valid);

    main(inputs, num_valid, hash, 100, 100, 2);
}

#[test(should_fail_with = "My final health mismatch")]
fn test_rejects_health_manipulation() {
    let mut inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    // Opponent hits me for 20 damage
    inputs[0] = GameInput {
        action: ACTION_PUNCH,
        timestamp_ms: 500,
        is_my_action: 0,
        did_hit: 1,
        opponent_blocking: 0,
    };

    let num_valid: u32 = 1;
    let hash = hash_input_log(inputs, num_valid);

    // Claiming 100 health when I should have 80 -> FAIL
    main(inputs, num_valid, hash, 100, 100, 1);
}

#[test(should_fail_with = "Input log hash mismatch")]
fn test_rejects_tampered_log() {
    let mut inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    inputs[0] = GameInput {
        action: ACTION_PUNCH,
        timestamp_ms: 1000,
        is_my_action: 1,
        did_hit: 1,
        opponent_blocking: 0,
    };

    let num_valid: u32 = 1;
    let fake_hash: Field = 12345; // Wrong hash

    main(inputs, num_valid, fake_hash, 100, 80, 1);
}

#[test(should_fail_with = "Insufficient stamina for punch")]
fn test_rejects_stamina_cheat() {
    let mut inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    // Try to punch 7 times in a row without any regen
    // 7 * 15 = 105 stamina needed, but only 100 available
    let mut t: u32 = 100;
    for i in 0..7 {
        inputs[i] = GameInput {
            action: ACTION_PUNCH,
            timestamp_ms: t,
            is_my_action: 1,
            did_hit: 0,
            opponent_blocking: 0,
        };
        t += 100;
    }

    let num_valid: u32 = 7;
    let hash = hash_input_log(inputs, num_valid);

    main(inputs, num_valid, hash, 100, 100, 2);
}

#[test]
fn test_empty_match() {
    // No inputs at all - both players at full health, draw
    let inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    let num_valid: u32 = 0;
    let hash = hash_input_log(inputs, num_valid);

    main(inputs, num_valid, hash, 100, 100, 2);
}

#[test(should_fail_with = "Should claim win when health is higher")]
fn test_rejects_wrong_winner_claim() {
    let mut inputs: [GameInput; MAX_INPUTS] = [GameInput {
        action: ACTION_NONE,
        timestamp_ms: 0,
        is_my_action: 0,
        did_hit: 0,
        opponent_blocking: 0,
    }; MAX_INPUTS];

    // I hit opponent once -> I have 100, opp has 80
    inputs[0] = GameInput {
        action: ACTION_PUNCH,
        timestamp_ms: 1000,
        is_my_action: 1,
        did_hit: 1,
        opponent_blocking: 0,
    };

    let num_valid: u32 = 1;
    let hash = hash_input_log(inputs, num_valid);

    // Claiming I lost (0) when I actually won -> FAIL
    main(inputs, num_valid, hash, 100, 80, 0);
}
