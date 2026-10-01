import { assetIdentity, type AssetId, type AssetIdentity } from '../../core/src/index.js';
export type ProviderErrorCode =
  | 'invalid_account'
  | 'insufficient_float'
  | 'limit_exceeded'
  | 'duplicate'
  | 'timeout'
  | 'unavailable'
  | 'rejected'
  | 'unknown';
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly ambiguous = false,
  ) {
    super(message);
  }
}
export interface PayoutRequest {
  instruction_id: string;
  hold_id: string;
  asset: AssetId;
  amount_minor: string;
  fee_minor?: string;
  beneficiary: string;
  provider_binding?: string;
  bank_identity?: { bank_code: string; account_hash: string };
  stellar_identity?: { network: 'testnet'; issuer: string; code: 'KUSD'; source: string };
  scenario?: 'success' | 'timeout' | 'insufficient_float';
  destination?: { asset: AssetId; amount_minor: string; instrument_id: string };
}
export interface ProviderEvidence {
  instruction_id: string;
  hold_id: string;
  source_asset: AssetId;
  source_minor: string;
  fee_minor: string;
  destination_asset: AssetId;
  destination_minor: string;
  beneficiary: string;
  instrument_id: string | null;
  source_identity: AssetIdentity;
  destination_identity: AssetIdentity;
}
export interface ProviderStatus {
  provider_ref: string;
  outcome: 'confirmed' | 'rejected' | 'returned';
  evidence?: ProviderEvidence;
  provider_data?: { id: string; transfer_status: string; fee_minor: string; domain: 'test' };
  stellar_data?: {
    hash: string;
    network: 'testnet';
    issuer: string;
    code: 'KUSD';
    ledger: number;
    fee_stroops: string;
    source: string;
    destination: string;
    amount_minor: string;
  };
}
export function evidenceFor(request: PayoutRequest): ProviderEvidence {
  const destination = request.destination;
  return {
    instruction_id: request.instruction_id,
    hold_id: request.hold_id,
    source_asset: request.asset,
    source_minor: request.amount_minor,
    fee_minor: request.fee_minor ?? '0',
    destination_asset: destination?.asset ?? request.asset,
    destination_minor: destination?.amount_minor ?? request.amount_minor,
    beneficiary: request.beneficiary,
    instrument_id: destination?.instrument_id ?? null,
    source_identity: assetIdentity(request.asset),
    destination_identity: request.stellar_identity
      ? { id: 'KUSD', kind: 'stellar', network: 'testnet', issuer: request.stellar_identity.issuer }
      : assetIdentity(destination?.asset ?? request.asset),
  };
}
export interface Connector {
  readonly id: string;
  readonly binding?: string;
  readonly capabilities: readonly ['payout', 'status'];
  readonly idempotentInstructions: boolean;
  payout(request: PayoutRequest): Promise<ProviderStatus>;
  fetchStatus(instructionId: string): Promise<ProviderStatus | null>;
}
