import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { buildApi } from '../services/api/src/app.js';
import { pool, id } from '../packages/database/src/index.js';
import {
  createMerchant,
  sandboxFund,
  balances,
  invariantReport,
  reverseJournal,
} from '../packages/ledger/src/index.js';
import { issueApiKey } from '../packages/payments/src/auth.js';
import { processIntent, recoverPaystackIntent } from '../packages/payments/src/index.js';
import { runRailOnce, verifyCollection } from '../packages/rails/src/index.js';
import { PaystackClient, parseProviderJson } from '../connectors/paystack/src/index.js';
import { models } from '../packages/contracts/src/index.js';
import { paystackHarness } from './paystack-harness.js';
process.env.KORA_WEBHOOK_ENCRYPTION_KEY = randomBytes(32).toString('base64');
delete process.env.PAYSTACK_SECRET_KEY;
const cleanup: (() => Promise<unknown>)[] = [];
after(async () => {
  for (const close of cleanup.reverse()) await close();
  await pool.end();
});
async function fixture(configured = true, scopes?: Parameters<typeof issueApiKey>[2]) {
  const h = await paystackHarness();
  cleanup.push(h.close);
  const merchant = id('test');
  await createMerchant(merchant, 'Local rail test');
  await sandboxFund(merchant, 'NGN', '1000000', `fund:${merchant}`);
  const key = await issueApiKey(merchant, 'Test operator', scopes),
    app = await buildApi({
      serveWeb: false,
      rateLimitMax: 10000,
      paystackClient: configured ? h.client : undefined,
    });
  cleanup.push(() => app.close());
  const headers = { authorization: `Bearer ${key.secret}` };
  const get = (url: string) => app.inject({ url, headers });
  const post = (url: string, payload: Record<string, unknown>, idem = id('idem')) =>
    app.inject({ method: 'POST', url, headers: { ...headers, 'idempotency-key': idem }, payload });
  const customer = (await post('/v1/customers', { name: 'Rail recipient' })).json();
  async function bank() {
    const enquiry = await post('/v1/bank_resolutions', {
      account_number: '0001234567',
      bank_code: '058',
    });
    assert.equal(enquiry.statusCode, 201, enquiry.body);
    const r = await post(`/v1/customers/${customer.id}/bank_accounts`, {
      resolution_id: enquiry.json().id,
      label: 'Test bank account',
    });
    assert.equal(r.statusCode, 201, r.body);
    return { enquiry: enquiry.json(), account: r.json() };
  }
  async function payout() {
    const b = await bank();
    const r = await post('/v1/local_payouts', {
      customer_id: customer.id,
      destination_instrument_id: b.account.instrument_id,
      amount_minor: '100000',
      reference: 'Local payout',
    });
    assert.equal(r.statusCode, 201, r.body);
    models.Intent.parse(r.json());
    return r.json();
  }
  async function collection() {
    const r = await post('/v1/collections', {
      customer_id: customer.id,
      amount_minor: '100000',
      email: 'payer@example.test',
    });
    assert.equal(r.statusCode, 201, r.body);
    models.Collection.parse(r.json());
    return r.json();
  }
  const state = async (intent: string) => (await get(`/v1/intents/${intent}`)).json();
  const money = async (purpose = 'available') =>
    (await balances(merchant)).find((b) => b.asset === 'NGN' && b.purpose === purpose)!.minor;
  const rail = async (resource: string) =>
    runRailOnce({ client: h.client, onlyResource: resource });
  const callback = async (event: string, ref: string, signature = true) => {
    const raw = JSON.stringify({ event, data: { reference: ref, domain: 'test' } });
    return app.inject({
      method: 'POST',
      url: '/internal/providers/paystack/webhook',
      headers: {
        'content-type': 'application/json',
        'x-paystack-signature': signature ? h.sign(raw) : '0'.repeat(128),
      },
      payload: raw,
    });
  };
  return {
    h,
    app,
    merchant,
    customer,
    get,
    post,
    bank,
    payout,
    collection,
    state,
    money,
    rail,
    callback,
  };
}
test('Paystack rejects live keys and preserves 64-bit provider IDs as exact strings', () => {
  assert.throws(() => new PaystackClient({ secretKey: 'sk_live_rejected000000' }));
  assert.throws(() => new PaystackClient({ secretKey: 'pk_test_rejected000000' }));
  assert.deepEqual(
    parseProviderJson('{"id":18446744073709551615,"amount":100000,"difference":-100000}'),
    { id: '18446744073709551615', amount: '100000', difference: '-100000' },
  );
});
test('unconfigured rail is explicit and collection creation has no ledger or outbox effects', async () => {
  const f = await fixture(false);
  assert.equal((await f.get('/v1/rails')).json().configured, false);
  assert.equal(
    (
      await f.post('/v1/collections', {
        customer_id: f.customer.id,
        amount_minor: '100000',
        email: 'payer@example.test',
      })
    ).statusCode,
    503,
  );
  assert.equal(
    (await pool.query('SELECT count(*)::int n FROM collections WHERE merchant_id=$1', [f.merchant]))
      .rows[0].n,
    0,
  );
  assert.equal(await f.money(), '1000000');
});
test('name enquiry encrypts full account details, registers a deduplicated recipient and hides foreign resources', async () => {
  const a = await fixture(),
    b = await fixture();
  const resolved = await a.bank();
  models.BankResolution.parse(resolved.enquiry);
  models.BankAccount.parse(resolved.account);
  const stored = (
    await pool.query('SELECT account_sealed FROM bank_resolutions WHERE id=$1', [
      resolved.enquiry.id,
    ])
  ).rows[0];
  assert.equal(stored.account_sealed.includes('0001234567'), false);
  assert.equal(JSON.stringify(resolved).includes('0001234567'), false);
  const duplicate = await a.post(`/v1/customers/${a.customer.id}/bank_accounts`, {
    resolution_id: resolved.enquiry.id,
    label: 'Same account',
  });
  assert.equal(duplicate.json().instrument_id, resolved.account.instrument_id);
  assert.equal(
    (
      await b.post(`/v1/customers/${b.customer.id}/bank_accounts`, {
        resolution_id: resolved.enquiry.id,
        label: 'Foreign',
      })
    ).statusCode,
    404,
  );
  assert.equal((await b.get(`/v1/customers/${a.customer.id}/bank_accounts`)).statusCode, 404);
});
test('domestic payout captures one hold and produces no simulator destination journal', async () => {
  const f = await fixture(),
    i = await f.payout();
  assert.equal(i.provider, 'paystack-test');
  assert.equal(i.destination.amount_minor, '99500');
  assert.equal(await f.money(), '900000');
  await Promise.all([
    processIntent(i.id, { connector: f.h.connector }),
    processIntent(i.id, { connector: f.h.connector }),
  ]);
  assert.equal((await f.state(i.id)).state, 'succeeded');
  assert.equal(f.h.counts().transferPosts, 1);
  const d = (await f.get(`/v1/operations/intents/${i.id}`)).json();
  assert.equal(d.hold.state, 'captured');
  assert.equal(d.receipts.length, 1);
  assert.equal(
    d.journals.some((j: { reference: string }) => j.reference.startsWith('destination:')),
    false,
  );
  const ins = (await pool.query('SELECT request FROM instructions WHERE intent_id=$1', [i.id]))
    .rows[0].request;
  assert.equal(JSON.stringify(ins).includes('0001234567'), false);
  assert.equal(ins.bank_identity.account_hash.length, 64);
});
test('accepted payout with lost acknowledgement recovers by reference without a second POST', async () => {
  const f = await fixture(),
    i = await f.payout();
  f.h.control.dropTransfer = true;
  await processIntent(i.id, { connector: f.h.connector });
  assert.equal((await f.state(i.id)).state, 'unknown');
  assert.equal(await f.money('reserved'), '100000');
  await processIntent(i.id, { connector: f.h.connector });
  assert.equal((await f.state(i.id)).state, 'succeeded');
  assert.equal(f.h.counts().transferPosts, 1);
});
test('pending or unavailable provider status keeps funds held and does not resend', async () => {
  const f = await fixture(),
    i = await f.payout();
  f.h.control.transferStatus = 'pending';
  await processIntent(i.id, { connector: f.h.connector });
  await processIntent(i.id, { connector: f.h.connector });
  f.h.control.verifyUnavailable = true;
  await processIntent(i.id, { connector: f.h.connector });
  assert.equal((await f.state(i.id)).state, 'unknown');
  assert.equal(f.h.counts().transferPosts, 1);
  assert.equal(await f.money('reserved'), '100000');
});
for (const [name, patch] of Object.entries({
  currency: { currency: 'USD' },
  amount: { amount: '99499' },
  domain: { domain: 'live' },
  reference: { reference: 'other' },
  recipient: {
    recipient: {
      recipient_code: 'RCP_wrong',
      currency: 'NGN',
      domain: 'test',
      details: { bank_code: '058', account_number: '0001234567' },
    },
  },
  bank_identity: {
    recipient: {
      recipient_code: 'SAME',
      currency: 'NGN',
      domain: 'test',
      details: { bank_code: '058', account_number: '9999999999' },
    },
  },
  fee: { fee_charged: null },
})) {
  test(`payout rejects mismatched ${name} evidence without spending the hold`, async () => {
    const f = await fixture(),
      i = await f.payout();
    f.h.control.dropTransfer = true;
    await processIntent(i.id, { connector: f.h.connector });
    if (name === 'bank_identity') {
      const t = [...f.h.transfers.values()][0];
      (patch as any).recipient.recipient_code = t.recipient.recipient_code;
    }
    f.h.control.transferPatch = patch;
    await processIntent(i.id, { connector: f.h.connector });
    assert.equal((await f.state(i.id)).state, 'unknown');
    assert.equal(await f.money('reserved'), '100000');
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int n FROM receipts r JOIN instructions ins ON ins.id=r.instruction_id WHERE ins.intent_id=$1',
          [i.id],
        )
      ).rows[0].n,
      0,
    );
  });
}
test('verified rejection releases source funds once', async () => {
  const f = await fixture(),
    i = await f.payout();
  f.h.control.transferStatus = 'failed';
  await processIntent(i.id, { connector: f.h.connector });
  await processIntent(i.id, { connector: f.h.connector });
  assert.equal((await f.state(i.id)).state, 'failed');
  assert.equal(await f.money(), '1000000');
  assert.equal(await f.money('reserved'), '0');
});
test('provider payout fee is recorded separately and cannot silently reduce the merchant amount', async () => {
  const f = await fixture(),
    i = await f.payout();
  f.h.control.transferFee = '100';
  await processIntent(i.id, { connector: f.h.connector });
  const d = (await f.get(`/v1/operations/intents/${i.id}`)).json();
  assert.equal(d.rail_receipts[0].kind, 'payout_fee');
  assert.equal(d.rail_receipts[0].payload.fee_minor, '100');
  assert.equal(await f.money(), '900000');
  assert.equal(
    d.journals.some((j: { reference: string }) => j.reference === `provider-fee:${i.id}`),
    true,
  );
});
test('late reversal credits source principal and Kora fee once despite duplicate callbacks', async () => {
  const f = await fixture(),
    i = await f.payout();
  await processIntent(i.id, { connector: f.h.connector });
  const ref = [...f.h.transfers.keys()][0];
  f.h.reverse(ref);
  const a = await f.callback('transfer.reversed', ref),
    b = await f.callback('transfer.reversed', ref);
  assert.equal(a.statusCode, 200, a.body);
  assert.equal(b.json().duplicate, true);
  assert.equal((await f.state(i.id)).state, 'succeeded');
  const inbox = (
    await pool.query('SELECT id FROM provider_inbox WHERE provider_reference=$1', [ref])
  ).rows[0];
  await f.rail(inbox.id);
  await Promise.all([
    recoverPaystackIntent(i.id, f.h.connector),
    recoverPaystackIntent(i.id, f.h.connector),
  ]);
  assert.equal((await f.state(i.id)).state, 'returned');
  assert.equal(await f.money(), '1000000');
  const d = (await f.get(`/v1/operations/intents/${i.id}`)).json();
  assert.equal(d.hold.state, 'captured');
  assert.equal(d.rail_receipts.filter((r: { kind: string }) => r.kind === 'return').length, 1);
  assert.equal(
    d.journals.filter((j: { reference: string }) => j.reference.startsWith('return:')).length,
    1,
  );
  f.h.transfers.get(ref)!.status = 'success';
  await recoverPaystackIntent(i.id, f.h.connector);
  assert.equal((await f.state(i.id)).state, 'returned');
  assert.equal(await f.money(), '1000000');
});
test('reversal before settlement releases the hold and stores an immutable return receipt', async () => {
  const f = await fixture(),
    i = await f.payout();
  f.h.control.transferStatus = 'reversed';
  await processIntent(i.id, { connector: f.h.connector });
  assert.equal((await f.state(i.id)).state, 'returned');
  assert.equal(await f.money(), '1000000');
  const d = (await f.get(`/v1/operations/intents/${i.id}`)).json();
  assert.equal(d.hold.state, 'released');
  assert.equal(d.rail_receipts[0].kind, 'return');
});
test('collection webhook is authenticated, durable, deduplicated and verifies remotely before crediting', async () => {
  const f = await fixture(),
    col = await f.collection();
  await f.rail(col.id);
  assert.equal((await f.get(`/v1/collections/${col.id}`)).json().state, 'pending');
  assert.equal((await f.callback('charge.success', col.provider_reference, false)).statusCode, 401);
  assert.equal((await f.callback('charge.success', col.provider_reference)).statusCode, 200);
  assert.equal(await f.money(), '1000000');
  const inbox = (
    await pool.query('SELECT id,payload_sealed FROM provider_inbox WHERE provider_reference=$1', [
      col.provider_reference,
    ])
  ).rows[0];
  assert.equal(inbox.payload_sealed.includes(col.provider_reference), false);
  await f.rail(inbox.id);
  assert.equal(await f.money(), '1000000');
  f.h.complete(col.provider_reference);
  await Promise.all([verifyCollection(col.id, f.h.client), verifyCollection(col.id, f.h.client)]);
  assert.equal(await f.money(), '1099900');
  const settled = (await f.get(`/v1/collections/${col.id}`)).json();
  assert.equal(settled.state, 'succeeded');
  assert.equal(settled.fee_minor, '100');
  assert.equal(settled.credited_minor, '99900');
  assert.equal((await f.callback('charge.success', col.provider_reference)).json().duplicate, true);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM rail_receipts WHERE resource_id=$1 AND kind='collection'",
        [col.id],
      )
    ).rows[0].n,
    1,
  );
  models.EventList.parse((await f.get('/v1/events')).json());
});
test('lost collection initialization is verified by the original reference with no fresh checkout POST', async () => {
  const f = await fixture(),
    col = await f.collection();
  f.h.control.dropCollection = true;
  await f.rail(col.id);
  assert.equal((await f.get(`/v1/collections/${col.id}`)).json().state, 'unknown');
  await f.post(`/v1/collections/${col.id}/verify`, {});
  await f.rail(col.id);
  assert.equal(f.h.counts().collectionPosts, 1);
  f.h.complete(col.provider_reference);
  await verifyCollection(col.id, f.h.client);
  assert.equal(await f.money(), '1099900');
});
test('collection checks payer, currency, domain, amount and known fee before any credit', async () => {
  const f = await fixture(),
    col = await f.collection();
  await f.rail(col.id);
  f.h.complete(col.provider_reference);
  for (const patch of [
    { customer: { email: 'foreign@example.test' } },
    { currency: 'USD' },
    { domain: 'live' },
    { amount: '1' },
    { fees: null },
    { fees: '100000' },
  ]) {
    f.h.control.chargePatch = patch;
    await assert.rejects(verifyCollection(col.id, f.h.client));
    assert.equal(await f.money(), '1000000');
  }
  f.h.control.chargePatch = {};
  await verifyCollection(col.id, f.h.client);
  assert.equal(await f.money(), '1099900');
});
test('compliance blocks unsent payouts, reserves incoming credit, and releases it only after recorded approval', async () => {
  const f = await fixture(),
    i = await f.payout(),
    col = await f.collection();
  await f.rail(col.id);
  const r = await f.post(`/v1/customers/${f.customer.id}/compliance_decisions`, {
    decision: 'hold',
    reason: 'Test review hold',
  });
  assert.equal(r.statusCode, 201, r.body);
  await processIntent(i.id, { connector: f.h.connector });
  assert.equal(f.h.counts().transferPosts, 0);
  f.h.complete(col.provider_reference);
  await verifyCollection(col.id, f.h.client);
  assert.equal((await f.get(`/v1/collections/${col.id}`)).json().state, 'held');
  assert.equal(await f.money(), '900000');
  assert.equal(await f.money('reserved'), '199900');
  assert.equal((await f.post(`/v1/collections/${col.id}/release`, {})).statusCode, 422);
  await f.post(`/v1/customers/${f.customer.id}/compliance_decisions`, {
    decision: 'allow',
    reason: 'Sandbox identity approval',
  });
  const a = await f.post(`/v1/collections/${col.id}/release`, {}),
    b = await f.post(`/v1/collections/${col.id}/release`, {});
  assert.equal(a.statusCode, 200, a.body);
  assert.equal(b.statusCode, 200);
  assert.equal(await f.money(), '999900');
  assert.equal(await f.money('reserved'), '100000');
});
test('provider instruments cannot bypass the domestic route through a simulator quote', async () => {
  const f = await fixture(),
    b = await f.bank();
  const q = (
    await f.post('/v1/quotes', {
      source_asset: 'KES',
      destination_asset: 'NGN',
      amount_minor: '10000',
    })
  ).json();
  const r = await f.post('/v1/intents', {
    quote_id: q.id,
    customer_id: f.customer.id,
    destination_instrument_id: b.account.instrument_id,
    reference: 'Wrong provider',
  });
  assert.equal(r.statusCode, 422, r.body);
  assert.equal(r.json().error.code, 'provider_mismatch');
});
test('snapshot reconciliation matches net collections, payout debits and verified returns, while redacting unowned rows', async () => {
  const f = await fixture(),
    i = await f.payout(),
    col = await f.collection();
  await processIntent(i.id, { connector: f.h.connector });
  await f.rail(col.id);
  f.h.complete(col.provider_reference);
  await verifyCollection(col.id, f.h.client);
  const ref = [...f.h.transfers.keys()][0];
  f.h.reverse(ref);
  await recoverPaystackIntent(i.id, f.h.connector);
  f.h.statements.push({
    id: '9999999999',
    domain: 'test',
    currency: 'NGN',
    difference: '777777777777',
    model_responsible: 'Transfer',
    model_row: '88888888',
    createdAt: new Date().toISOString(),
  });
  const r = await f.post('/v1/operations/statements', {});
  assert.equal(r.statusCode, 202, r.body);
  await f.rail(r.json().id);
  const d = await f.get(`/v1/operations/statements/${r.json().id}`);
  assert.equal(d.statusCode, 200, d.body);
  assert.equal(d.json().matched, 3);
  assert.equal(d.json().unmatched, 1);
  assert.equal(d.json().redacted_unmapped, 1);
  assert.equal(d.body.includes('777777777777'), false);
  assert.equal(d.body.includes('9999999999'), false);
  models.StatementDetail.parse(d.json());
  const foreign = await fixture();
  assert.equal((await foreign.get(`/v1/operations/statements/${r.json().id}`)).statusCode, 404);
});
test('snapshot amount mismatch is surfaced for review without changing money', async () => {
  const f = await fixture(),
    i = await f.payout();
  await processIntent(i.id, { connector: f.h.connector });
  f.h.statements[0].difference = '-99501';
  const r = await f.post('/v1/operations/statements', {});
  await f.rail(r.json().id);
  const d = (await f.get(`/v1/operations/statements/${r.json().id}`)).json();
  assert.equal(d.state, 'review');
  assert.equal(d.items[0].state, 'mismatch');
  assert.equal(await f.money(), '900000');
});
test('scopes, ownership, immutable instructions and balanced ledger survive local rail operations', async () => {
  const f = await fixture(),
    i = await f.payout();
  await processIntent(i.id, { connector: f.h.connector });
  await assert.rejects(
    pool.query("UPDATE intents SET provider='kora-sandbox' WHERE id=$1", [i.id]),
  );
  await assert.rejects(
    pool.query(
      'UPDATE instructions SET request=request||\'{"amount_minor":"1"}\'::jsonb WHERE intent_id=$1',
      [i.id],
    ),
  );
  const reader = await issueApiKey(f.merchant, 'Reader', ['payments:read']);
  const r = await f.app.inject({
    method: 'POST',
    url: '/v1/operations/statements',
    headers: { authorization: `Bearer ${reader.secret}`, 'idempotency-key': 'no-scope' },
    payload: {},
  });
  assert.equal(r.statusCode, 403);
  assert.deepEqual(await invariantReport(), {
    balanced: true,
    nonnegative: true,
    no_empty_journals: true,
    violations: [],
  });
});
test('changing provider credentials cannot resend or settle an existing payment under another account', async () => {
  const f = await fixture(),
    i = await f.payout(),
    col = await f.collection();
  f.h.control.dropTransfer = true;
  await processIntent(i.id, { connector: f.h.connector });
  const other = await paystackHarness();
  cleanup.push(other.close);
  await processIntent(i.id, { connector: other.connector });
  assert.equal((await f.state(i.id)).state, 'unknown');
  assert.equal(other.counts().transferPosts, 0);
  assert.equal(await f.money('reserved'), '100000');
  await assert.rejects(verifyCollection(col.id, other.client));
  await assert.rejects(
    pool.query('UPDATE collections SET provider_binding=$2 WHERE id=$1', [
      col.id,
      other.client.binding,
    ]),
  );
  await processIntent(i.id, { connector: f.h.connector });
  assert.equal((await f.state(i.id)).state, 'succeeded');
  assert.equal(f.h.counts().transferPosts, 1);
});
test('manual payout verification detects a late return even if its callback was lost', async () => {
  const f = await fixture(),
    i = await f.payout();
  await processIntent(i.id, { connector: f.h.connector });
  f.h.reverse([...f.h.transfers.keys()][0]);
  const queued = await f.post(`/v1/local_payouts/${i.id}/verify`, {});
  assert.equal(queued.statusCode, 202, queued.body);
  await f.rail(i.id);
  assert.equal((await f.state(i.id)).state, 'returned');
  assert.equal(await f.money(), '1000000');
});
test('empty and failed provider snapshots remain visibly reviewable and never certify an account', async () => {
  const f = await fixture();
  const empty = await f.post('/v1/operations/statements', {});
  await f.rail(empty.json().id);
  assert.equal(
    (await f.get(`/v1/operations/statements/${empty.json().id}`)).json().state,
    'review',
  );
  const failed = await f.post('/v1/operations/statements', {});
  f.h.statements.push({ id: 'invalid' });
  await f.rail(failed.json().id);
  assert.equal(
    (await f.get(`/v1/operations/statements/${failed.json().id}`)).json().state,
    'failed',
  );
  assert.equal(await f.money(), '1000000');
});
test('a fresh verification request fences the old worker acknowledgement while crediting once', async () => {
  const f = await fixture(),
    col = await f.collection();
  await f.rail(col.id);
  const original = f.h.client.verifyCollection.bind(f.h.client);
  let release!: () => void, notify!: () => void;
  const blocked = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      notify = resolve;
    });
  f.h.client.verifyCollection = async (reference) => {
    const snapshot = await original(reference);
    notify();
    await blocked;
    return snapshot;
  };
  const stale = f.rail(col.id);
  await started;
  assert.equal((await f.post(`/v1/collections/${col.id}/verify`, {})).statusCode, 202);
  f.h.complete(col.provider_reference);
  f.h.client.verifyCollection = original;
  await f.rail(col.id);
  release();
  await stale;
  const job = (
    await pool.query(
      "SELECT processed_at,last_error FROM outbox WHERE resource_id=$1 AND kind='collection_verify'",
      [col.id],
    )
  ).rows[0];
  assert.ok(job.processed_at);
  assert.equal(job.last_error, null);
  assert.equal(await f.money(), '1099900');
});
test('generic journal reversal cannot orphan a verified collection entitlement', async () => {
  const f = await fixture(),
    col = await f.collection();
  await f.rail(col.id);
  f.h.complete(col.provider_reference);
  await verifyCollection(col.id, f.h.client);
  const journal = (
    await pool.query('SELECT id FROM journals WHERE reference=$1', [`collection:${col.id}`])
  ).rows[0];
  await assert.rejects(
    reverseJournal(journal.id, id('reverse'), 'Invalid generic correction'),
    /payment lifecycle/,
  );
  assert.equal(await f.money(), '1099900');
  assert.equal((await f.get(`/v1/collections/${col.id}`)).json().state, 'succeeded');
});

