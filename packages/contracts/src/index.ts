import { z } from 'zod';
export const assetSchema = z.enum(['NGN', 'KES', 'GHS', 'USDC', 'KUSD', 'XLM']);
export const amount = z.string().regex(/^[1-9]\d{0,23}$/);
export const typedId = z.string().regex(/^[a-z]+_[a-f0-9]{32}$/);
export const empty = z.object({}).strict();
const simulatorAsset = z.enum(['NGN', 'KES', 'GHS', 'USDC']);
export const quoteSchema = z
  .object({ source_asset: simulatorAsset, destination_asset: simulatorAsset, amount_minor: amount })
  .strict();
export const customerSchema = z.object({ name: z.string().trim().min(1).max(120) }).strict();
export const instrumentSchema = z
  .object({
    type: z.enum(['bank_account', 'mobile_money', 'stellar_account']),
    asset: simulatorAsset,
    label: z.string().trim().min(1).max(120),
    sandbox_identifier: z.string().regex(/^sandbox:[A-Za-z0-9._:-]{1,100}$/),
  })
  .strict();
export const intentSchema = z
  .object({
    quote_id: typedId,
    customer_id: typedId,
    destination_instrument_id: typedId,
    type: z.enum(['transfer', 'asset_purchase', 'asset_redemption']).default('transfer'),
    reference: z.string().trim().min(1).max(128),
    scenario: z.enum(['success', 'timeout', 'insufficient_float']).default('success'),
  })
  .strict();
export const webhookSchema = z.object({ url: z.string().max(2000) }).strict();
export const keySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z
      .array(
        z.enum([
          'payments:read',
          'payments:write',
          'customers:read',
          'customers:write',
          'webhooks:read',
          'webhooks:write',
          'keys:read',
          'keys:write',
          'operations:read',
          'operations:write',
        ]),
      )
      .min(1)
      .max(10),
  })
  .strict();
export const bankResolutionSchema = z
  .object({
    account_number: z.string().regex(/^\d{10}$/),
    bank_code: z.string().regex(/^\d{3,6}$/),
  })
  .strict();
export const bankAccountSchema = z
  .object({ resolution_id: typedId, label: z.string().trim().min(1).max(120) })
  .strict();
export const localPayoutSchema = z
  .object({
    customer_id: typedId,
    destination_instrument_id: typedId,
    amount_minor: amount,
    reference: z.string().trim().min(1).max(128),
  })
  .strict();
export const collectionSchema = z
  .object({ customer_id: typedId, amount_minor: amount, email: z.string().email().max(254) })
  .strict();
export const complianceSchema = z
  .object({ decision: z.enum(['allow', 'hold']), reason: z.string().trim().min(1).max(240) })
  .strict();
export const stellarAccountSchema = z
  .object({
    address: z.string().regex(/^G[A-Z2-7]{55}$/),
    signature: z.string().regex(/^[a-f0-9]{128}$/),
    label: z.string().trim().min(1).max(120),
  })
  .strict();
