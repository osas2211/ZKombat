# ZKombat

A real-time 1v1 fighting game on Stellar that uses zero-knowledge proofs as a trustless anti-cheat system. Players fight off-chain via WebRTC peer-to-peer connections, then each generates a Groth16 ZK proof in the browser attesting to fair play. Both proofs are verified on-chain through Soroban's native BN254 pairing precompiles (Protocol 25+), and the match result is settled entirely on-chain with points, leaderboards, and Game Hub integration.

**Hackathon:** Stellar Hacks: ZK Gaming

**Network:** Stellar Testnet

## How It Works

```
Player 1 (Browser)                    Player 2 (Browser)
    |                                       |
    |<-------- WebRTC P2P Fight ----------->|
    |                                       |
    |  Record inputs (punches, blocks,      |
    |  timestamps, hits)                    |
    |                                       |
    v                                       v
 Generate Groth16 proof              Generate Groth16 proof
 (snarkjs + Poseidon)                (snarkjs + Poseidon)
    |                                       |
    v                                       v
 Submit proof tx to Stellar          Submit proof tx to Stellar
    |                                       |
    +----------> Soroban Contract <---------+
                      |
                      v
              Groth16 Verifier Contract
              (BN254 pairing check)
                      |
                      v
              Both proofs valid?
              Determine winner on-chain
              Award points + update leaderboard
              Call Game Hub end_game()
```

## The Anti-Cheat Circuit

The ZK circuit (`circuits/zkombat-circom/zkombat.circom`) proves four properties about each player's match without revealing the full input log:

### Property 1: Input Log Integrity
Every recorded action (punch, block, timestamp, hit result) is hashed into a Poseidon hash chain. The on-chain `input_log_hash` must match the circuit's computed hash, proving the player hasn't tampered with their action history.

```
Chain: acc = Poseidon(acc + f1, f2) for each active input
Final: hash_acc[MAX_INPUTS] === input_log_hash
```

### Property 2: Human Reaction Time
Consecutive player actions must have at least 80ms between them. This prevents bot automation and inhuman input speeds.

```
delta = timestamp_ms[i] - last_my_ts[i]
assert: delta >= 80ms for consecutive player actions
```

### Property 3: Valid Game Simulation
The circuit re-simulates the entire match using the recorded inputs and enforces correct game rules:

| Rule | Value |
|------|-------|
| Starting Health | 100 |
| Starting Stamina | 100 |
| Punch Damage | 20 (10 if blocked) |
| Punch Stamina Cost | 15 |
| Block Stamina Cost | 5 |
| Stamina Regen | 3 per opponent action |

The circuit enforces that every punch requires sufficient stamina, damage calculations are correct, and health never underflows.

### Property 4: Result Consistency
The circuit verifies that the claimed final health values and winner determination (`i_won`) match the simulated game state:

```
my_hp[MAX_INPUTS] === my_final_health
opp_hp[MAX_INPUTS] === opponent_final_health
expected_i_won = (my_hp > opp_hp) ? 1 : (my_hp < opp_hp) ? 0 : 2
expected_i_won === i_won
```

## On-Chain Verification

### Groth16 Verifier Contract

The verifier contract (`contracts/circom-groth16-verifier/`) performs real cryptographic verification using Soroban's native BN254 host functions -- not a mock. It executes the standard Groth16 pairing check:

```
e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) = 1
```

Using native operations:
- `env.crypto().bn254().g1_mul()` -- G1 scalar multiplication
- `env.crypto().bn254().g1_add()` -- G1 point addition
- `env.crypto().bn254().pairing_check()` -- BN254 pairing verification

The verification key is stored on-chain and was generated from a Groth16 trusted setup ceremony over the compiled circuit.

### ZKombat Contract

When a player calls `submit_proof`, the contract:

