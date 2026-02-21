import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAW62T2GKIGBDWACSO2CTKQMBZFHIEAGRU64NVRVGIA43RKUSKBY4SD7",
  }
} as const

export const Errors = {
  1: {message:"MatchNotFound"},
  2: {message:"NotPlayer"},
  3: {message:"InvalidMatchState"},
  4: {message:"ProofAlreadySubmitted"},
  5: {message:"VerificationFailed"},
  6: {message:"ResultMismatch"},
  7: {message:"MatchAlreadyEnded"},
  8: {message:"ForfeitNotAllowed"},
  9: {message:"VerifierNotSet"},
  10: {message:"SelfPlay"}
}

export type DataKey = {tag: "Match", values: readonly [u32]} | {tag: "P1Proof", values: readonly [u32]} | {tag: "P2Proof", values: readonly [u32]} | {tag: "PlayerStats", values: readonly [string]} | {tag: "Leaderboard", values: void} | {tag: "GameHubAddress", values: void} | {tag: "Admin", values: void} | {tag: "VerifierAddress", values: void} | {tag: "PointConfig", values: void};


export interface GameMatch {
  created_ledger: u32;
  p1_proof_submitted: boolean;
  p2_proof_submitted: boolean;
  player1: string;
  player1_points: i128;
  player2: string;
  player2_points: i128;
  status: MatchStatus;
  winner: Option<string>;
}

export enum MatchStatus {
  Active = 0,
  ProofPhase = 1,
  Resolved = 2,
  Forfeit = 3,
  Draw = 4,
}


export interface PlayerStats {
  best_streak: u32;
  comeback_wins: u32;
  draws: u32;
  losses: u32;
  perfect_wins: u32;
  total_matches: u32;
  total_points: i128;
  win_streak: u32;
  wins: u32;
}


export interface PointConfig {
  comeback_bonus: i128;
  comeback_threshold: u32;
  draw_points: i128;
  forfeit_win_points: i128;
  loss_points: i128;
  max_streak_bonus_levels: u32;
  perfect_bonus: i128;
  starting_health: u32;
  streak_bonus_per_level: i128;
  win_points: i128;
}


export interface ProofSubmission {
  i_won: boolean;
  input_hash: Buffer;
  my_final_health: u32;
  opponent_final_health: u32;
  total_damage_dealt: u32;
}


export interface LeaderboardEntry {
  player: string;
  points: i128;
}