export const stellarPurchaseSchema = localPayoutSchema;
export const stellarDepositSchema = z
  .object({
    customer_id: typedId,
    instrument_id: typedId,
    transaction_hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const stellarRedeemSchema = z.object({ amount_minor: amount }).strict();
export const pilotPolicySchema = z
  .object({
    caps: z
      .array(
        z
          .object({
            asset: z.enum(['NGN', 'KES', 'GHS', 'USDC', 'KUSD']),
            per_transaction_minor: amount,
            per_day_minor: amount,
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict()
  .refine(
    (p) =>
      new Set(p.caps.map((c) => c.asset)).size === p.caps.length &&
      p.caps.every((c) => BigInt(c.per_day_minor) >= BigInt(c.per_transaction_minor)),
    'Caps must have distinct assets and daily limits at least as large as transaction limits',
  );
export const controlEvidenceSchema = z
  .object({
    customer_id: typedId.optional(),
    kind: z.enum(['kyb', 'kyc', 'screening', 'custody', 'security', 'legal', 'partner']),
    outcome: z.enum(['checked', 'review', 'rejected']),
    reference: z.string().trim().min(1).max(240),
    reason: z.string().trim().min(1).max(240),
    expires_at: z.iso.datetime(),
  })
  .strict();
export const controlRequestSchema = z
  .object({
    action: z.enum(['start_staging', 'resume', 'change_caps']),
    policy: pilotPolicySchema,
    reason: z.string().trim().min(1).max(240),
  })
  .strict();
export const controlReviewSchema = z
  .object({ decision: z.enum(['approve', 'reject']), reason: z.string().trim().min(1).max(240) })
  .strict();
export const controlPauseSchema = z.object({ reason: z.string().trim().min(1).max(240) }).strict();
export const controlDaySchema = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
const minor = z.string().regex(/^-?\d+$/),
  date = z.string(),
  mode = z.literal('sandbox');
const value = z.object({ asset: assetSchema, amount_minor: minor });
const leg = z.object({ name: z.string(), rail: z.string(), asset: z.string() });
const customer = z
  .object({
    id: z.string(),
    name: z.string(),
    verification_state: z.enum(['sandbox_verified', 'held']),
    created_at: date,
  })
  .passthrough();
const instrument = z
  .object({
    id: z.string(),
    customer_id: z.string(),
    type: z.enum(['bank_account', 'mobile_money', 'stellar_account']),
    asset: simulatorAsset,
    label: z.string(),
    sandbox_identifier: z.string(),
    verified: z.boolean(),
    created_at: date,
  })
  .passthrough();
const intent = z.object({
  id: z.string(),
  object: z.literal('intent'),
  provider: z.enum(['kora-sandbox', 'paystack-test', 'stellar-testnet']),
  type: z.enum(['transfer', 'asset_purchase', 'asset_redemption']),
  state: z.enum(['processing', 'unknown', 'succeeded', 'failed', 'canceled', 'returned']),
  compliance_state: z.enum(['sandbox_allowed', 'held']),
  quote_id: z.string(),
  source: value,
  destination: value.extend({ instrument_id: z.string() }),
  fee: value,
  customer_id: z.string(),
  reference: z.string(),
  route: z.array(leg),
  created_at: date,
  updated_at: date,
  mode,
  history: z
    .array(z.object({ state: z.string(), detail: z.string(), created_at: date }))
    .optional(),
});
const quote = z.object({
  id: z.string(),
  object: z.literal('quote'),
  provider: z.enum(['kora-sandbox', 'paystack-test', 'stellar-testnet']),
  source: value,
  destination: value,
  fee: value,
  route: z.array(leg),
  expires_at: date,
  created_at: date,
  mode,
});
const collection = z.object({
  id: z.string(),
  object: z.literal('collection'),
  customer_id: z.string(),
  amount_minor: minor,
  asset: z.literal('NGN'),
  provider: z.literal('paystack-test'),
  provider_reference: z.string(),
  state: z.enum(['processing', 'pending', 'unknown', 'succeeded', 'failed', 'held']),
  fee_minor: minor.nullable(),
  credited_minor: minor.nullable(),
  checkout_url: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: date,
  updated_at: date,
  mode,
});
const bankAccount = z.object({
  instrument_id: z.string(),
  customer_id: z.string(),
  recipient_code: z.string(),
  bank_code: z.string(),
  account_last4: z.string(),
  account_name: z.string(),
  created_at: date,
});
const statement = z.object({
  id: z.string(),
  state: z.enum(['running', 'matched', 'review', 'failed']),
  matched: z.number(),
  unmatched: z.number(),
  scope: z.literal('provider_ledger_snapshot'),
  created_at: date,
  completed_at: date.nullable(),
});
const stellarDeposit = z.object({
  id: z.string(),
  customer_id: z.string(),
  instrument_id: z.string(),
  transaction_hash: z.string(),
  amount_minor: minor,
  journal_id: z.string(),
  evidence: z.record(z.string(), z.unknown()),
  created_at: date,
});
const stellarRedemption = z.object({
  id: z.string(),
  hold_id: z.string(),
  source_minor: minor,
  destination_minor: minor,
  journal_id: z.string(),
  rate_basis: z.literal('fixture_1600_ngn_per_kusd'),
  created_at: date,
});
const event = z
  .object({
    id: z.string(),
    type: z.string(),
    intent_id: z.string().nullable(),
    data: z.union([intent, collection, stellarDeposit, stellarRedemption]),
    created_at: date,
  })
  .passthrough();
const endpoint = z.object({
  id: z.string(),
  url: z.string(),
  active: z.boolean(),
  created_at: date.optional(),
  secret: z.string().optional(),
});
const delivery = z.object({
  id: z.string(),
  endpoint_id: z.string(),
  event_id: z.string(),
  state: z.enum(['pending', 'delivered', 'failed']),
  attempts: z.number(),
  status_code: z.number().nullable(),
  last_error: z.string().nullable(),
  next_attempt_at: date,
});
const apiKey = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  created_at: date,
  revoked_at: date.nullable(),
});
const paged = (s: z.ZodType) =>
  z.object({ data: z.array(s), has_more: z.boolean(), next_cursor: z.string().nullable() });
const stellarAccount = z.object({
  instrument_id: z.string(),
  customer_id: z.string(),
  address: z.string(),
  issuer: z.string(),
  network: z.literal('testnet'),
  asset_code: z.literal('KUSD'),
  created_at: date,
});
const policyResponse = z.object({
  caps: z.array(
    z.object({ asset: assetSchema, per_transaction_minor: minor, per_day_minor: minor }),
  ),
});
const evidenceResponse = z.object({
  id: z.string(),
  customer_id: z.string().nullable(),
  kind: z.string(),
  outcome: z.string(),
  mode: z.literal('staging'),
  reference: z.string(),
  reason: z.string(),
  operator_id: z.string(),
  expires_at: date,
  created_at: date,
});
const approvalResponse = z.object({
  id: z.string(),
  action: z.string(),
  policy: policyResponse,
  base_revision: z.number(),
  reason: z.string(),
  requested_by: z.string(),
  state: z.enum(['pending', 'approved', 'rejected']),
  reviewed_by: z.string().nullable(),
  review_reason: z.string().nullable(),
  expires_at: date,
  created_at: date,
  reviewed_at: date.nullable(),
});
const reportResponse = z.object({
  id: z.string(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  control_clean: z.boolean(),
  scope: z.literal('ledger_and_receipt_controls'),
  provider_cash_complete: z.literal(false),
  data: z.record(z.string(), z.unknown()),
  created_at: date,
});
const auditResponse = z.object({
  id: z.string(),
  actor_key_id: z.string(),
  operator_id: z.string().nullable(),
  action: z.string(),
  resource_id: z.string(),
  data: z.record(z.string(), z.unknown()),
  created_at: date,
});
const networkPlanLeg = z.object({
  position: z.number(),
  name: z.string(),
  participant_id: z.string(),
  provider_binding: z.string(),
  asset: assetSchema,
  amount_minor: minor,
  rail: z.string(),
});
const networkHealth = z.object({
  participant_id: z.string(),
  provider_binding: z.string(),
  status: z.enum(['healthy', 'degraded', 'unavailable', 'unknown']),
  source: z.enum(['simulator_registry', 'receipt_measurement', 'operator_simulation']),
  samples: z.number().int(),
  confirmed: z.number().int(),
  rejected: z.number().int(),
  failure_rate_ppm: z.number().int(),
  latency_ms: z.number().int().nullable(),
  observed_at: date,
  expires_at: date,
});
const networkRouting = z.object({
  mode,
  strategy: z.literal('healthy_then_acceptance_then_latency_then_priority'),
  amount_minor: minor,
  evaluated_at: date,
  window_seconds: z.number().int(),
  selected_corridor_id: z.string().nullable(),
  candidates: z.array(
    z.object({
      corridor_id: z.string(),
      destination_participant_id: z.string(),
      priority: z.number().int(),
      eligible: z.boolean(),
      reason: z.string().nullable(),
      capacity_minor: minor,
      available_minor: minor,
      health: z.array(networkHealth),
    }),
  ),
});
const networkSnapshot = z.object({
  mode,
  settlement_mode: z.literal('simulated'),
  source_minor: minor,
  destination_minor: minor,
  fee_minor: minor,
  legs: z.array(networkPlanLeg),
  routing: networkRouting.optional(),
});
export const models = {
  NetworkRouting: networkRouting,
  NetworkHealthObservation: z.object({
    id: z.string(),
    merchant_id: z.string(),
    participant_id: z.string(),
    provider_binding: z.string(),
    status: z.enum(['healthy', 'degraded', 'unavailable']),
    reason: z.string(),
    actor_key_id: z.string(),
    observed_at: date,
    expires_at: date,
    mode,
    source: z.literal('operator_simulation'),
  }),
  NetworkRegistry: z.object({
    mode,
    external_validated: z.literal(false),
    participants: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        country: z.string(),
        role: z.string(),
        asset: assetSchema,
        provider_binding: z.string(),
        enabled: z.boolean(),
        mode,
        external_validated: z.literal(false),
      }),
    ),
    corridors: z.array(
      z.object({
        id: z.string(),
        source_asset: assetSchema,
        destination_asset: assetSchema,
        origin_id: z.string(),
        settlement_id: z.string(),
        destination_id: z.string(),
        enabled: z.boolean(),
        capacity_minor: minor,
        allocated_minor: minor,
        available_minor: minor,
        mode,
      }),
    ),
  }),
  NetworkQuote: z.object({
    id: z.string(),
    plan_id: z.string(),
    source: value,
    destination: value,
    fee: value,
    route: z.array(networkPlanLeg),
    expires_at: date,
    mode,
    settlement_mode: z.literal('simulated'),
    routing: networkRouting.nullable(),
  }),
  NetworkPlanList: z.object({
    data: z.array(
      z.object({ id: z.string(), quote_id: z.string(), corridor_id: z.string(), created_at: date }),
    ),
  }),
  NetworkPlan: z.object({
    id: z.string(),
    quote_id: z.string(),
    intent_id: z.string().nullable(),
    corridor_id: z.string(),
    capacity_state: z.string().nullable(),
    scenario: z.string(),
    snapshot: networkSnapshot,
    legs: z.array(
      z.object({
        id: z.string(),
        position: z.number(),
        participant_id: z.string(),
        provider_binding: z.string(),
        request: networkPlanLeg,
        state: z.string(),
        provider_reference: z.string().nullable(),
        outcome: z.string().nullable(),
        payload: z.unknown().nullable(),
        journal_id: z.string().nullable(),
        receipt_at: date.nullable(),
      }),
    ),
    mode,
    external_validated: z.literal(false),
    created_at: date,
  }),
  ControlStatus: z.object({
    state: z.enum(['sandbox', 'staging_active', 'paused']),
    revision: z.number(),
    policy: policyResponse,
    mode: z.literal('staging'),
    live_ready: z.literal(false),
    operator_enrollment: z.literal('platform_managed'),
    operator_id: z.string().nullable(),
    gates: z.array(
      z.object({ kind: z.string(), status: z.string(), evidence_id: z.string().nullable() }),
    ),
    daily_report_id: z.string().nullable(),
    daily_controls_clean: z.boolean(),
    provider_cash_complete: z.literal(false),
    staging_ready: z.boolean(),
  }),
  ControlEvidence: evidenceResponse,
  ControlEvidenceList: z.object({ data: z.array(evidenceResponse) }),
  ControlApproval: approvalResponse,
  ControlApprovalList: z.object({ data: z.array(approvalResponse) }),
  ControlReport: reportResponse,
  ControlReportList: z.object({ data: z.array(reportResponse) }),
  ControlAuditList: z.object({ data: z.array(auditResponse) }),
  ControlPause: z.object({ state: z.literal('paused'), revision: z.number() }),
  StellarStatus: z.object({
    provider: z.literal('stellar-testnet'),
    network: z.literal('testnet'),
    configured: z.boolean(),
    asset_code: z.literal('KUSD'),
    asset_name: z.string(),
    issuer: z.string().nullable(),
    treasury: z.string().nullable(),
    fx_basis: z.literal('fixture_1600_ngn_per_kusd'),
    partner_fx_configured: z.literal(false),
  }),
  StellarChallenge: z.object({ challenge_hex: z.string(), address: z.string() }),
  StellarAccount: stellarAccount,
  StellarAccountList: z.object({ data: z.array(stellarAccount) }),
  StellarDeposit: stellarDeposit,
  StellarDepositList: z.object({ data: z.array(stellarDeposit) }),
  StellarRedemption: stellarRedemption,
  StellarRedemptionList: z.object({ data: z.array(stellarRedemption) }),
  Error: z.object({
    error: z.object({
      type: z.string(),
      code: z.string(),
      message: z.string(),
      request_id: z.string(),
    }),
  }),
  Collection: collection,
  CollectionList: paged(collection),
  BankResolution: z.object({
    id: z.string(),
    bank_code: z.string(),
    account_last4: z.string(),
    account_name: z.string(),
    expires_at: date,
    created_at: date,
  }),
  BankAccount: bankAccount,
  BankAccountList: z.object({ data: z.array(bankAccount) }),
  BankList: z.object({
    data: z.array(
      z.object({ name: z.string(), code: z.string(), active: z.boolean(), currency: z.string() }),
    ),
  }),
  RailStatus: z.object({
    provider: z.literal('paystack-test'),
    mode: z.literal('test'),
    configured: z.boolean(),
    capabilities: z.array(z.string()),
    asset: z.literal('NGN'),
  }),
  CollectionRecovery: z.object({ collection_id: z.string(), queued: z.boolean() }),
  ComplianceDecision: z.object({
    id: z.string(),
    customer_id: z.string(),
    decision: z.enum(['allow', 'hold']),
    reason: z.string(),
    created_at: date,
  }),
  ComplianceList: z.object({
    data: z.array(
      z.object({
        id: z.string(),
        customer_id: z.string(),
        decision: z.enum(['allow', 'hold']),
        reason: z.string(),
        created_at: date,
      }),
    ),
  }),
  Statement: statement,
  StatementList: paged(statement),
  StatementDetail: statement.extend({
    items: z.array(
      z.object({
        id: z.string(),
        provider_row_id: z.string(),
        resource_id: z.string(),
        difference_minor: minor,
        expected_minor: minor.nullable(),
        state: z.enum(['matched', 'mismatch']),
        evidence: z.record(z.string(), z.unknown()),
      }),
    ),
    redacted_unmapped: z.number(),
  }),
  Customer: customer,
  Instrument: instrument,
  Intent: intent,
  Quote: quote,
  Event: event,
  WebhookEndpoint: endpoint,
  WebhookDelivery: delivery,
  ApiKey: apiKey,
  CustomerList: paged(customer),
  InstrumentList: paged(instrument),
  IntentList: paged(intent),
  EventList: paged(event),
  EndpointList: paged(endpoint),
  KeyList: paged(apiKey),
  BalanceList: z.object({
    data: z.array(z.object({ asset: assetSchema, purpose: z.string(), minor })),
    mode,
  }),
  AssetList: z.object({
    data: z.array(
      z.object({
        id: assetSchema,
        code: z.string(),
        name: z.string(),
        scale: z.number(),
        country: z.string(),
        flag: z.string(),
        kind: z.enum(['fiat', 'stellar']),
        rail: z.string(),
        network: z.string().optional(),
        issuer: z.string().optional(),
        usdNumerator: z.string(),
        usdDenominator: z.string(),
      }),
    ),
    mode,
  }),
  Merchant: z.object({
    id: z.string(),
    name: z.string(),
    mode,
    enabled: z.boolean(),
    max_source_minor: minor,
  }),
  DeliveryList: z.object({ data: z.array(delivery) }),
  Replay: z.object({ event_id: z.string(), queued: z.number() }),
  KeyCreated: apiKey.extend({ secret: z.string() }),
  Overview: z.object({
    volume_minor_usd: minor,
    available_minor_usd: minor,
    reserved_minor_usd: minor,
    completed: z.number(),
    total: z.number(),
    open_reconciliation: z.number(),
    chart: z.array(z.object({ date: z.string(), minor_usd: minor })),
    days: z.number(),
  }),
  RequestLogList: z.object({
    data: z.array(
      z.object({
        request_id: z.string(),
        method: z.string(),
        path: z.string(),
        status_code: z.number(),
        duration_ms: z.number(),
        created_at: date,
      }),
    ),
  }),
  ReconciliationList: z.object({
    data: z.array(
      z.object({
        id: z.string(),
        intent_id: z.string(),
        reason: z.string(),
        state: z.enum(['open', 'resolved']),
        created_at: date,
        resolved_at: date.nullable(),
        reference: z.string(),
      }),
    ),
  }),
  OperationDetail: z.object({
    intent,
    hold: z.object({
      id: z.string(),
      state: z.string(),
      amount: minor,
      asset: assetSchema,
      reference: z.string(),
    }),
    instructions: z.array(
      z.object({ id: z.string(), provider_ref: z.string(), state: z.string(), created_at: date }),
    ),
    attempts: z.array(
      z.object({
        id: z.string(),
        instruction_id: z.string(),
        state: z.string(),
        error_code: z.string().nullable(),
        started_at: date,
        completed_at: date.nullable(),
      }),
    ),
    receipts: z.array(
      z.object({
        id: z.string(),
        instruction_id: z.string(),
        provider_ref: z.string(),
        payload: z.record(z.string(), z.unknown()),
        created_at: date,
      }),
    ),
    stellar_transactions: z.array(
      z.object({
        instruction_id: z.string(),
        transaction_hash: z.string(),
        sequence: minor,
        source_address: z.string(),
        expires_at: minor,
      }),
    ),
    rail_receipts: z.array(
      z.object({
        id: z.string(),
        kind: z.string(),
        provider_reference: z.string(),
        provider_id: z.string().nullable(),
        payload: z.record(z.string(), z.unknown()),
        journal_id: z.string().nullable(),
        created_at: date,
      }),
    ),
    journals: z.array(
      z.object({
        id: z.string(),
        reference: z.string(),
        description: z.string(),
        created_at: date,
        entries: z.array(
          z.object({
            account_id: z.string(),
            asset: assetSchema,
            side: z.enum(['debit', 'credit']),
            amount: minor,
          }),
        ),
      }),
    ),
  }),
  Recovery: z.object({ intent_id: z.string(), queued: z.boolean() }),
  DisabledEndpoint: endpoint.pick({ id: true, url: true, active: true }),
};
interface Contract {
  operationId: string;
  summary: string;
  tag: string;
  model: keyof typeof models;
  body?: z.ZodType;
  query?: z.ZodType;
  status?: number;
  list?: boolean;
  scope?: string;
}
export const networkRoutingQuery = z.object({ amount_minor: amount }).strict();
export const networkHealthSchema = z
  .object({
    participant_id: z.string().min(1).max(80),
    status: z.enum(['healthy', 'degraded', 'unavailable']),
    reason: z.string().trim().min(1).max(240),
    valid_for_seconds: z.number().int().min(10).max(300).default(300),
  })
  .strict();
export const networkQuoteSchema = z
  .object({
    corridor_id: z.string().min(1).max(80),
    amount_minor: amount,
    scenario: z.enum(['success', 'timeout', 'insufficient_float']).default('success'),
  })
  .strict();
export const networkIntentSchema = z
  .object({
    plan_id: typedId,
    customer_id: typedId,
    destination_instrument_id: typedId,
    reference: z.string().min(1).max(160),
  })
  .strict();

export const contracts: Record<string, Contract> = {
  'GET /v1/network/routing': {
    operationId: 'getNetworkRouting',
    summary: 'Compare Nigerian sandbox routes using current health and capacity',
    tag: 'Network',
    model: 'NetworkRouting',
    query: networkRoutingQuery,
  },
  'POST /v1/network/health': {
    operationId: 'recordNetworkHealth',
    summary: 'Record a merchant-scoped sandbox provider-health scenario',
    tag: 'Network',
    model: 'NetworkHealthObservation',
    body: networkHealthSchema,
    status: 201,
    scope: 'operations:write',
  },
  'GET /v1/network': {
    operationId: 'getNetwork',
    summary: 'Read sandbox participants and corridor capacity',
    tag: 'Network',
    model: 'NetworkRegistry',
  },
  'GET /v1/network/plans': {
    operationId: 'listNetworkPlans',
    summary: 'Read owned frozen route plans',
    tag: 'Network',
    model: 'NetworkPlanList',
  },
  'GET /v1/network/plans/:id': {
    operationId: 'getNetworkPlan',
    summary: 'Inspect per-leg evidence and journals',
    tag: 'Network',
    model: 'NetworkPlan',
  },
  'POST /v1/network/quotes': {
    operationId: 'createNetworkQuote',
    summary: 'Freeze a Nigerian sandbox route quote',
    tag: 'Network',
    model: 'NetworkQuote',
    body: networkQuoteSchema,
    status: 201,
  },
  'POST /v1/network/intents': {
    operationId: 'createNetworkIntent',
    summary: 'Reserve and execute a frozen multi-leg route',
    tag: 'Network',
    model: 'Intent',
    body: networkIntentSchema,
    status: 201,
  },
  'GET /v1/controls': {
    operationId: 'getControls',
    summary: 'Read staging and production readiness gates',
    tag: 'Controls',
    model: 'ControlStatus',
  },
  'GET /v1/controls/evidence': {
    operationId: 'listControlEvidence',
    summary: 'Read immutable staging review evidence',
    tag: 'Controls',
    model: 'ControlEvidenceList',
  },
  'POST /v1/controls/evidence': {
    operationId: 'createControlEvidence',
    summary: 'Record an enrolled operator staging review',
    tag: 'Controls',
    model: 'ControlEvidence',
    body: controlEvidenceSchema,
    status: 201,
  },
  'GET /v1/controls/approvals': {
    operationId: 'listControlApprovals',
    summary: 'Read policy approval requests',
    tag: 'Controls',
    model: 'ControlApprovalList',
  },
  'POST /v1/controls/approvals': {
    operationId: 'createControlApproval',
    summary: 'Request a capped staging policy change',
    tag: 'Controls',
    model: 'ControlApproval',
    body: controlRequestSchema,
    status: 201,
  },
  'POST /v1/controls/approvals/:id/review': {
    operationId: 'reviewControlApproval',
    summary: 'Review a request as another enrolled operator',
    tag: 'Controls',
    model: 'ControlApproval',
    body: controlReviewSchema,
  },
  'POST /v1/controls/pause': {
    operationId: 'pausePayments',
    summary: 'Pause new money movement and retain evidence recovery',
    tag: 'Controls',
    model: 'ControlPause',
    body: controlPauseSchema,
  },
  'GET /v1/controls/reports': {
    operationId: 'listDailyReports',
    summary: 'Read daily ledger and receipt control snapshots',
    tag: 'Controls',
    model: 'ControlReportList',
  },
  'POST /v1/controls/reports': {
    operationId: 'createDailyReport',
    summary: 'Run daily controls without claiming cash reconciliation',
    tag: 'Controls',
    model: 'ControlReport',
    body: controlDaySchema,
    status: 201,
  },
  'GET /v1/controls/audit': {
    operationId: 'listControlAudit',
    summary: 'Read immutable operator audit events',
    tag: 'Controls',
    model: 'ControlAuditList',
  },
  'GET /v1/stellar': {
    operationId: 'getStellarStatus',
    summary: 'Read exact Testnet asset and treasury configuration',
    tag: 'Stellar',
    model: 'StellarStatus',
  },
  'GET /v1/customers/:id/stellar_challenge': {
    operationId: 'getStellarChallenge',
    query: z.object({ address: z.string().regex(/^G[A-Z2-7]{55}$/) }).strict(),
    summary: 'Get wallet ownership challenge',
    tag: 'Stellar',
    model: 'StellarChallenge',
  },
  'POST /v1/customers/:id/stellar_accounts': {
    operationId: 'createStellarAccount',
    summary: 'Verify wallet ownership and exact issuer trustline',
    tag: 'Stellar',
    model: 'StellarAccount',
    body: stellarAccountSchema,
    status: 201,
  },
  'GET /v1/customers/:id/stellar_accounts': {
    operationId: 'listStellarAccounts',
    summary: 'List owned Testnet wallets',
    tag: 'Stellar',
    model: 'StellarAccountList',
  },
  'POST /v1/stellar/purchases': {
    operationId: 'createStellarPurchase',
    summary: 'Reserve NGN and queue KUSD Testnet delivery at fixture FX',
    tag: 'Stellar',
    model: 'Intent',
    body: stellarPurchaseSchema,
    status: 201,
  },
  'POST /v1/stellar/deposits': {
    operationId: 'verifyStellarDeposit',
    summary: 'Credit a verified Testnet deposit exactly once',
    tag: 'Stellar',
    model: 'StellarDeposit',
    body: stellarDepositSchema,
    status: 201,
  },
  'GET /v1/stellar/deposits': {
    operationId: 'listStellarDeposits',
    summary: 'List owned verified Testnet deposits',
    tag: 'Stellar',
    model: 'StellarDepositList',
  },
  'POST /v1/stellar/redemptions': {
    operationId: 'redeemStellarBalance',
    summary: 'Convert credited KUSD into fixture NGN liquidity',
    tag: 'Stellar',
    model: 'StellarRedemption',
    body: stellarRedeemSchema,
    status: 201,
  },
  'GET /v1/stellar/redemptions': {
    operationId: 'listStellarRedemptions',
    summary: 'List fixture liquidity redemptions',
    tag: 'Stellar',
    model: 'StellarRedemptionList',
  },
  'GET /v1/rails': {
    operationId: 'getRailStatus',
    summary: 'Read local provider configuration',
    tag: 'Local rail',
    model: 'RailStatus',
  },
  'GET /v1/banks': {
    operationId: 'listBanks',
    summary: 'List supported NGN banks',
    tag: 'Local rail',
    model: 'BankList',
  },
  'POST /v1/bank_resolutions': {
    operationId: 'resolveBank',
    summary: 'Resolve a bank account name',
    tag: 'Local rail',
    model: 'BankResolution',
    body: bankResolutionSchema,
    status: 201,
  },
  'POST /v1/customers/:id/bank_accounts': {
    operationId: 'createBankAccount',
    summary: 'Register a name-enquired Paystack recipient',
    tag: 'Local rail',
    model: 'BankAccount',
    body: bankAccountSchema,
    status: 201,
  },
  'GET /v1/customers/:id/bank_accounts': {
    operationId: 'listBankAccounts',
    summary: 'List verified domestic bank accounts',
    tag: 'Local rail',
    model: 'BankAccountList',
  },
  'POST /v1/local_payouts': {
    operationId: 'createLocalPayout',
    summary: 'Reserve NGN and queue a domestic bank payout',
    tag: 'Local rail',
    model: 'Intent',
    body: localPayoutSchema,
    status: 201,
  },
  'POST /v1/local_payouts/:id/verify': {
    operationId: 'verifyLocalPayout',
    summary: 'Queue verified payout status including late returns',
    tag: 'Operations',
    model: 'Recovery',
    body: empty,
    status: 202,
  },
  'POST /v1/collections': {
    operationId: 'createCollection',
    summary: 'Queue a test collection checkout',
    tag: 'Local rail',
    model: 'Collection',
    body: collectionSchema,
    status: 201,
  },
  'GET /v1/collections': {
    operationId: 'listCollections',
    summary: 'List owned collections',
    tag: 'Local rail',
    model: 'CollectionList',
    list: true,
  },
  'GET /v1/collections/:id': {
    operationId: 'getCollection',
    summary: 'Read collection status and checkout',
    tag: 'Local rail',
    model: 'Collection',
  },
  'POST /v1/collections/:id/verify': {
    operationId: 'verifyCollection',
    summary: 'Queue authoritative collection verification',
    tag: 'Local rail',
    model: 'CollectionRecovery',
    body: empty,
    status: 202,
  },
  'POST /v1/collections/:id/release': {
    operationId: 'releaseCollection',
    summary: 'Release a verified compliance-held collection',
    tag: 'Operations',
    model: 'Collection',
    body: empty,
  },
  'POST /v1/customers/:id/compliance_decisions': {
    operationId: 'setComplianceDecision',
    summary: 'Record a sandbox compliance decision',
    tag: 'Operations',
    model: 'ComplianceDecision',
    body: complianceSchema,
    status: 201,
  },
  'GET /v1/customers/:id/compliance_decisions': {
    operationId: 'listComplianceDecisions',
    summary: 'Read sandbox compliance decisions',
    tag: 'Operations',
    model: 'ComplianceList',
  },
  'POST /v1/operations/statements': {
    operationId: 'createStatement',
    summary: 'Queue reconciliation of a provider ledger snapshot',
    tag: 'Operations',
    model: 'Statement',
    body: empty,
    status: 202,
  },
  'GET /v1/operations/statements': {
    operationId: 'listStatements',
    summary: 'List owned snapshot reconciliation runs',
    tag: 'Operations',
    model: 'StatementList',
    list: true,
  },
  'GET /v1/operations/statements/:id': {
    operationId: 'getStatement',
    summary: 'Read reconciliation with unowned rows redacted',
    tag: 'Operations',
    model: 'StatementDetail',
  },

  'GET /v1/me': {
    operationId: 'getMerchant',
    summary: 'Get your merchant',
    tag: 'Workspace',
    model: 'Merchant',
  },
  'GET /v1/assets': {
    operationId: 'listAssets',
    summary: 'List sandbox assets',
    tag: 'Workspace',
    model: 'AssetList',
  },
  'GET /v1/balances': {
    operationId: 'listBalances',
    summary: 'Read ledger balances',
    tag: 'Workspace',
    model: 'BalanceList',
  },
  'POST /v1/customers': {
    operationId: 'createCustomer',
    summary: 'Create a sandbox customer',
    tag: 'Customers',
    model: 'Customer',
    body: customerSchema,
    status: 201,
  },
  'GET /v1/customers': {
    operationId: 'listCustomers',
    summary: 'List customers',
    tag: 'Customers',
    model: 'CustomerList',
    list: true,
  },
  'GET /v1/customers/:id': {
    operationId: 'getCustomer',
    summary: 'Read a customer',
    tag: 'Customers',
    model: 'Customer',
  },
  'POST /v1/customers/:id/instruments': {
    operationId: 'createInstrument',
    summary: 'Create a verified sandbox instrument',
    tag: 'Customers',
    model: 'Instrument',
    body: instrumentSchema,
    status: 201,
  },
  'GET /v1/customers/:id/instruments': {
    operationId: 'listInstruments',
    summary: 'List customer instruments',
    tag: 'Customers',
    model: 'InstrumentList',
    list: true,
  },
  'POST /v1/quotes': {
    operationId: 'createQuote',
    summary: 'Quote an asset conversion',
    tag: 'Payments',
    model: 'Quote',
    body: quoteSchema,
    status: 201,
  },
  'GET /v1/quotes/:id': {
    operationId: 'getQuote',
    summary: 'Read a quote',
    tag: 'Payments',
    model: 'Quote',
  },
  'POST /v1/intents': {
    operationId: 'createIntent',
    summary: 'Reserve funds and create an intent',
    tag: 'Payments',
    model: 'Intent',
    body: intentSchema,
    status: 201,
  },
  'GET /v1/intents': {
    operationId: 'listIntents',
    summary: 'List and filter intents',
    tag: 'Payments',
    model: 'IntentList',
    list: true,
  },
  'GET /v1/intents/:id': {
    operationId: 'getIntent',
    summary: 'Read intent state and history',
    tag: 'Payments',
    model: 'Intent',
  },
  'POST /v1/intents/:id/cancel': {
    operationId: 'cancelIntent',
    summary: 'Cancel an unsent intent',
    tag: 'Payments',
    model: 'Intent',
    body: empty,
  },
  'GET /v1/events': {
    operationId: 'listEvents',
    summary: 'List immutable events',
    tag: 'Webhooks',
    model: 'EventList',
    list: true,
  },
  'POST /v1/webhook_endpoints': {
    operationId: 'createWebhookEndpoint',
    summary: 'Register a signed webhook',
    tag: 'Webhooks',
    model: 'WebhookEndpoint',
    body: webhookSchema,
    status: 201,
  },
  'GET /v1/webhook_endpoints': {
    operationId: 'listWebhookEndpoints',
    summary: 'List endpoints without secrets',
    tag: 'Webhooks',
    model: 'EndpointList',
    list: true,
  },
  'POST /v1/webhook_endpoints/:id/disable': {
    operationId: 'disableWebhookEndpoint',
    summary: 'Disable a webhook endpoint',
    tag: 'Webhooks',
    model: 'DisabledEndpoint',
    body: empty,
  },
  'GET /v1/webhook_deliveries': {
    operationId: 'listWebhookDeliveries',
    summary: 'Inspect recent webhook deliveries',
    tag: 'Webhooks',
    model: 'DeliveryList',
  },
  'POST /v1/events/:id/replay': {
    operationId: 'replayEvent',
    summary: 'Replay a stable event ID',
    tag: 'Webhooks',
    model: 'Replay',
    body: empty,
    status: 202,
  },
  'GET /v1/api_keys': {
    operationId: 'listApiKeys',
    summary: 'List keys without secrets',
    tag: 'Developers',
    model: 'KeyList',
    list: true,
  },
  'POST /v1/api_keys': {
    operationId: 'createApiKey',
    summary: 'Create a scoped API key',
    tag: 'Developers',
    model: 'KeyCreated',
    body: keySchema,
    status: 201,
  },
  'POST /v1/api_keys/:id/revoke': {
    operationId: 'revokeApiKey',
    summary: 'Revoke a scoped key',
    tag: 'Developers',
    model: 'ApiKey',
    body: empty,
  },
  'GET /v1/request_logs': {
    operationId: 'listRequestLogs',
    summary: 'Inspect redacted API request metadata',
    tag: 'Developers',
    model: 'RequestLogList',
  },
  'GET /v1/console/overview': {
    operationId: 'getOverview',
    summary: 'Read actual sandbox volume and ledger totals',
    tag: 'Workspace',
    model: 'Overview',
  },
  'GET /v1/operations/reconciliation': {
    operationId: 'listReconciliation',
    summary: 'Inspect owned reconciliation items',
    tag: 'Operations',
    model: 'ReconciliationList',
  },
  'GET /v1/operations/intents/:id': {
    operationId: 'getOperationDetail',
    summary: 'Inspect instructions, receipts and journals',
    tag: 'Operations',
    model: 'OperationDetail',
  },
  'POST /v1/operations/intents/:id/recover': {
    operationId: 'recoverIntent',
    summary: 'Queue safe status recovery',
    tag: 'Operations',
    model: 'Recovery',
    body: empty,
    status: 202,
  },
};
export function jsonSchema(schema: z.ZodType, input = false) {
  const { $schema, ...result } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: input ? 'input' : 'output',
  });
  return result;
}
