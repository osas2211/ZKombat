import { Client as ZkombatClient, type GameMatch, type PlayerStats, type LeaderboardEntry } from './bindings';
import { NETWORK_PASSPHRASE, RPC_URL, DEFAULT_METHOD_OPTIONS, DEFAULT_AUTH_TTL_MINUTES, MULTI_SIG_AUTH_TTL_MINUTES } from '@/utils/constants';
import { contract, TransactionBuilder, StrKey, xdr, Address, authorizeEntry } from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';
import { signAndSendViaLaunchtube } from '@/utils/transactionHelper';
import { calculateValidUntilLedger } from '@/utils/ledgerUtils';
import { injectSignedAuthEntry } from '@/utils/authEntryUtils';

type ClientOptions = contract.ClientOptions;

/**
 * Service for interacting with the ZKombat game contract.
 *
 * The new contract uses ZK proof verification for match resolution:
 *   create_match -> (off-chain fight via WebRTC) -> submit_proof (both players) -> resolved
 */
export class ZkombatService {
  private baseClient: ZkombatClient;
  private contractId: string;

  constructor(contractId: string) {
    this.contractId = contractId;
    this.baseClient = new ZkombatClient({
      contractId: this.contractId,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
    });
  }

  private createSigningClient(
    publicKey: string,
    signer: Pick<contract.ClientOptions, 'signTransaction' | 'signAuthEntry'>
  ): ZkombatClient {
    const options: ClientOptions = {
      contractId: this.contractId,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey,
      ...signer,
    };
    return new ZkombatClient(options);
  }

  // ================================================================
  // Read-Only Queries
  // ================================================================

  async getMatch(sessionId: number): Promise<GameMatch | null> {
    try {
      const tx = await this.baseClient.get_match({ session_id: sessionId });
      const result = await tx.simulate();
      if (result.result.isOk()) {
        return result.result.unwrap();
      }
      return null;
    } catch {
      return null;
    }
  }