1. Parses the 256-byte proof into BN254 curve points (A: G1, B: G2, C: G1)
2. Constructs public inputs as field elements: `[input_log_hash, my_final_health, opponent_final_health, i_won]`
3. Calls the verifier contract via cross-contract invocation
4. Rejects the proof if verification fails (`Error::VerificationFailed`)
5. Stores the verified submission and resolves the match when both proofs arrive

```rust
// Cross-contract Groth16 verification (contracts/zkombat/src/lib.rs)
let verifier = VerifierClient::new(&env, &verifier_addr);
match verifier.try_verify(&proof, &pub_inputs) {
    Ok(Ok(true)) => {} // Proof valid, continue
    _ => return Err(Error::VerificationFailed),
}
```

## Game Hub Integration

ZKombat fully integrates with the Stellar Game Studio ecosystem's Game Hub contract, calling `start_game` and `end_game` at the correct lifecycle points.

### `start_game()` -- Called in two paths:

1. **Explicit match creation** (`create_match`): When both players join a lobby, `start_game` is called before storing the match state.
2. **P2P auto-create** (`submit_proof`): For WebRTC peer-to-peer matches, the first player's proof auto-creates the match. When the second player submits, `start_game` is called with both real player addresses before resolution.

```rust
game_hub.start_game(
    &env.current_contract_address(), // game_id
    &session_id,
    &player1,
    &player2,
    &player1_points,
    &player2_points,
);
```

### `end_game()` -- Called in three paths:

1. **Match resolution** (`resolve_match_internal`): After both proofs are verified, the winner is determined by comparing final health values, points are awarded, and `end_game` is called.
2. **Draw resolution**: Same path but with `MatchStatus::Draw`.
3. **Forfeit** (`claim_forfeit`): If one player submits a proof and the opponent doesn't respond within ~1 hour (720 ledgers), the submitter can claim a forfeit win.

```rust
game_hub.end_game(&session_id, &player1_won);
```

### On-Chain Scoring

| Event | Points |
|-------|--------|
| Win | 100 |
| Loss | 10 |
| Draw | 30 |
| Perfect Win (100 HP) | +50 bonus |
| Comeback Win (<=20 HP) | +30 bonus |
| Win Streak | +10 per level (max 5) |
| Forfeit Win | 75 |

All stats (wins, losses, streaks, perfect/comeback wins) and a top-20 leaderboard are maintained on-chain.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Rust / Soroban SDK |
| ZK Circuit | Circom 2.1.6 / Groth16 |
| Proof Generation | snarkjs (browser) + circomlibjs (Poseidon) |
| On-Chain Verification | Soroban BN254 native precompiles |
| Frontend | React 19 + Vite 7 + TypeScript |
| Networking | WebRTC (peer-to-peer via WebSocket signaling) |
| Wallet | Stellar Wallets Kit (Freighter, xBull, etc.) |
| Styling | Tailwind CSS + GSAP animations |

## Deployed Contracts (Testnet)

| Contract | Address |
|----------|---------|
| ZKombat | `CD3D2YYADCVELNDRJP6K24EIDVTBWQXY65N2SKCMFIJERWLGVRJNBJSS` |
| Groth16 Verifier | `CBCUZJICFNZ4ON5OWLE45Z47J7T3BWWM6O7YKSRYYG5CWUCPJUGIU6TI` |
| Game Hub | `CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG` |

## Project Structure

