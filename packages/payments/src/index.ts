import {
  planned,
  reserveCorridor,
  completeCorridor,
  CorridorSandboxConnector,
} from '../../network/src/index.js';
import { recordUsage, dispatchAllowed } from '../../controls/src/index.js';
import { unseal } from './secrets.js';
import { randomBytes, createHash } from 'node:crypto';
import {
  calculateQuote,
  routeFor,
  canTransition,
  type AssetId,
  type IntentState,
} from '../../core/src/index.js';
import { pool, id, transaction, transactionOn, type Client } from '../../database/src/index.js';
import {
  reserveInTransaction,
  releaseInTransaction,
  captureInTransaction,
  postJournal,
  accountId,
} from '../../ledger/src/index.js';
import {
  evidenceFor,
  ProviderError,
  type PayoutRequest,
  type ProviderStatus,
  type Connector,
} from '../../provider-sdk/src/index.js';
import {
  PaystackClient,
  PaystackTestConnector,
  paystackReference,
} from '../../../connectors/paystack/src/index.js';
import { StellarTestnetConnector } from '../../../connectors/stellar/src/index.js';
import { FakeConnector } from '../../../connectors/fake/src/index.js';
import { canonical } from './idempotency.js';
import { PaymentError } from './errors.js';
export { PaymentError } from './errors.js';