export interface Client {
  /**
   * Construct and simulate a get_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_hub: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_hub: ({new_hub}: {new_hub: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a get_match transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_match: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<GameMatch>>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_match transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_match: ({session_id, player1, player2, player1_points, player2_points}: {session_id: u32, player1: string, player2: string, player1_points: i128, player2_points: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_verifier: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_verifier transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_verifier: ({new_verifier}: {new_verifier: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a submit_proof transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_proof: ({session_id, player, proof_bytes, public_inputs, input_hash, my_final_health, opponent_final_health, total_damage_dealt, i_won}: {session_id: u32, player: string, proof_bytes: Buffer, public_inputs: Buffer, input_hash: Buffer, my_final_health: u32, opponent_final_health: u32, total_damage_dealt: u32, i_won: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a claim_forfeit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim_forfeit: ({session_id, claimer}: {session_id: u32, claimer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_leaderboard transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_leaderboard: (options?: MethodOptions) => Promise<AssembledTransaction<Array<LeaderboardEntry>>>

  /**
   * Construct and simulate a get_player_stats transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_player_stats: ({player}: {player: string}, options?: MethodOptions) => Promise<AssembledTransaction<PlayerStats>>

  /**
   * Construct and simulate a get_point_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_point_config: (options?: MethodOptions) => Promise<AssembledTransaction<PointConfig>>

  /**
   * Construct and simulate a set_point_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_point_config: ({config}: {config: PointConfig}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, game_hub, verifier}: {admin: string, game_hub: string, verifier: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, game_hub, verifier}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACgAAAAAAAAANTWF0Y2hOb3RGb3VuZAAAAAAAAAEAAAAAAAAACU5vdFBsYXllcgAAAAAAAAIAAAAAAAAAEUludmFsaWRNYXRjaFN0YXRlAAAAAAAAAwAAAAAAAAAVUHJvb2ZBbHJlYWR5U3VibWl0dGVkAAAAAAAABAAAAAAAAAASVmVyaWZpY2F0aW9uRmFpbGVkAAAAAAAFAAAAAAAAAA5SZXN1bHRNaXNtYXRjaAAAAAAABgAAAAAAAAARTWF0Y2hBbHJlYWR5RW5kZWQAAAAAAAAHAAAAAAAAABFGb3JmZWl0Tm90QWxsb3dlZAAAAAAAAAgAAAAAAAAADlZlcmlmaWVyTm90U2V0AAAAAAAJAAAAAAAAAAhTZWxmUGxheQAAAAo=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACQAAAAEAAAAAAAAABU1hdGNoAAAAAAAAAQAAAAQAAAABAAAAAAAAAAdQMVByb29mAAAAAAEAAAAEAAAAAQAAAAAAAAAHUDJQcm9vZgAAAAABAAAABAAAAAEAAAAAAAAAC1BsYXllclN0YXRzAAAAAAEAAAATAAAAAAAAAAAAAAALTGVhZGVyYm9hcmQAAAAAAAAAAAAAAAAOR2FtZUh1YkFkZHJlc3MAAAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAPVmVyaWZpZXJBZGRyZXNzAAAAAAAAAAAAAAAAC1BvaW50Q29uZmlnAA==",
        "AAAAAQAAAAAAAAAAAAAACUdhbWVNYXRjaAAAAAAAAAkAAAAAAAAADmNyZWF0ZWRfbGVkZ2VyAAAAAAAEAAAAAAAAABJwMV9wcm9vZl9zdWJtaXR0ZWQAAAAAAAEAAAAAAAAAEnAyX3Byb29mX3N1Ym1pdHRlZAAAAAAAAQAAAAAAAAAHcGxheWVyMQAAAAATAAAAAAAAAA5wbGF5ZXIxX3BvaW50cwAAAAAACwAAAAAAAAAHcGxheWVyMgAAAAATAAAAAAAAAA5wbGF5ZXIyX3BvaW50cwAAAAAACwAAAAAAAAAGc3RhdHVzAAAAAAfQAAAAC01hdGNoU3RhdHVzAAAAAAAAAAAGd2lubmVyAAAAAAPoAAAAEw==",
        "AAAAAwAAAAAAAAAAAAAAC01hdGNoU3RhdHVzAAAAAAUAAAAAAAAABkFjdGl2ZQAAAAAAAAAAAAAAAAAKUHJvb2ZQaGFzZQAAAAAAAQAAAAAAAAAIUmVzb2x2ZWQAAAACAAAAAAAAAAdGb3JmZWl0AAAAAAMAAAAAAAAABERyYXcAAAAE",
        "AAAAAQAAAAAAAAAAAAAAC1BsYXllclN0YXRzAAAAAAkAAAAAAAAAC2Jlc3Rfc3RyZWFrAAAAAAQAAAAAAAAADWNvbWViYWNrX3dpbnMAAAAAAAAEAAAAAAAAAAVkcmF3cwAAAAAAAAQAAAAAAAAABmxvc3NlcwAAAAAABAAAAAAAAAAMcGVyZmVjdF93aW5zAAAABAAAAAAAAAANdG90YWxfbWF0Y2hlcwAAAAAAAAQAAAAAAAAADHRvdGFsX3BvaW50cwAAAAsAAAAAAAAACndpbl9zdHJlYWsAAAAAAAQAAAAAAAAABHdpbnMAAAAE",
        "AAAAAQAAAAAAAAAAAAAAC1BvaW50Q29uZmlnAAAAAAoAAAAAAAAADmNvbWViYWNrX2JvbnVzAAAAAAALAAAAAAAAABJjb21lYmFja190aHJlc2hvbGQAAAAAAAQAAAAAAAAAC2RyYXdfcG9pbnRzAAAAAAsAAAAAAAAAEmZvcmZlaXRfd2luX3BvaW50cwAAAAAACwAAAAAAAAALbG9zc19wb2ludHMAAAAACwAAAAAAAAAXbWF4X3N0cmVha19ib251c19sZXZlbHMAAAAABAAAAAAAAAANcGVyZmVjdF9ib251cwAAAAAAAAsAAAAAAAAAD3N0YXJ0aW5nX2hlYWx0aAAAAAAEAAAAAAAAABZzdHJlYWtfYm9udXNfcGVyX2xldmVsAAAAAAALAAAAAAAAAAp3aW5fcG9pbnRzAAAAAAAL",
        "AAAAAQAAAAAAAAAAAAAAD1Byb29mU3VibWlzc2lvbgAAAAAFAAAAAAAAAAVpX3dvbgAAAAAAAAEAAAAAAAAACmlucHV0X2hhc2gAAAAAA+4AAAAgAAAAAAAAAA9teV9maW5hbF9oZWFsdGgAAAAABAAAAAAAAAAVb3Bwb25lbnRfZmluYWxfaGVhbHRoAAAAAAAABAAAAAAAAAASdG90YWxfZGFtYWdlX2RlYWx0AAAAAAAE",
        "AAAAAQAAAAAAAAAAAAAAEExlYWRlcmJvYXJkRW50cnkAAAACAAAAAAAAAAZwbGF5ZXIAAAAAABMAAAAAAAAABnBvaW50cwAAAAAACw==",
        "AAAAAAAAAAAAAAAHZ2V0X2h1YgAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAHc2V0X2h1YgAAAAABAAAAAAAAAAduZXdfaHViAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAJZ2V0X21hdGNoAAAAAAAAAQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAEAAAPpAAAH0AAAAAlHYW1lTWF0Y2gAAAAAAAAD",
        "AAAAAAAAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAMY3JlYXRlX21hdGNoAAAABQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAHcGxheWVyMQAAAAATAAAAAAAAAAdwbGF5ZXIyAAAAABMAAAAAAAAADnBsYXllcjFfcG9pbnRzAAAAAAALAAAAAAAAAA5wbGF5ZXIyX3BvaW50cwAAAAAACwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAMZ2V0X3ZlcmlmaWVyAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAMc2V0X3ZlcmlmaWVyAAAAAQAAAAAAAAAMbmV3X3ZlcmlmaWVyAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAMc3VibWl0X3Byb29mAAAACQAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAGcGxheWVyAAAAAAATAAAAAAAAAAtwcm9vZl9ieXRlcwAAAAAOAAAAAAAAAA1wdWJsaWNfaW5wdXRzAAAAAAAADgAAAAAAAAAKaW5wdXRfaGFzaAAAAAAD7gAAACAAAAAAAAAAD215X2ZpbmFsX2hlYWx0aAAAAAAEAAAAAAAAABVvcHBvbmVudF9maW5hbF9oZWFsdGgAAAAAAAAEAAAAAAAAABJ0b3RhbF9kYW1hZ2VfZGVhbHQAAAAAAAQAAAAAAAAABWlfd29uAAAAAAAAAQAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIZ2FtZV9odWIAAAATAAAAAAAAAAh2ZXJpZmllcgAAABMAAAAA",
        "AAAAAAAAAAAAAAANY2xhaW1fZm9yZmVpdAAAAAAAAAIAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAAB2NsYWltZXIAAAAAEwAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAAAAAAAAAAAPZ2V0X2xlYWRlcmJvYXJkAAAAAAAAAAABAAAD6gAAB9AAAAAQTGVhZGVyYm9hcmRFbnRyeQ==",
        "AAAAAAAAAAAAAAAQZ2V0X3BsYXllcl9zdGF0cwAAAAEAAAAAAAAABnBsYXllcgAAAAAAEwAAAAEAAAfQAAAAC1BsYXllclN0YXRzAA==",
        "AAAAAAAAAAAAAAAQZ2V0X3BvaW50X2NvbmZpZwAAAAAAAAABAAAH0AAAAAtQb2ludENvbmZpZwA=",
        "AAAAAAAAAAAAAAAQc2V0X3BvaW50X2NvbmZpZwAAAAEAAAAAAAAABmNvbmZpZwAAAAAH0AAAAAtQb2ludENvbmZpZwAAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_hub: this.txFromJSON<string>,
        set_hub: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        get_admin: this.txFromJSON<string>,
        get_match: this.txFromJSON<Result<GameMatch>>,
        set_admin: this.txFromJSON<null>,
        create_match: this.txFromJSON<Result<void>>,
        get_verifier: this.txFromJSON<string>,
        set_verifier: this.txFromJSON<null>,
        submit_proof: this.txFromJSON<Result<void>>,
        claim_forfeit: this.txFromJSON<Result<string>>,
        get_leaderboard: this.txFromJSON<Array<LeaderboardEntry>>,
        get_player_stats: this.txFromJSON<PlayerStats>,
        get_point_config: this.txFromJSON<PointConfig>,
        set_point_config: this.txFromJSON<null>
  }
}