test('emergency pause blocks collection creation and first provider initialization', async () => {
  const f = await fixture(),
    col = await f.collection();
  const paused = await f.post('/v1/controls/pause', { reason: 'Collection dispatch incident' });
  assert.equal(paused.statusCode, 200, paused.body);
  assert.equal(
    (
      await f.post('/v1/collections', {
        customer_id: f.customer.id,
        amount_minor: '100000',
        email: 'payer@example.test',
      })
    ).statusCode,
    423,
  );
  await runRailOnce({ client: f.h.client, onlyResource: col.id });
  assert.equal(f.h.counts().collectionPosts, 0);
  assert.equal((await f.get(`/v1/collections/${col.id}`)).json().state, 'processing');
});
test('verified incoming collection evidence still credits once during emergency pause', async () => {
  const f = await fixture(),
    col = await f.collection(),
    before = await f.money();
  await runRailOnce({ client: f.h.client, onlyResource: col.id });
  assert.equal(f.h.counts().collectionPosts, 1);
  await f.post('/v1/controls/pause', { reason: 'Recover accepted collection' });
  f.h.complete(col.provider_reference);
  await Promise.all([verifyCollection(col.id, f.h.client), verifyCollection(col.id, f.h.client)]);
  const row = (await f.get(`/v1/collections/${col.id}`)).json();
  assert.equal(row.state, 'succeeded');
  assert.equal(BigInt(await f.money()) - BigInt(before), BigInt(row.credited_minor));
  assert.equal(f.h.counts().collectionPosts, 1);
});