export interface Intent {
  provider: 'kora-sandbox' | 'paystack-test' | 'stellar-testnet';
  id: string;
  merchant_id: string;
  quote_id: string;
  hold_id: string;
  customer_id: string;
  destination_instrument_id: string;
  type: 'transfer' | 'asset_purchase' | 'asset_redemption';
  state: IntentState;
  compliance_state: 'sandbox_allowed' | 'held';
  source_asset: AssetId;
  source_minor: string;
  destination_asset: AssetId;
  destination_minor: string;
  fee_minor: string;
  beneficiary: string;
  reference: string;
  scenario: 'success' | 'timeout' | 'insufficient_float';
  route: unknown;
  created_at: Date;
  updated_at: Date;
}
export function publicIntent(i: Intent) {
  return {
    provider: i.provider,
    id: i.id,
    object: 'intent',
    type: i.type,
    state: i.state,
    compliance_state: i.compliance_state,
    quote_id: i.quote_id,
    source: { asset: i.source_asset, amount_minor: i.source_minor },
    destination: {
      asset: i.destination_asset,
      amount_minor: i.destination_minor,
      instrument_id: i.destination_instrument_id,
    },
    fee: { asset: i.source_asset, amount_minor: i.fee_minor },
    customer_id: i.customer_id,
    reference: i.reference,
    route: i.route,
    created_at: i.created_at,
    updated_at: i.updated_at,
    mode: 'sandbox',
  };
}
export async function emit(c: Client, intent: Intent, type: string) {
  const eventId = id('evt'),
    data = publicIntent(intent);
  await c.query('INSERT INTO events(id,merchant_id,intent_id,type,data) VALUES($1,$2,$3,$4,$5)', [
    eventId,
    intent.merchant_id,
    intent.id,
    type,
    data,
  ]);
  await c.query(
    "INSERT INTO webhook_deliveries(id,endpoint_id,event_id) SELECT $1 || '_' || id,id,$2 FROM webhook_endpoints WHERE merchant_id=$3 AND active=true ON CONFLICT DO NOTHING",
    [id('dlv'), eventId, intent.merchant_id],
  );
  return eventId;
}
export async function transition(c: Client, intent: Intent, state: IntentState, detail: string) {
  if (intent.state === state) return intent;
  if (!canTransition(intent.state, state))
    throw new PaymentError(
      409,
      'invalid_state_transition',
      `Cannot transition from ${intent.state} to ${state}`,
    );
  const updated = (
    await c.query('UPDATE intents SET state=$2,updated_at=now() WHERE id=$1 RETURNING *', [
      intent.id,
      state,
    ])
  ).rows[0] as Intent;
  await c.query('INSERT INTO intent_history(id,intent_id,state,detail) VALUES($1,$2,$3,$4)', [
    id('hist'),
    intent.id,
    state,
    detail,
  ]);
  await emit(c, updated, `intent.${state}`);
  return updated;
}
export async function assertEnabled(c: Client, merchantId: string) {
  const merchant = (
    await c.query('SELECT enabled,max_source_minor FROM merchants WHERE id=$1', [merchantId])
  ).rows[0];
  if (!merchant?.enabled)
    throw new PaymentError(422, 'merchant_disabled', 'The merchant is held or disabled');
  return merchant;
}
export async function createQuote(
  c: Client,
  merchantId: string,
  input: { source_asset: AssetId; destination_asset: AssetId; amount_minor: string },
) {
  const merchant = await assertEnabled(c, merchantId);
  if (
    ['KUSD', 'XLM'].includes(input.source_asset) ||
    ['KUSD', 'XLM'].includes(input.destination_asset)
  )
    throw new PaymentError(
      422,
      'specialized_asset_endpoint',
      'Use the Stellar Testnet endpoints for KUSD; XLM is treasury fees only',
    );
  if (BigInt(input.amount_minor) > BigInt(merchant.max_source_minor))
    throw new PaymentError(
      422,
      'limit_exceeded',
      'Source amount exceeds the sandbox transaction limit',
    );
  let quote;
  try {
    quote = calculateQuote(input.source_asset, input.destination_asset, input.amount_minor);
  } catch {
    throw new PaymentError(
      422,
      'invalid_quote',
      'Choose distinct assets and an amount large enough to cover fees',
    );
  }
  const route = routeFor(input.source_asset, input.destination_asset);
  return (
    await c.query(
      "INSERT INTO quotes(id,merchant_id,source_asset,destination_asset,source_minor,destination_minor,fee_minor,route,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '5 minutes') RETURNING *",
      [
        id('qte'),
        merchantId,
        quote.source_asset,
        quote.destination_asset,
        quote.source_minor,
        quote.destination_minor,
        quote.fee_minor,
        JSON.stringify(route),
      ],
    )
  ).rows[0];
}
export interface IntentInput {
  quote_id: string;
  customer_id: string;
  destination_instrument_id: string;
  type: Intent['type'];
  reference: string;
  scenario: Intent['scenario'];
}
export async function createIntent(
  c: Client,
  merchantId: string,
  input: IntentInput,
): Promise<Intent> {
  const merchant = await assertEnabled(c, merchantId);
  const quote = (
    await c.query(
      'SELECT *,expires_at>now() AS valid FROM quotes WHERE id=$1 AND merchant_id=$2 FOR UPDATE',
      [input.quote_id, merchantId],
    )
  ).rows[0];
  if (!quote) throw new PaymentError(404, 'quote_not_found', 'Quote not found');
  if (!quote.valid) throw new PaymentError(422, 'quote_expired', 'Quote has expired');
  if ((await c.query('SELECT 1 FROM intents WHERE quote_id=$1', [quote.id])).rowCount)
    throw new PaymentError(409, 'quote_consumed', 'A quote can fund only one intent');
  if (BigInt(quote.source_minor) > BigInt(merchant.max_source_minor))
    throw new PaymentError(
      422,
      'limit_exceeded',
      'Source amount exceeds the sandbox transaction limit',
    );
  const customer = (
    await c.query('SELECT * FROM customers WHERE id=$1 AND merchant_id=$2 FOR SHARE', [
      input.customer_id,
      merchantId,
    ])
  ).rows[0];
  const instrument = (
    await c.query(
      'SELECT * FROM instruments WHERE id=$1 AND merchant_id=$2 AND customer_id=$3 FOR SHARE',
      [input.destination_instrument_id, merchantId, input.customer_id],
    )
  ).rows[0];
  if (!customer || !instrument)
    throw new PaymentError(
      404,
      'beneficiary_not_found',
      'Customer or destination instrument not found',
    );
  if (customer.verification_state !== 'sandbox_verified' || !instrument.verified)
    throw new PaymentError(422, 'compliance_hold', 'Customer or instrument is held');
  if (instrument.asset !== quote.destination_asset)
    throw new PaymentError(
      422,
      'asset_mismatch',
      'Destination instrument does not support this quote asset',
    );
  if (
    (input.type === 'asset_purchase' && !['USDC', 'KUSD'].includes(quote.destination_asset)) ||
    (input.type === 'asset_redemption' && !['USDC', 'KUSD'].includes(quote.source_asset))
  )
    throw new PaymentError(
      422,
      'invalid_intent_type',
      'Asset purchase requires USDC delivery; redemption requires USDC funding',
    );
  if (
    quote.provider === 'paystack-test' &&
    !(
      await c.query('SELECT 1 FROM bank_accounts WHERE instrument_id=$1 AND merchant_id=$2', [
        instrument.id,
        merchantId,
      ])
    ).rowCount
  )
    throw new PaymentError(
      422,
      'bank_account_required',
      'A provider-verified domestic NGN instrument is required',
    );
  if (
    quote.provider !== 'paystack-test' &&
    (await c.query('SELECT 1 FROM bank_accounts WHERE instrument_id=$1', [instrument.id])).rowCount
  )
    throw new PaymentError(
      422,
      'provider_mismatch',
      'Provider bank instruments require a domestic Paystack payout',
    );
  if (
    quote.provider === 'stellar-testnet' &&
    !(await c.query('SELECT 1 FROM stellar_accounts WHERE instrument_id=$1', [instrument.id]))
      .rowCount
  )
    throw new PaymentError(
      422,
      'stellar_account_required',
      'A verified Testnet account is required',
    );
  if (
    quote.provider !== 'stellar-testnet' &&
    (await c.query('SELECT 1 FROM stellar_accounts WHERE instrument_id=$1', [instrument.id]))
      .rowCount
  )
    throw new PaymentError(
      422,
      'provider_mismatch',
      'Stellar accounts require the Testnet connector',
    );
  const intentId = id('int');
  await recordUsage(
    c,
    merchantId,
    quote.source_asset,
    quote.source_minor,
    intentId,
    input.customer_id,
  );
  const hold = await reserveInTransaction(
    c,
    merchantId,
    quote.source_asset,
    quote.source_minor,
    `intent:${intentId}`,
  );
  const result = await c.query(
    "INSERT INTO intents(id,merchant_id,quote_id,type,state,source_asset,destination_asset,source_minor,destination_minor,fee_minor,beneficiary,reference,scenario,route,hold_id,customer_id,destination_instrument_id,provider) VALUES($1,$2,$3,$4,'processing',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *",
    [
      intentId,
      merchantId,
      quote.id,
      input.type,
      quote.source_asset,
      quote.destination_asset,
      quote.source_minor,
      quote.destination_minor,
      quote.fee_minor,
      instrument.label,
      input.reference,
      input.scenario,
      JSON.stringify(quote.route),
      hold.id,
      customer.id,
      instrument.id,
      quote.provider,
    ],
  );
  const intent = result.rows[0] as Intent;
  await reserveCorridor(c, intent);
  await c.query('INSERT INTO intent_history(id,intent_id,state,detail) VALUES($1,$2,$3,$4)', [
    id('hist'),
    intent.id,
    'processing',
    'Sandbox compliance approved; source funds reserved',
  ]);
  await emit(c, intent, 'intent.created');
  await c.query("INSERT INTO outbox(id,intent_id,kind) VALUES($1,$2,'execute')", [
    id('job'),
    intent.id,
  ]);
  return intent;
}
export async function cancelIntent(c: Client, merchantId: string, intentId: string) {
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`intent:${intentId}`]);
  const intent = (
    await c.query('SELECT * FROM intents WHERE id=$1 AND merchant_id=$2 FOR UPDATE', [
      intentId,
      merchantId,
    ])
  ).rows[0] as Intent | undefined;
  if (!intent) throw new PaymentError(404, 'intent_not_found', 'Intent not found');
  if (intent.state === 'canceled') return intent;
  if (
    intent.state !== 'processing' ||
    (await c.query('SELECT 1 FROM instructions WHERE intent_id=$1', [intent.id])).rowCount
  )
    throw new PaymentError(
      409,
      'cancellation_unavailable',
      'Cancellation is available only before instruction execution starts',
    );
  await releaseInTransaction(c, intent.hold_id);
  await completeCorridor(c, intent.id, 'released');
  const canceled = await transition(
    c,
    intent,
    'canceled',
    'Canceled before provider instruction creation',
  );
  await c.query(
    'UPDATE outbox SET processed_at=now(),locked_by=NULL,locked_until=NULL WHERE intent_id=$1',
    [intent.id],
  );
  return canceled;
}
export type Checkpoint =
  | 'instruction_committed'
  | 'before_provider_call'
  | 'provider_accepted'
  | 'before_settlement_commit'
  | 'settlement_committed';