  async getPlayerStats(player: string): Promise<PlayerStats | null> {
    try {
      const tx = await this.baseClient.get_player_stats({ player });
      const result = await tx.simulate();
      return result.result;
    } catch {
      return null;
    }
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const tx = await this.baseClient.get_leaderboard();
      const result = await tx.simulate();
      return result.result;
    } catch {
      return [];
    }
  }

  // ================================================================
  // Match Creation (multi-sig flow)
  // ================================================================

  /**
   * STEP 1 (Player 1): Prepare a create_match transaction and export signed auth entry
   */
  async prepareCreateMatch(
    sessionId: number,
    player1: string,
    player2: string,
    player1Points: bigint,
    player2Points: bigint,
    player1Signer: Pick<contract.ClientOptions, 'signTransaction' | 'signAuthEntry'>,
    authTtlMinutes?: number
  ): Promise<string> {
    const buildClient = new ZkombatClient({
      contractId: this.contractId,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey: player2,
    });

    const tx = await buildClient.create_match({
      session_id: sessionId,
      player1,
      player2,
      player1_points: player1Points,
      player2_points: player2Points,
    }, DEFAULT_METHOD_OPTIONS);

    if (!tx.simulationData?.result?.auth) {
      throw new Error('No auth entries found in simulation');
    }

    const authEntries = tx.simulationData.result.auth;
    let player1AuthEntry = null;

    for (let i = 0; i < authEntries.length; i++) {
      const entry = authEntries[i];
      try {
        const entryAddress = entry.credentials().address().address();
        const entryAddressString = Address.fromScAddress(entryAddress).toString();
        if (entryAddressString === player1) {
          player1AuthEntry = entry;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!player1AuthEntry) {
      throw new Error(`No auth entry found for Player 1 (${player1}).`);
    }

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, MULTI_SIG_AUTH_TTL_MINUTES);

    if (!player1Signer.signAuthEntry) {
      throw new Error('signAuthEntry function not available');
    }

    const signedAuthEntry = await authorizeEntry(
      player1AuthEntry,
      async (preimage) => {
        if (!player1Signer.signAuthEntry) throw new Error('No signAuthEntry');
        const signResult = await player1Signer.signAuthEntry(
          preimage.toXDR('base64'),
          { networkPassphrase: NETWORK_PASSPHRASE, address: player1 }
        );
        if (signResult.error) throw new Error(`Failed to sign: ${signResult.error.message}`);
        return Buffer.from(signResult.signedAuthEntry, 'base64');
      },
      validUntilLedgerSeq,
      NETWORK_PASSPHRASE,
    );

    return signedAuthEntry.toXDR('base64');
  }

  /**
   * Parse a signed auth entry to extract game parameters
   */
  parseAuthEntry(authEntryXdr: string): {
    sessionId: number;
    player1: string;
    player1Points: bigint;
    functionName: string;
  } {
    const authEntry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryXdr, 'base64');
    const addressCreds = authEntry.credentials().address();
    const player1 = Address.fromScAddress(addressCreds.address()).toString();
    const rootInvocation = authEntry.rootInvocation();
    const contractFn = rootInvocation.function().contractFn();
    const functionName = contractFn.functionName().toString();

    if (functionName !== 'create_match') {
      throw new Error(`Unexpected function: ${functionName}. Expected create_match.`);
    }

    const args = contractFn.args();
    if (args.length !== 2) {
      throw new Error(`Expected 2 arguments, got ${args.length}`);
    }

    return {
      sessionId: args[0].u32(),
      player1,
      player1Points: args[1].i128().lo().toBigInt(),
      functionName,
    };
  }

  /**
   * STEP 2 (Player 2): Import Player 1's signed auth entry and rebuild transaction
   */
  async importAndSignAuthEntry(
    player1SignedAuthEntryXdr: string,
    player2Address: string,
    player2Points: bigint,
    player2Signer: Pick<contract.ClientOptions, 'signTransaction' | 'signAuthEntry'>,
    authTtlMinutes?: number
  ): Promise<string> {
    const gameParams = this.parseAuthEntry(player1SignedAuthEntryXdr);

    if (player2Address === gameParams.player1) {
      throw new Error('Cannot play against yourself.');
    }

    const buildClient = new ZkombatClient({
      contractId: this.contractId,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey: player2Address,
    });

    const tx = await buildClient.create_match({
      session_id: gameParams.sessionId,
      player1: gameParams.player1,
      player2: player2Address,
      player1_points: gameParams.player1Points,
      player2_points: player2Points,
    }, DEFAULT_METHOD_OPTIONS);

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, MULTI_SIG_AUTH_TTL_MINUTES);

    const txWithInjectedAuth = await injectSignedAuthEntry(
      tx,
      player1SignedAuthEntryXdr,
      player2Address,
      player2Signer,
      validUntilLedgerSeq
    );

    const player2Client = this.createSigningClient(player2Address, player2Signer);
    const player2Tx = player2Client.txFromXDR(txWithInjectedAuth.toXDR());

    const needsSigning = await player2Tx.needsNonInvokerSigningBy();
    if (needsSigning.includes(player2Address)) {
      await player2Tx.signAuthEntries({ expiration: validUntilLedgerSeq });
    }

    return player2Tx.toXDR();
  }

  /**
   * STEP 3: Finalize and submit the create_match transaction
   */
  async finalizeCreateMatch(
    txXdr: string,
    signerAddress: string,
    signer: Pick<contract.ClientOptions, 'signTransaction' | 'signAuthEntry'>,
    authTtlMinutes?: number
  ) {
    const client = this.createSigningClient(signerAddress, signer);
    const tx = client.txFromXDR(txXdr);
    await tx.simulate();

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, DEFAULT_AUTH_TTL_MINUTES);

    const sentTx = await signAndSendViaLaunchtube(
      tx,
      DEFAULT_METHOD_OPTIONS.timeoutInSeconds,
      validUntilLedgerSeq
    );
    return sentTx.result;
  }

  // ================================================================
  // Proof Submission
  // ================================================================

  /**
   * Submit a ZK proof after the fight.
   * This calls submit_proof on the contract which verifies the Groth16
   * proof via the Circom verifier and stores the result.
   */
  async submitProof(
    sessionId: number,
    playerAddress: string,
    proofBytes: Uint8Array,
    inputHash: Uint8Array,
    myFinalHealth: number,
    opponentFinalHealth: number,
    totalDamageDealt: number,
    iWon: number,
    signer: Pick<contract.ClientOptions, 'signTransaction' | 'signAuthEntry'>,
    authTtlMinutes?: number
  ) {
    const client = this.createSigningClient(playerAddress, signer);
    const tx = await client.submit_proof({
      session_id: sessionId,
      player: playerAddress,
      proof_bytes: Buffer.from(proofBytes),
      input_hash: Buffer.from(inputHash),
      my_final_health: myFinalHealth,
      opponent_final_health: opponentFinalHealth,
      total_damage_dealt: totalDamageDealt,
      i_won: iWon,
    }, DEFAULT_METHOD_OPTIONS);

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, DEFAULT_AUTH_TTL_MINUTES);

    const sentTx = await signAndSendViaLaunchtube(
      tx,
      DEFAULT_METHOD_OPTIONS.timeoutInSeconds,
      validUntilLedgerSeq
    );
    return sentTx.result;
  }

  // ================================================================
  // Forfeit
  // ================================================================

  /**
   * Claim a forfeit win when the opponent hasn't submitted their proof
   * within the timeout period (~1 hour / 720 ledgers).
   */
  async claimForfeit(
    sessionId: number,
    claimerAddress: string,
    signer: Pick<contract.ClientOptions, 'signTransaction' | 'signAuthEntry'>,
    authTtlMinutes?: number
  ) {
    const client = this.createSigningClient(claimerAddress, signer);
    const tx = await client.claim_forfeit({
      session_id: sessionId,
      claimer: claimerAddress,
    }, DEFAULT_METHOD_OPTIONS);

    const validUntilLedgerSeq = authTtlMinutes
      ? await calculateValidUntilLedger(RPC_URL, authTtlMinutes)
      : await calculateValidUntilLedger(RPC_URL, DEFAULT_AUTH_TTL_MINUTES);

    const sentTx = await signAndSendViaLaunchtube(
      tx,
      DEFAULT_METHOD_OPTIONS.timeoutInSeconds,
      validUntilLedgerSeq
    );
    return sentTx.result;
  }

  // ================================================================
  // Helpers
  // ================================================================

  /**
   * Parse transaction XDR to extract game details
   */
  parseTransactionXDR(txXdr: string): {
    sessionId: number;
    player1: string;
    player2: string;
    player1Points: bigint;
    player2Points: bigint;
    transactionSource: string;
    functionName: string;
  } {
    const transaction = TransactionBuilder.fromXDR(txXdr, NETWORK_PASSPHRASE);
    const transactionSource = 'source' in transaction ? transaction.source : '';
    const operation = transaction.operations[0];

    if (!operation || operation.type !== 'invokeHostFunction') {
      throw new Error('Transaction does not contain a contract invocation');
    }

    const invokeContractArgs = operation.func.invokeContract();
    const functionName = invokeContractArgs.functionName().toString();

    if (functionName !== 'create_match') {
      throw new Error(`Unexpected function: ${functionName}. Expected create_match.`);
    }

    const args = invokeContractArgs.args();
    if (args.length !== 5) {
      throw new Error(`Expected 5 arguments, got ${args.length}`);
    }

    return {
      sessionId: args[0].u32(),
      player1: StrKey.encodeEd25519PublicKey(args[1].address().accountId().ed25519()),
      player2: StrKey.encodeEd25519PublicKey(args[2].address().accountId().ed25519()),
      player1Points: args[3].i128().lo().toBigInt(),
      player2Points: args[4].i128().lo().toBigInt(),
      transactionSource,
      functionName,
    };
  }

  async checkRequiredSignatures(txXdr: string, publicKey: string): Promise<string[]> {
    const client = this.createSigningClient(publicKey, {
      signTransaction: async (xdr: string) => ({ signedTxXdr: xdr }),
      signAuthEntry: async (xdr: string) => ({ signedAuthEntry: xdr }),
    });
    const tx = client.txFromXDR(txXdr);
    return tx.needsNonInvokerSigningBy();
  }
}
