pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

// ZKombat Anti-Cheat Circuit (Circom/Groth16)
//
// Proves four properties about a player's match:
//   1. Input log integrity  - inputs hash to committed Poseidon hash
//   2. Human reaction time  - >=80ms between consecutive player actions
//   3. Valid damage/stamina  - correct state transitions
//   4. Result consistency   - simulated health matches claims

// Game constants (must match frontend engine)
// STARTING_HEALTH = 100
// STARTING_STAMINA = 100
// PUNCH_DAMAGE = 20
// BLOCKED_DAMAGE = 10
// PUNCH_STAMINA_COST = 15
// BLOCK_STAMINA_COST = 5
// STAMINA_REGEN = 3
// MIN_REACTION_MS = 80

// SafeSub: computes max(0, a - b) without field underflow
// Both a and b must be < 2^n
template SafeSub(n) {
    signal input a;
    signal input b;
    signal output out;

    component gte = GreaterEqThan(n);
    gte.in[0] <== a;
    gte.in[1] <== b;

    // If a >= b: out = a - b, else: out = 0
    out <== gte.out * (a - b);
}

// MinVal: computes min(a, cap) where both < 2^n
template MinVal(n) {
    signal input a;
    signal input cap;
    signal output out;

    component lte = LessEqThan(n);
    lte.in[0] <== a;
    lte.in[1] <== cap;

    // If a <= cap: out = a, else: out = cap
    // out = lte.out * a + (1 - lte.out) * cap
    out <== lte.out * (a - cap) + cap;
}

// Mux: selects between two values based on a boolean condition
// out = cond ? a : b
template Mux() {
    signal input cond;  // 0 or 1
    signal input a;     // value if cond=1
    signal input b;     // value if cond=0
    signal output out;

    out <== cond * (a - b) + b;
}