export interface EngineOptions {
  connector?: Connector;
  checkpoint?: (point: Checkpoint) => Promise<void>;
  clock?: () => Date;
}
interface Instruction {
  id: string;
  intent_id: string;
  provider_ref: string;
  state: string;
  request: PayoutRequest;
}
export async function settleReceipt(
  c: Client,
  intent: Intent,
  instruction: Instruction,
  status: ProviderStatus,
  checkpoint?: EngineOptions['checkpoint'],
) {
  if (
    status.provider_ref !== instruction.provider_ref ||
    !['confirmed', 'rejected', 'returned'].includes(status.outcome) ||
    canonical(status.evidence) !== canonical(evidenceFor(instruction.request))
  )
    throw new PaymentError(
      422,
      'receipt_mismatch',
      'Provider evidence does not match the expected asset, amount, destination or instruction',
    );
  if (intent.provider === 'paystack-test') {
    if (
      !status.provider_data ||
      status.provider_data.domain !== 'test' ||
      !/^\d+$/.test(status.provider_data.id) ||
      !/^\d+$/.test(status.provider_data.fee_minor)
    )
      throw new PaymentError(
        422,
        'receipt_mismatch',
        'Verified provider identity and fees are required',
      );
    const previous = (
      await c.query('SELECT payload FROM receipts WHERE instruction_id=$1', [instruction.id])
    ).rows[0];
    if (previous && previous.payload.provider_data?.id !== status.provider_data.id)
      throw new PaymentError(422, 'receipt_mismatch', 'Provider transfer identity changed');
  }
  if (intent.provider === 'stellar-testnet') {
    const st = (
        await c.query('SELECT * FROM stellar_transactions WHERE instruction_id=$1', [
          instruction.id,
        ])
      ).rows[0],
      d = status.stellar_data,
      expected = instruction.request.stellar_identity;
    if (
      !st ||
      !d ||
      d.hash !== st.transaction_hash ||
      d.network !== 'testnet' ||
      d.issuer !== expected?.issuer ||
      d.code !== 'KUSD' ||
      d.source !== expected.source ||
      d.destination !== instruction.request.beneficiary ||
      d.amount_minor !== intent.destination_minor ||
      !Number.isSafeInteger(d.ledger) ||
      d.ledger <= 0 ||
      !/^\d+$/.test(d.fee_stroops)
    )
      throw new PaymentError(
        422,
        'receipt_mismatch',
        'Matched Stellar transaction evidence is required',
      );
  }
  if (status.outcome === 'returned') return settleReturn(c, intent, instruction, status);
  if (['succeeded', 'failed', 'returned'].includes(intent.state)) return intent;
  if (!['processing', 'unknown'].includes(intent.state))
    throw new PaymentError(
      409,
      'receipt_state_conflict',
      'Intent cannot consume settlement evidence in its current state',
    );
  await c.query(
    'INSERT INTO receipts(id,instruction_id,provider_ref,payload) VALUES($1,$2,$3,$4) ON CONFLICT(provider_ref) DO NOTHING',
    [id('rcpt'), instruction.id, status.provider_ref, status],
  );
  if (intent.provider === 'stellar-testnet' && BigInt(status.stellar_data!.fee_stroops) > 0n)
    await postJournal(c, {
      reference: `stellar-fee:${intent.id}`,
      description: 'Verified Testnet transaction fee paid by treasury',
      entries: [
        {
          account_id: accountId(null, 'XLM', 'provider_fees'),
          side: 'debit',
          amount: status.stellar_data!.fee_stroops,
        },
        {
          account_id: accountId(null, 'XLM', 'funding'),
          side: 'credit',
          amount: status.stellar_data!.fee_stroops,
        },
      ],
    });
  if (status.outcome === 'confirmed') {
    await captureInTransaction(c, intent.hold_id, intent.fee_minor);
    await completeCorridor(c, intent.id, 'consumed');
    // Explicit simulator liquidity journals balance the delivery asset independently.
    if (intent.provider === 'kora-sandbox' || intent.provider === 'stellar-testnet')
      await postJournal(c, {
        reference: `destination:${intent.id}`,
        description:
          intent.provider === 'stellar-testnet'
            ? 'Verified KUSD Testnet delivery from fixture treasury liquidity'
            : 'Simulated destination settlement from sandbox liquidity',
        entries: [
          {
            account_id: accountId(null, intent.destination_asset, 'clearing'),
            side: 'debit',
            amount: intent.destination_minor,
          },
          {
            account_id: accountId(null, intent.destination_asset, 'funding'),
            side: 'credit',
            amount: intent.destination_minor,
          },
        ],
      });
    if (
      intent.provider === 'paystack-test' &&
      BigInt(status.provider_data?.fee_minor ?? '0') > 0n
    ) {
      const fee = status.provider_data!.fee_minor;
      const journal = await postJournal(c, {
        reference: `provider-fee:${intent.id}`,
        description: 'Paystack test-mode provider fee funded by sandbox treasury',
        entries: [
          { account_id: accountId(null, 'NGN', 'provider_fees'), side: 'debit', amount: fee },
          { account_id: accountId(null, 'NGN', 'funding'), side: 'credit', amount: fee },
        ],
      });
      await c.query(
        'INSERT INTO rail_receipts(id,merchant_id,resource_id,provider_reference,kind,provider_id,payload,journal_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(resource_id,kind) DO NOTHING',
        [
          id('rrcpt'),
          intent.merchant_id,
          intent.id,
          status.provider_ref,
          'payout_fee',
          status.provider_data!.id,
          status.provider_data,
          journal,
        ],
      );
    }
  } else {
    await releaseInTransaction(c, intent.hold_id);
    await completeCorridor(c, intent.id, 'released');
  }
  await c.query('UPDATE instructions SET state=$2 WHERE id=$1', [instruction.id, status.outcome]);
  await c.query(
    "UPDATE attempts SET state=$2,completed_at=now() WHERE instruction_id=$1 AND state IN ('processing','unknown')",
    [instruction.id, status.outcome],
  );
  const final = await transition(
    c,
    intent,
    status.outcome === 'confirmed' ? 'succeeded' : 'failed',
    status.outcome === 'confirmed'
      ? 'Provider evidence matched; source reservation captured'
      : 'Provider rejection confirmed; reservation released',
  );
  await c.query(
    "UPDATE reconciliation_items SET state='resolved',resolved_at=now() WHERE intent_id=$1 AND state='open'",
    [intent.id],
  );
  await checkpoint?.('before_settlement_commit');
  return final;
}
async function settleReturn(
  c: Client,
  intent: Intent,
  instruction: Instruction,
  status: ProviderStatus,
) {
  if (intent.provider !== 'paystack-test')
    throw new PaymentError(422, 'receipt_mismatch', 'Returns require verified Paystack evidence');
  if (intent.state === 'returned') return intent;
  if (!['processing', 'unknown', 'succeeded'].includes(intent.state))
    throw new PaymentError(409, 'receipt_state_conflict', 'Cannot return this intent');
  let journal: string | undefined;
  if (intent.state === 'succeeded') {
    const entries = [
      {
        account_id: accountId(intent.merchant_id, 'NGN', 'available'),
        side: 'debit' as const,
        amount: intent.source_minor,
      },
      {
        account_id: accountId(null, 'NGN', 'clearing'),
        side: 'credit' as const,
        amount: (BigInt(intent.source_minor) - BigInt(intent.fee_minor)).toString(),
      },
    ];
    if (BigInt(intent.fee_minor) > 0n)
      entries.push({
        account_id: accountId(null, 'NGN', 'fees'),
        side: 'credit',
        amount: intent.fee_minor,
      });
    journal = await postJournal(c, {
      reference: `return:${intent.id}`,
      description: 'Verified Paystack return; source principal and Kora fee refunded',
      entries,
    });
  } else {
    await releaseInTransaction(c, intent.hold_id);
    journal = (
      await c.query('SELECT id FROM journals WHERE reference=$1', [`release:${intent.hold_id}`])
    ).rows[0].id;
  }
  await c.query(
    'INSERT INTO rail_receipts(id,merchant_id,resource_id,provider_reference,kind,provider_id,payload,journal_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [
      id('rrcpt'),
      intent.merchant_id,
      intent.id,
      status.provider_ref,
      'return',
      status.provider_data?.id ?? null,
      status,
      journal,
    ],
  );
  await c.query("UPDATE instructions SET state='returned' WHERE id=$1", [instruction.id]);
  await c.query(
    "UPDATE attempts SET state='returned',completed_at=now() WHERE instruction_id=$1 AND state IN ('processing','unknown','confirmed')",
    [instruction.id],
  );
  await c.query(
    "UPDATE reconciliation_items SET state='resolved',resolved_at=now() WHERE intent_id=$1 AND state='open'",
    [intent.id],
  );
  return transition(
    c,
    intent,
    'returned',
    'Provider reversal verified; source funds refunded once',
  );
}
export async function recoverPaystackIntent(intentId: string, connector: PaystackTestConnector) {
  const instruction = (
    await pool.query("SELECT * FROM instructions WHERE intent_id=$1 AND provider='paystack-test'", [
      intentId,
    ])
  ).rows[0] as Instruction | undefined;
  if (!instruction) return processIntent(intentId, { connector });
  const status = await connector.fetchStatus(instruction.id);
  if (!status) return processIntent(intentId, { connector });
  return transaction(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`intent:${intentId}`]);
    const intent = (await c.query('SELECT * FROM intents WHERE id=$1 FOR UPDATE', [intentId]))
      .rows[0] as Intent;
    return settleReceipt(c, intent, instruction, status);
  });
}
async function markUnknown(c: Client, intent: Intent, instruction: Instruction, code: string) {
  await c.query("UPDATE instructions SET state='unknown' WHERE id=$1", [instruction.id]);
  await c.query(
    "UPDATE attempts SET state='unknown',error_code=$2 WHERE instruction_id=$1 AND state='processing'",
    [instruction.id, code],
  );
  await transition(c, intent, 'unknown', 'External outcome is ambiguous; status recovery required');
  await c.query(
    "INSERT INTO reconciliation_items(id,intent_id,reason,state) VALUES($1,$2,$3,'open') ON CONFLICT(intent_id) DO UPDATE SET state='open',reason=EXCLUDED.reason,resolved_at=NULL",
    [id('recon'), intent.id, code],
  );
}
export async function processIntent(
  intentId: string,
  options: EngineOptions = {},
): Promise<'terminal' | 'pending' | 'busy'> {
  const c = await pool.connect();
  const lock = `intent:${intentId}`;
  let acquired = false;
  let dispatchLock: string | null = null;
  try {
    acquired = (
      await c.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [lock])
    ).rows[0].locked;
    if (!acquired) return 'busy';
    let intent = (await c.query('SELECT * FROM intents WHERE id=$1', [intentId])).rows[0] as
      Intent | undefined;
    if (!intent || ['succeeded', 'failed', 'canceled', 'returned'].includes(intent.state))
      return 'terminal';
    const corridorPlanned = await planned(c, intent.quote_id);
    if (
      corridorPlanned &&
      options.connector &&
      !(options.connector instanceof CorridorSandboxConnector)
    )
      throw new PaymentError(
        409,
        'provider_mismatch',
        'A frozen corridor cannot fall back to a direct provider',
      );
    const connector: Connector =
      options.connector ??
      (intent.provider === 'paystack-test'
        ? new PaystackTestConnector(PaystackClient.fromEnvironment())
        : intent.provider === 'stellar-testnet'
          ? StellarTestnetConnector.fromEnvironment()
          : corridorPlanned
            ? new CorridorSandboxConnector()
            : new FakeConnector());
    if (intent.provider !== 'kora-sandbox' && connector.id !== intent.provider)
      throw new PaymentError(409, 'provider_mismatch', 'The persisted provider cannot be replaced');
    const prepared = await transactionOn(c, async (tx) => {
      const enabled = (
        await tx.query('SELECT enabled FROM merchants WHERE id=$1', [intent!.merchant_id])
      ).rows[0]?.enabled;
      const customer = (
        await tx.query('SELECT verification_state FROM customers WHERE id=$1', [
          intent!.customer_id,
        ])
      ).rows[0];
      const instrument = (
        await tx.query('SELECT * FROM instruments WHERE id=$1', [intent!.destination_instrument_id])
      ).rows[0];
      const existing = (await tx.query('SELECT * FROM instructions WHERE intent_id=$1', [intentId]))
        .rows[0] as Instruction | undefined;
      if (
        !existing &&
        (!enabled ||
          intent!.compliance_state !== 'sandbox_allowed' ||
          customer?.verification_state !== 'sandbox_verified' ||
          !instrument?.verified)
      )
        return null;
      if (existing) return existing;
      const quoteValid = (
        await tx.query('SELECT expires_at>$2 AS valid FROM quotes WHERE id=$1', [
          intent!.quote_id,
          options.clock?.() ?? new Date(),
        ])
      ).rows[0]?.valid;
      if (!quoteValid) {
        await releaseInTransaction(tx, intent!.hold_id);
        await completeCorridor(tx, intent!.id, 'released');
        await transition(
          tx,
          intent!,
          'failed',
          'Quote expired before instruction submission; reserved funds released',
        );
        return 'expired' as const;
      }
      const bank = (
        await tx.query(
          'SELECT b.recipient_code,b.bank_code,b.provider_binding,r.account_sealed FROM bank_accounts b JOIN bank_resolutions r ON r.id=b.resolution_id WHERE b.instrument_id=$1',
          [instrument.id],
        )
      ).rows[0];
      if (
        intent!.provider === 'paystack-test' &&
        (!connector.binding || bank?.provider_binding !== connector.binding)
      )
        throw new PaymentError(
          422,
          'provider_binding_mismatch',
          'Bank recipient belongs to a different provider credential binding',
        );
      const stellar = (
        await tx.query('SELECT * FROM stellar_accounts WHERE instrument_id=$1', [instrument.id])
      ).rows[0];
      if (
        intent!.provider === 'stellar-testnet' &&
        (!stellar || stellar.binding !== connector.binding)
      )
        throw new PaymentError(422, 'provider_binding_mismatch', 'Stellar account binding changed');
      const instructionId = id('ins');
      const request: PayoutRequest = {
        instruction_id: instructionId,
        hold_id: intent!.hold_id,
        asset: intent!.source_asset,
        amount_minor: (BigInt(intent!.source_minor) - BigInt(intent!.fee_minor)).toString(),
        fee_minor: intent!.fee_minor,
        beneficiary:
          intent!.provider === 'paystack-test'
            ? bank?.recipient_code
            : intent!.provider === 'stellar-testnet'
              ? stellar.address
              : instrument.sandbox_identifier,
        scenario: intent!.scenario,
        ...(intent!.provider === 'stellar-testnet'
          ? {
              provider_binding: connector.binding,
              stellar_identity: {
                network: 'testnet' as const,
                issuer: stellar.issuer,
                code: 'KUSD' as const,
                source: (connector as StellarTestnetConnector).config.treasury,
              },
            }
          : {}),
        ...(intent!.provider === 'paystack-test'
          ? {
              provider_binding: connector.binding,
              bank_identity: {
                bank_code: bank.bank_code,
                account_hash: createHash('sha256')
                  .update(`${bank.bank_code}:${unseal(bank.account_sealed)}`)
                  .digest('hex'),
              },
            }
          : {}),
        destination: {
          asset: intent!.destination_asset,
          amount_minor: intent!.destination_minor,
          instrument_id: instrument.id,
        },
      };
      return (
        await tx.query(
          "INSERT INTO instructions(id,intent_id,provider_ref,state,request,provider) VALUES($1,$2,$3,'created',$4,$5) RETURNING *",
          [
            instructionId,
            intentId,
            intent!.provider === 'paystack-test'
              ? paystackReference(instructionId)
              : intent!.provider === 'stellar-testnet'
                ? `stellar_${instructionId}`
                : `fake_${instructionId}`,
            request,
            intent!.provider,
          ],
        )
      ).rows[0] as Instruction;
    });
    if (!prepared) return 'pending';
    if (prepared === 'expired') return 'terminal';
    const instruction = prepared;
    await options.checkpoint?.('instruction_committed');
    let status: ProviderStatus | null;
    try {
      status =
        connector instanceof StellarTestnetConnector
          ? await connector.fetchStatus(instruction.id, c)
          : await connector.fetchStatus(instruction.id);
    } catch {
      await transactionOn(c, (tx) => markUnknown(tx, intent!, instruction, 'status_unavailable'));
      return 'pending';
    }
    if (!status) {
      if (instruction.state !== 'created' && !connector.idempotentInstructions) {
        await transactionOn(c, (tx) => markUnknown(tx, intent!, instruction, 'no_safe_resend'));
        return 'pending';
      }
      dispatchLock = `dispatch:${intent!.merchant_id}`;
      await c.query('SELECT pg_advisory_lock_shared(hashtextextended($1,0))', [dispatchLock]);
      // Recheck controls just before sending. Existing submissions still query status while held.
      const controls = (
        await c.query(
          "SELECT m.enabled AND NOT EXISTS(SELECT 1 FROM merchant_controls mc WHERE mc.merchant_id=m.id AND mc.state='paused') AND cu.verification_state='sandbox_verified' AND ins.verified AND i.compliance_state='sandbox_allowed' AS allowed,q.expires_at>$2 AS quote_valid FROM intents i JOIN merchants m ON m.id=i.merchant_id JOIN customers cu ON cu.id=i.customer_id JOIN instruments ins ON ins.id=i.destination_instrument_id JOIN quotes q ON q.id=i.quote_id WHERE i.id=$1",
          [intentId, options.clock?.() ?? new Date()],
        )
      ).rows[0];
      if (!controls?.quote_valid) {
        if (instruction.state === 'created') {
          await transactionOn(c, async (tx) => {
            await releaseInTransaction(tx, intent!.hold_id);
            await completeCorridor(tx, intent!.id, 'released');
            await tx.query("UPDATE instructions SET state='rejected' WHERE id=$1", [
              instruction.id,
            ]);
            await transition(
              tx,
              intent!,
              'failed',
              'Quote expired before submission; reserved funds released',
            );
          });
          return 'terminal';
        }
        await transactionOn(c, (tx) =>
          markUnknown(tx, intent!, instruction, 'quote_expired_after_submission'),
        );
        return 'pending';
      }
      if (
        !controls.allowed ||
        !(await dispatchAllowed(c, intent!.merchant_id, intent!.customer_id))
      )
        return 'pending';
      await transactionOn(c, async (tx) => {
        await tx.query(
          "UPDATE instructions SET state='submitting',started_at=COALESCE(started_at,now()) WHERE id=$1",
          [instruction.id],
        );
        await tx.query("INSERT INTO attempts(id,instruction_id,state) VALUES($1,$2,'processing')", [
          id('att'),
          instruction.id,
        ]);
      });
      await options.checkpoint?.('before_provider_call');
      try {
        status =
          connector instanceof StellarTestnetConnector
            ? await connector.payout(instruction.request, c)
            : await connector.payout(instruction.request);
      } catch (error) {
        const code = error instanceof ProviderError ? error.code : 'unknown';
        await transactionOn(c, (tx) => markUnknown(tx, intent!, instruction, code));
        return 'pending';
      }
      await options.checkpoint?.('provider_accepted');
    }
    try {
      await transactionOn(c, async (tx) => {
        intent = (await tx.query('SELECT * FROM intents WHERE id=$1 FOR UPDATE', [intentId]))
          .rows[0] as Intent;
        await settleReceipt(tx, intent!, instruction, status!, options.checkpoint);
      });
    } catch (error) {
      if (!(error instanceof PaymentError) || error.code !== 'receipt_mismatch') throw error;
      await transactionOn(c, (tx) => markUnknown(tx, intent!, instruction, 'receipt_mismatch'));
      return 'pending';
    }
    await options.checkpoint?.('settlement_committed');
    return 'terminal';
  } finally {
    if (dispatchLock)
      await c.query('SELECT pg_advisory_unlock_shared(hashtextextended($1,0))', [dispatchLock]);
    try {
      if (acquired) await c.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [lock]);
    } finally {
      c.release();
    }
  }
}
export async function consumeCallback(status: ProviderStatus) {
  if (!status.evidence?.instruction_id)
    throw new PaymentError(422, 'receipt_mismatch', 'Callback is missing an instruction');
  const instruction = (
    await pool.query('SELECT * FROM instructions WHERE id=$1', [status.evidence.instruction_id])
  ).rows[0] as Instruction | undefined;
  if (!instruction) throw new PaymentError(404, 'instruction_not_found', 'Instruction not found');
  const owner = (
    await pool.query('SELECT quote_id FROM intents WHERE id=$1', [instruction.intent_id])
  ).rows[0];
  const isCorridor =
    (await pool.query('SELECT 1 FROM network_plans WHERE quote_id=$1', [owner.quote_id]))
      .rowCount !== 0;
  const authoritative = await (
    isCorridor ? new CorridorSandboxConnector() : new FakeConnector()
  ).fetchStatus(instruction.id);
  if (canonical(authoritative) !== canonical(status))
    throw new PaymentError(
      422,
      'receipt_mismatch',
      'Callback does not match durable provider evidence',
    );
  return transaction(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `intent:${instruction.intent_id}`,
    ]);
    const intent = (
      await c.query('SELECT * FROM intents WHERE id=$1 FOR UPDATE', [instruction.intent_id])
    ).rows[0] as Intent;
    const result = await settleReceipt(c, intent, instruction, status);
    await c.query(
      'UPDATE outbox SET processed_at=now(),locked_by=NULL,locked_until=NULL WHERE intent_id=$1',
      [intent.id],
    );
    return publicIntent(result);
  });
}
export const webhookSecret = () => `whsec_${randomBytes(32).toString('hex')}`;
