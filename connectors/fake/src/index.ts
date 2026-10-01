import { createHash } from 'node:crypto';
import { asset, minor } from '../../../packages/core/src/index.js';
import { pool, transaction } from '../../../packages/database/src/index.js';
import { ProviderError, evidenceFor, type Connector, type PayoutRequest, type ProviderStatus } from '../../../packages/provider-sdk/src/index.js';

// Durable simulator of a provider that accepts a stable external idempotency key.
// It never contacts a bank, signs a Stellar transaction, or moves real funds.
export class FakeConnector implements Connector {
  readonly id = 'kora-sandbox';
  readonly capabilities = ['payout', 'status'] as const;
  readonly idempotentInstructions = true;
  async payout(req: PayoutRequest): Promise<ProviderStatus> {
    asset(req.asset);
    if (!req.instruction_id || !req.beneficiary.trim() || minor(req.amount_minor) <= 0n) throw new ProviderError('invalid_account', 'Invalid sandbox payout request');
    const fee = req.fee_minor ?? '0';
    const total = minor(req.amount_minor) + minor(fee);
    if (req.destination) { asset(req.destination.asset); if(minor(req.destination.amount_minor)<=0n) throw new ProviderError('rejected','Invalid destination amount'); }
    const evidence = evidenceFor(req);
    const fingerprint = createHash('sha256').update(JSON.stringify({evidence, scenario:req.scenario ?? 'success'})).digest('hex');
    const result = await transaction(async c => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`fake:${req.instruction_id}`]);
      const existing = (await c.query('SELECT * FROM fake_provider_movements WHERE instruction_id=$1', [req.instruction_id])).rows[0];
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new ProviderError('duplicate', 'Instruction key reused with different payout contents');
        return { first: false, provider_ref: existing.provider_ref as string, outcome: existing.outcome as 'confirmed' | 'rejected', evidence:existing.evidence };
      }
      const hold = (await c.query('SELECT * FROM holds WHERE id=$1 FOR UPDATE', [req.hold_id])).rows[0];
      if (!hold || hold.state !== 'held' || hold.asset !== req.asset || hold.amount !== total.toString()) throw new ProviderError('rejected', 'Payout principal plus fee must match an active reservation');
      if ((await c.query('SELECT 1 FROM fake_provider_movements WHERE hold_id=$1', [req.hold_id])).rowCount) throw new ProviderError('duplicate', 'This reservation already has a provider instruction');
      if(req.destination) {
        const intent=(await c.query('SELECT * FROM intents WHERE hold_id=$1',[req.hold_id])).rows[0];
        const instrument=(await c.query('SELECT sandbox_identifier FROM instruments WHERE id=$1',[req.destination.instrument_id])).rows[0];
        if(!intent || intent.destination_asset!==req.destination.asset || intent.destination_minor!==req.destination.amount_minor || intent.destination_instrument_id!==req.destination.instrument_id || intent.fee_minor!==fee || instrument?.sandbox_identifier!==req.beneficiary) throw new ProviderError('rejected','Destination does not match the persisted intent');
      }
      const outcome: 'confirmed' | 'rejected' = req.scenario === 'insufficient_float' ? 'rejected' : 'confirmed';
      const provider_ref = `fake_${req.instruction_id}`;
      await c.query('INSERT INTO fake_provider_movements(instruction_id,hold_id,fingerprint,provider_ref,outcome,evidence) VALUES($1,$2,$3,$4,$5,$6)', [req.instruction_id, req.hold_id, fingerprint, provider_ref, outcome,evidence]);
      return { first: true, provider_ref, outcome, evidence };
    });
    if (req.scenario === 'timeout' && result.first) throw new ProviderError('timeout', 'Provider accepted the instruction but acknowledgement was lost', true);
    return { provider_ref: result.provider_ref, outcome: result.outcome, evidence:result.evidence };
  }
  async fetchStatus(instructionId: string): Promise<ProviderStatus | null> {
    return (await pool.query('SELECT provider_ref,outcome,evidence FROM fake_provider_movements WHERE instruction_id=$1', [instructionId])).rows[0] ?? null;
  }
}