template ZKombat(MAX_INPUTS) {
    // ================================================================
    // Inputs
    // ================================================================

    // Private inputs: game action log
    signal input action[MAX_INPUTS];           // 0=none, 1=punch, 2=block
    signal input timestamp_ms[MAX_INPUTS];     // ms since match start
    signal input is_my_action[MAX_INPUTS];     // 1=mine, 0=opponent's
    signal input did_hit[MAX_INPUTS];          // 1=landed, 0=missed
    signal input opponent_blocking[MAX_INPUTS]; // 1=blocking, 0=not
    signal input num_valid;                    // number of real entries

    // Public inputs (committed on-chain, order determines Vec<Fr> index)
    signal input input_log_hash;          // idx 0: Poseidon hash
    signal input my_final_health;         // idx 1
    signal input opponent_final_health;   // idx 2
    signal input i_won;                   // idx 3: 0=lost, 1=won, 2=draw

    // ================================================================
    // Step 0: Compute active flags
    // ================================================================
    // is_active[i] = 1 if i < num_valid, else 0
    component active_lt[MAX_INPUTS];
    signal is_active[MAX_INPUTS];

    for (var i = 0; i < MAX_INPUTS; i++) {
        active_lt[i] = LessThan(8); // 8 bits: values up to 128
        active_lt[i].in[0] <== i;
        active_lt[i].in[1] <== num_valid;
        is_active[i] <== active_lt[i].out;
    }

    // ================================================================
    // PROPERTY 1: Input Log Integrity (Poseidon hash)
    // ================================================================
    // Pack fields: f1 = action * 10000000 + timestamp_ms
    //              f2 = is_my_action * 100 + did_hit * 10 + opponent_blocking
    // Chain: acc = active ? poseidon(acc + f1, f2) : acc

    signal f1[MAX_INPUTS];
    signal f2[MAX_INPUTS];
    component hasher[MAX_INPUTS];
    component hash_mux[MAX_INPUTS];
    signal hash_acc[MAX_INPUTS + 1];

    hash_acc[0] <== 0;

    for (var i = 0; i < MAX_INPUTS; i++) {
        f1[i] <== action[i] * 10000000 + timestamp_ms[i];
        f2[i] <== is_my_action[i] * 100 + did_hit[i] * 10 + opponent_blocking[i];

        hasher[i] = Poseidon(2);
        hasher[i].inputs[0] <== hash_acc[i] + f1[i];
        hasher[i].inputs[1] <== f2[i];

        // Conditional update: active -> use hash, inactive -> pass through
        hash_mux[i] = Mux();
        hash_mux[i].cond <== is_active[i];
        hash_mux[i].a <== hasher[i].out;
        hash_mux[i].b <== hash_acc[i];
        hash_acc[i + 1] <== hash_mux[i].out;
    }

    // Assert hash matches
    hash_acc[MAX_INPUTS] === input_log_hash;

    // ================================================================
    // Action type flags (precompute for reuse)
    // ================================================================
    component is_punch[MAX_INPUTS];
    component is_block[MAX_INPUTS];
    signal is_mine[MAX_INPUTS];
    signal is_opp[MAX_INPUTS];
    signal hit[MAX_INPUTS];
    signal opp_block[MAX_INPUTS];

    for (var i = 0; i < MAX_INPUTS; i++) {
        is_punch[i] = IsEqual();
        is_punch[i].in[0] <== action[i];
        is_punch[i].in[1] <== 1;

        is_block[i] = IsEqual();
        is_block[i].in[0] <== action[i];
        is_block[i].in[1] <== 2;

        is_mine[i] <== is_my_action[i];
        is_opp[i] <== 1 - is_my_action[i];
        hit[i] <== did_hit[i];
        opp_block[i] <== opponent_blocking[i];
    }

    // ================================================================
    // PROPERTY 2: Human Reaction Time (>=80ms between my actions)
    // ================================================================
    // Track last_my_ts and seen_my_first through each step.
    // When active AND is_mine AND seen_first: assert delta >= 80

    signal last_my_ts[MAX_INPUTS + 1];
    signal seen_my_first[MAX_INPUTS + 1];
    last_my_ts[0] <== 0;
    seen_my_first[0] <== 0;

    component reaction_gte[MAX_INPUTS];
    signal is_active_mine[MAX_INPUTS];
    signal check_reaction[MAX_INPUTS];
    signal reaction_ok[MAX_INPUTS];
    component ts_mux[MAX_INPUTS];
    component seen_mux[MAX_INPUTS];

    for (var i = 0; i < MAX_INPUTS; i++) {
        // is_active AND is_mine
        is_active_mine[i] <== is_active[i] * is_mine[i];

        // Check reaction time only when seen_first is true
        check_reaction[i] <== is_active_mine[i] * seen_my_first[i];

        // delta = timestamp_ms[i] - last_my_ts[i]
        // If check_reaction: assert delta >= 80
        reaction_gte[i] = GreaterEqThan(32);
        reaction_gte[i].in[0] <== timestamp_ms[i] - last_my_ts[i];
        reaction_gte[i].in[1] <== 80;

        // reaction_ok must be 1 when check_reaction is 1
        reaction_ok[i] <== reaction_gte[i].out;
        // Enforce: if check_reaction, then reaction_ok must be 1
        // check_reaction * (1 - reaction_ok) === 0
        check_reaction[i] * (1 - reaction_ok[i]) === 0;

        // Update last_my_ts: if active_mine, set to current ts
        ts_mux[i] = Mux();
        ts_mux[i].cond <== is_active_mine[i];
        ts_mux[i].a <== timestamp_ms[i];
        ts_mux[i].b <== last_my_ts[i];
        last_my_ts[i + 1] <== ts_mux[i].out;

        // Update seen_my_first: once set to 1, stays 1
        seen_mux[i] = Mux();
        seen_mux[i].cond <== is_active_mine[i];
        seen_mux[i].a <== 1;
        seen_mux[i].b <== seen_my_first[i];
        seen_my_first[i + 1] <== seen_mux[i].out;
    }

    // ================================================================
    // PROPERTY 3: Valid Game Simulation
    // ================================================================
    // Simulate health, stamina through each action step.

    signal my_hp[MAX_INPUTS + 1];
    signal opp_hp[MAX_INPUTS + 1];
    signal my_stam[MAX_INPUTS + 1];

    my_hp[0] <== 100;
    opp_hp[0] <== 100;
    my_stam[0] <== 100;

    // Intermediate signals for each step (broken into quadratic pairs)
    signal active_mine[MAX_INPUTS];          // is_active * is_mine
    signal active_opp[MAX_INPUTS];           // is_active * is_opp
    signal active_mine_punch[MAX_INPUTS];    // active_mine * is_punch
    signal active_mine_block[MAX_INPUTS];    // active_mine * is_block
    signal active_opp_punch[MAX_INPUTS];     // active_opp * is_punch
    signal my_punch_hit[MAX_INPUTS];         // active_mine_punch * hit
    signal opp_punch_hit[MAX_INPUTS];        // active_opp_punch * hit

    // Damage signals
    signal my_punch_dmg[MAX_INPUTS];
    signal opp_punch_dmg[MAX_INPUTS];

    // Stamina signals
    signal stam_cost[MAX_INPUTS];
    signal stam_after_cost[MAX_INPUTS];

    // Components for safe subtraction and capping
    component opp_hp_sub[MAX_INPUTS];
    component my_hp_sub[MAX_INPUTS];
    component stam_sub[MAX_INPUTS];
    component stam_regen_add[MAX_INPUTS];
    component stam_gte_punch[MAX_INPUTS];
    component stam_gte_block[MAX_INPUTS];

    for (var i = 0; i < MAX_INPUTS; i++) {
        // Precompute compound flags (each max degree 2)
        active_mine[i] <== is_active[i] * is_mine[i];
        active_opp[i] <== is_active[i] * is_opp[i];
        active_mine_punch[i] <== active_mine[i] * is_punch[i].out;
        active_mine_block[i] <== active_mine[i] * is_block[i].out;
        active_opp_punch[i] <== active_opp[i] * is_punch[i].out;
        my_punch_hit[i] <== active_mine_punch[i] * hit[i];
        opp_punch_hit[i] <== active_opp_punch[i] * hit[i];

        // ---- Stamina checks ----
        stam_gte_punch[i] = GreaterEqThan(8);
        stam_gte_punch[i].in[0] <== my_stam[i];
        stam_gte_punch[i].in[1] <== 15;

        stam_gte_block[i] = GreaterEqThan(8);
        stam_gte_block[i].in[0] <== my_stam[i];
        stam_gte_block[i].in[1] <== 5;

        // Enforce: if attempting punch, must have stamina
        active_mine_punch[i] * (1 - stam_gte_punch[i].out) === 0;
        // Enforce: if attempting block, must have stamina
        active_mine_block[i] * (1 - stam_gte_block[i].out) === 0;

        // ---- Stamina cost ----
        stam_cost[i] <== active_mine_punch[i] * 15 + active_mine_block[i] * 5;

        stam_sub[i] = SafeSub(8);
        stam_sub[i].a <== my_stam[i];
        stam_sub[i].b <== stam_cost[i];
        stam_after_cost[i] <== stam_sub[i].out;

        // ---- Stamina regen on opponent's turn, cap at 100 ----
        stam_regen_add[i] = MinVal(8);
        stam_regen_add[i].a <== stam_after_cost[i] + active_opp[i] * 3;
        stam_regen_add[i].cap <== 100;
        my_stam[i + 1] <== stam_regen_add[i].out;

        // ---- My punch damage to opponent ----
        // dmg = my_punch_hit * (20 - opp_block * 10)
        my_punch_dmg[i] <== my_punch_hit[i] * (20 - opp_block[i] * 10);

        opp_hp_sub[i] = SafeSub(8);
        opp_hp_sub[i].a <== opp_hp[i];
        opp_hp_sub[i].b <== my_punch_dmg[i];
        opp_hp[i + 1] <== opp_hp_sub[i].out;

        // ---- Opponent punch damage to me (always 20) ----
        opp_punch_dmg[i] <== opp_punch_hit[i] * 20;

        my_hp_sub[i] = SafeSub(8);
        my_hp_sub[i].a <== my_hp[i];
        my_hp_sub[i].b <== opp_punch_dmg[i];
        my_hp[i + 1] <== my_hp_sub[i].out;
    }

    // ================================================================
    // PROPERTY 4: Result Consistency
    // ================================================================

    // Final health must match claimed values
    my_hp[MAX_INPUTS] === my_final_health;
    opp_hp[MAX_INPUTS] === opponent_final_health;

    // Winner consistency:
    // i_won == 1 iff my_hp > opp_hp
    // i_won == 0 iff my_hp < opp_hp
    // i_won == 2 iff my_hp == opp_hp
    component hp_gt = GreaterThan(8);
    hp_gt.in[0] <== my_hp[MAX_INPUTS];
    hp_gt.in[1] <== opp_hp[MAX_INPUTS];

    component hp_lt = LessThan(8);
    hp_lt.in[0] <== my_hp[MAX_INPUTS];
    hp_lt.in[1] <== opp_hp[MAX_INPUTS];

    component hp_eq = IsEqual();
    hp_eq.in[0] <== my_hp[MAX_INPUTS];
    hp_eq.in[1] <== opp_hp[MAX_INPUTS];

    // i_won should be: hp_gt * 1 + hp_eq * 2 + hp_lt * 0
    // = hp_gt + hp_eq * 2
    signal expected_i_won;
    expected_i_won <== hp_gt.out + hp_eq.out * 2;
    expected_i_won === i_won;
}

component main {public [input_log_hash, my_final_health, opponent_final_health, i_won]} = ZKombat(128);
