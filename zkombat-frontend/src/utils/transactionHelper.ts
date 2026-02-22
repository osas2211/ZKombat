/**
 * Transaction helper utilities
 */

import { contract } from '@stellar/stellar-sdk';

/**
 * Sign and send a transaction via Launchtube
 * @param tx - The assembled transaction or XDR string
 * @param timeoutInSeconds - Timeout for the transaction
 * @param validUntilLedgerSeq - Valid until ledger sequence
 * @returns Transaction result
 */
export async function signAndSendViaLaunchtube(
  tx: contract.AssembledTransaction<any> | string,
  timeoutInSeconds: number = 30,
  validUntilLedgerSeq?: number
): Promise<contract.SentTransaction<any>> {
  // If tx is an AssembledTransaction, simulate and send
  if (typeof tx !== 'string' && 'simulate' in tx) {
    const simulated = await tx.simulate();
    const sent = await simulated.signAndSend({ force: true });
    const hash = sent.sendTransactionResponse?.hash;

    // The SDK may not throw on failed transactions — check explicitly
    const txResponse = sent.getTransactionResponse as Record<string, unknown> | undefined;
    const status = txResponse?.status as string | undefined;
    if (status === 'FAILED') {
      console.error('[signAndSend] Transaction FAILED on-chain, hash:', hash);
      throw new Error(`Transaction failed on-chain (hash: ${hash}). The contract execution trapped — likely a footprint mismatch from stale simulation.`);
    }

    console.log('[signAndSend] Transaction confirmed, hash:', hash);
    return sent;
  }

  // If tx is XDR string, it needs to be sent directly
  throw new Error('Direct XDR submission not yet implemented. Use AssembledTransaction.signAndSend() instead.');
}
