import { createHash } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../../../packages/database/src/index.js';
import {
  ProviderError,
  evidenceFor,
  type Connector,
  type PayoutRequest,
  type ProviderStatus,
} from '../../../packages/provider-sdk/src/index.js';
import { PaystackClient, wireMinor, wireId } from './client.js';
export { PaystackClient, PaystackApiError, parseProviderJson } from './client.js';
export const transferSchema = z.object({
  id: wireId,
  domain: z.literal('test'),
  reference: z.string(),
  currency: z.literal('NGN'),
  amount: wireMinor,
  status: z.string(),
  recipient: z.object({
    recipient_code: z.string(),
    currency: z.literal('NGN'),
    domain: z.literal('test'),
    details: z.object({ bank_code: z.string(), account_number: z.string() }),
  }),
  fee_charged: wireMinor,
});
export const paystackReference = (instructionId: string) => `kora_${instructionId}`;
export class PaystackTestConnector implements Connector {
  readonly id = 'paystack-test';
  readonly capabilities = ['payout', 'status'] as const;
  readonly idempotentInstructions = true;
  get binding() {
    return this.client.binding;
  }
  constructor(readonly client: PaystackClient) {}
  assertBinding(request: PayoutRequest) {
    if (request.provider_binding !== this.binding)
      throw new ProviderError(
        'unknown',
        'Provider credentials changed; existing payments require account binding review',
        true,
      );
  }
  status(request: PayoutRequest, raw: unknown): ProviderStatus | null {
    this.assertBinding(request);
    const d = transferSchema.parse(raw);
    if (
      d.reference !== paystackReference(request.instruction_id) ||
      d.amount !== request.destination?.amount_minor ||
      d.recipient.recipient_code !== request.beneficiary ||
      request.asset !== 'NGN' ||
      request.destination?.asset !== 'NGN' ||
      request.amount_minor !== request.destination.amount_minor
    )
      throw new ProviderError(
        'unknown',
        'Paystack transfer evidence does not match the immutable instruction',
        true,
      );
    if (
      !request.bank_identity ||
      d.recipient.details.bank_code !== request.bank_identity.bank_code ||
      createHash('sha256')
        .update(`${d.recipient.details.bank_code}:${d.recipient.details.account_number}`)
        .digest('hex') !== request.bank_identity.account_hash
    )
      throw new ProviderError(
        'unknown',
        'Paystack bank identity does not match the instruction',
        true,
      );
    const outcome =
      d.status === 'success'
        ? 'confirmed'
        : d.status === 'reversed'
          ? 'returned'
          : ['failed', 'abandoned', 'rejected'].includes(d.status)
            ? 'rejected'
            : null;
    if (!outcome) return null;
    return {
      provider_ref: d.reference,
      outcome,
      evidence: evidenceFor(request),
      provider_data: {
        id: d.id,
        transfer_status: d.status,
        fee_minor: d.fee_charged,
        domain: d.domain,
      },
    };
  }
  async payout(request: PayoutRequest): Promise<ProviderStatus> {
    this.assertBinding(request);
    if (
      request.asset !== 'NGN' ||
      request.destination?.asset !== 'NGN' ||
      request.amount_minor !== request.destination.amount_minor ||
      !/^RCP_[A-Za-z0-9]+$/.test(request.beneficiary)
    )
      throw new ProviderError(
        'invalid_account',
        'Only verified NGN domestic Paystack recipients are supported',
      );
    const amount = BigInt(request.destination.amount_minor);
    if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount <= 0n)
      throw new ProviderError(
        'limit_exceeded',
        'Provider amount exceeds the supported exact integer range',
      );
    await this.client.request('POST', '/transfer', {
      source: 'balance',
      currency: 'NGN',
      amount: Number(amount),
      recipient: request.beneficiary,
      reference: paystackReference(request.instruction_id),
      reason: 'Kora test-mode payout',
    });
    // A POST acknowledgement is never treated as settlement evidence.
    const status = await this.fetchStatus(request.instruction_id);
    if (!status)
      throw new ProviderError('unknown', 'Paystack transfer is pending verification', true);
    return status;
  }
  async fetchStatus(instructionId: string) {
    const instruction = (
      await pool.query(
        "SELECT request FROM instructions WHERE id=$1 AND provider='paystack-test'",
        [instructionId],
      )
    ).rows[0];
    if (!instruction) throw new ProviderError('rejected', 'Paystack instruction is not persisted');
    this.assertBinding(instruction.request);
    const raw = await this.client.verifyTransfer(paystackReference(instructionId));
    if (raw === null) return null;
    const result = this.status(instruction.request, raw);
    if (!result)
      throw new ProviderError('unknown', 'Paystack transfer is pending or requires approval', true);
    return result;
  }
}