```
ZKombat/
├── contracts/
│   ├── zkombat/src/lib.rs              # Main game contract (match lifecycle,
│   │                                   #   proof submission, scoring, Game Hub calls)
│   ├── circom-groth16-verifier/        # On-chain Groth16 verifier (BN254 pairing)
│   ├── contract-types/                 # Shared types (Groth16Proof, VerificationKeyBytes)
│   └── mock-game-hub/                  # Mock Game Hub for testing
│
├── circuits/zkombat-circom/
│   ├── zkombat.circom                  # Anti-cheat circuit (4 properties, 128 max inputs)
│   ├── build/                          # Compiled WASM + R1CS
│   ├── circuit_final.zkey              # Groth16 proving key
│   └── vk.json                        # Verification key
│
├── zkombat-frontend/
│   ├── src/
│   │   ├── zk/
│   │   │   ├── ProofGenerator.ts       # Browser-side Groth16 proof generation
│   │   │   ├── InputRecorder.ts        # Records game actions for ZK input
│   │   │   └── types.ts               # ZK type definitions
│   │   ├── game/engine/
│   │   │   ├── useGameLoop.ts          # Game loop + ZK input recording
│   │   │   ├── Fighter.ts             # Fighter class + game constants
│   │   │   └── Sprite.ts              # Sprite rendering
│   │   ├── games/zkombat/
│   │   │   ├── zkombatService.ts       # Contract interaction (submitProof, etc.)
│   │   │   └── bindings.ts            # Generated TypeScript bindings
│   │   ├── webrtc/                     # WebRTC peer-to-peer connection
│   │   ├── pages/PlayPage.tsx          # Main game page (lobby, fight, proof, result)
│   │   └── hooks/useWalletStandalone.ts # Wallet connection hook
│   ├── server/signaling.ts             # WebSocket signaling server (Bun)
│   └── public/
│       ├── zkombat-circuit.wasm        # Compiled circuit for browser proving
│       └── zkombat.zkey                # Proving key for browser proving
│
├── deployment.json                     # Deployed contract addresses
└── CLAUDE.md                           # Development guide
```

## Key Files for Judges

| What | File | What to Look For |
|------|------|-----------------|
| ZK Circuit | `circuits/zkombat-circom/zkombat.circom` | All 4 anti-cheat properties in ~330 lines of Circom |
| On-Chain Verifier | `contracts/circom-groth16-verifier/src/lib.rs` | Real BN254 pairing check, not a mock |
| Game Contract | `contracts/zkombat/src/lib.rs` | `submit_proof` cross-contract verification, `start_game`/`end_game` calls, scoring |
| Contract Tests | `contracts/zkombat/src/test.rs` | 28 tests covering full match flow, proofs, forfeits, leaderboard |
| Proof Generation | `zkombat-frontend/src/zk/ProofGenerator.ts` | Browser Groth16 proving with snarkjs + Poseidon |
| Input Recording | `zkombat-frontend/src/game/engine/useGameLoop.ts` | How game actions feed into ZK circuit inputs |
| Contract Service | `zkombat-frontend/src/games/zkombat/zkombatService.ts` | Real Stellar transaction construction and submission |

## Running Locally

```bash
# Install dependencies
bun install

# Start the signaling server
cd zkombat-frontend && bun run server

# In another terminal, start the frontend
cd zkombat-frontend && bun run dev
```

Open two browser tabs to `http://localhost:3000`. One creates a room, the other joins with the room code. Fight, and watch the ZK proofs generate and submit on-chain.

## Future Potential

- **Tournament Mode**: Bracket-style tournaments with on-chain prize pools and ZK-verified results at every round
- **Replay Verification**: Since the full input log is committed via Poseidon hash, anyone can replay a match given the inputs and independently verify fair play
- **Cross-Game Anti-Cheat**: The circuit pattern (input integrity + reaction time + state simulation + result consistency) generalizes to any deterministic game -- card games, strategy games, racing games
- **Mainnet Deployment**: Move to Stellar mainnet with real XLM stakes and Soroban's production-grade BN254 precompiles
- **Mobile Support**: WebRTC and snarkjs both work on mobile browsers -- extend to touch controls for mobile fighting
- **Spectator Mode**: Broadcast encrypted game state via WebRTC, allow spectators to verify proofs after the match
- **NFT Integration**: Mint character skins or achievement badges as Stellar assets, unlocked by on-chain verified milestones (e.g., 10 perfect wins)

## License

MIT
