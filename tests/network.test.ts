import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pool, id, transaction } from '../packages/database/src/index.js';
import {
  createMerchant,
  sandboxFund,
  balances,
  reverseJournal,
  invariantReport,
} from '../packages/ledger/src/index.js';
import { issueApiKey } from '../packages/payments/src/auth.js';
import { buildApi } from '../services/api/src/app.js';
import { processIntent } from '../packages/payments/src/index.js';
import { FakeConnector } from '../connectors/fake/src/index.js';
const apps: Awaited<ReturnType<typeof buildApi>>[] = [];
after(async () => {
  for (const app of apps) await app.close();
  await pool.end();
});
async function fixture() {
  const merchant = id('test');
  await createMerchant(merchant, 'Network fixture');
  await sandboxFund(merchant, 'NGN', '10000000', id('fund'));
  const key = await issueApiKey(merchant, 'Network fixture');
  const app = await buildApi({ serveWeb: false, rateLimitMax: 10000 });
  apps.push(app);
  const headers = { authorization: `Bearer ${key.secret}` };
  const post = (url: string, payload: unknown, idem = id('idem')) =>
    app.inject({
      method: 'POST',
      url,
      headers: { ...headers, 'idempotency-key': idem },
      payload: payload as Record<string, unknown>,
    });
  const get = (url: string) => app.inject({ url, headers });
  const customer = (await post('/v1/customers', { name: 'Nigeria recipient' })).json();
  const destination = (
    await post(`/v1/customers/${customer.id}/instruments`, {
      type: 'bank_account',
      asset: 'NGN',
      label: 'Sandbox bank',
      sandbox_identifier: 'sandbox:network-bank',
    })
  ).json();
  async function quote(scenario = 'success', corridor_id = 'ng-ng-sandbox') {
    const response = await post('/v1/network/quotes', {
      corridor_id,
      amount_minor: '160000',
      scenario,
    });
    assert.equal(response.statusCode, 201, response.body);
    return response.json();
  }
  async function intent(scenario = 'success') {
    const q = await quote(scenario),
      body = {
        plan_id: q.plan_id,
        customer_id: customer.id,
        destination_instrument_id: destination.id,
        reference: id('order'),
      };
    const r = await post('/v1/network/intents', body);
    assert.equal(r.statusCode, 201, r.body);
    return { q, i: r.json(), body };
  }
  return { merchant, post, get, quote, intent, customer, destination };
}
const detail = async (f: Awaited<ReturnType<typeof fixture>>, plan: string) => {
  const r = await f.get(`/v1/network/plans/${plan}`);
  assert.equal(r.statusCode, 200, r.body);
  return r.json();
};
const ngn = async (merchant: string) =>
  Object.fromEntries(
    (await balances(merchant)).filter((b) => b.asset === 'NGN').map((b) => [b.purpose, b.minor]),
  );
test('Nigeria registry, frozen bigint quote, and disabled second-country corridor', async () => {
  const f = await fixture(),
    r = await f.get('/v1/network');
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().external_validated, false);
  assert.equal(
    r.json().corridors.find((c: { id: string }) => c.id === 'ng-ke-sandbox').enabled,
    false,
  );
  assert.equal(
    (await f.post('/v1/network/quotes', { corridor_id: 'ng-ke-sandbox', amount_minor: '160000' }))
      .statusCode,
    422,
  );
  assert.equal(
    (await f.post('/v1/network/quotes', { corridor_id: 'ng-ng-sandbox', amount_minor: '1' }))
      .statusCode,
    422,
  );
  const key = id('idem'),
    body = { corridor_id: 'ng-ng-sandbox', amount_minor: '160001' };
  const a = await f.post('/v1/network/quotes', body, key),
    b = await f.post('/v1/network/quotes', body, key);
  assert.equal(a.statusCode, 201, a.body);
  assert.deepEqual(a.json(), b.json());
  assert.equal(a.json().fee.amount_minor, '801');
  assert.equal(a.json().destination.amount_minor, '159200');
  assert.equal(a.json().route.length, 3);
  assert.equal(
    (await f.post('/v1/network/quotes', { ...body, amount_minor: '160002' }, key)).statusCode,
    409,
  );
  await assert.rejects(
    pool.query('UPDATE network_plans SET scenario=$2 WHERE id=$1', [a.json().plan_id, 'timeout']),
    /immutable/i,
  );
});
test('concurrent admission reserves one hold and capacity; three receipts capture once', async () => {
  const f = await fixture(),
    q = await f.quote(),
    key = id('idem'),
    body = {
      plan_id: q.plan_id,
      customer_id: f.customer.id,
      destination_instrument_id: f.destination.id,
      reference: 'concurrent-network',
    };
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => f.post('/v1/network/intents', body, key)),
  );
  for (const r of responses) assert.equal(r.statusCode, 201, r.body);
  assert.equal(new Set(responses.map((r) => r.json().id)).size, 1);
  const intentId = responses[0].json().id;
  assert.deepEqual(await ngn(f.merchant), { available: '9840000', reserved: '160000' });
  await Promise.all([processIntent(intentId), processIntent(intentId)]);
  await processIntent(intentId);
  assert.equal((await f.get(`/v1/intents/${intentId}`)).json().state, 'succeeded');
  const p = await detail(f, q.plan_id);
  assert.equal(p.capacity_state, 'consumed');
  assert.equal(p.legs.length, 3);
  assert.ok(
    p.legs.every(
      (l: { state: string; journal_id: string }) => l.state === 'confirmed' && l.journal_id,
    ),
  );
  assert.deepEqual(await ngn(f.merchant), { available: '9840000', reserved: '0' });
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int n FROM receipts WHERE instruction_id=(SELECT id FROM instructions WHERE intent_id=$1)',
        [intentId],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(reverseJournal(p.legs[1].journal_id, id('reverse'), 'Review'), /lifecycle/i);
  await assert.rejects(
    pool.query("UPDATE network_movements SET outcome='rejected' WHERE leg_id=$1", [p.legs[0].id]),
    /immutable/i,
  );
  const stages = (
    await pool.query(
      'SELECT DISTINCT a.purpose FROM ledger_entries e JOIN ledger_accounts a ON a.id=e.account_id WHERE e.journal_id=ANY($1)',
      [p.legs.map((l: { journal_id: string }) => l.journal_id)],
    )
  ).rows
    .map((r) => r.purpose)
    .sort();
  assert.deepEqual(stages, ['network_in_transit', 'network_settled']);
});
test('accepted settlement timeout recovers saved legs without resending', async () => {
  const f = await fixture(),
    { q, i } = await f.intent('timeout');
  await processIntent(i.id);
  let p = await detail(f, q.plan_id);
  assert.equal(p.legs.length, 2);
  assert.equal(p.legs[1].outcome, 'confirmed');
  assert.equal(p.legs[1].state, 'unknown');
  const refs = p.legs.map((l: { provider_reference: string }) => l.provider_reference);
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state, 'unknown');
  assert.equal(p.capacity_state, 'held');
  await processIntent(i.id);
  p = await detail(f, q.plan_id);
  assert.equal(p.legs.length, 3);
  assert.deepEqual(
    p.legs.slice(0, 2).map((l: { provider_reference: string }) => l.provider_reference),
    refs,
  );
  assert.equal(p.capacity_state, 'consumed');
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state, 'succeeded');
});
test('process crash after persisted settlement recovers exactly one movement per leg', async () => {
  const f = await fixture(),
    { q, i } = await f.intent();
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'scripts/network-crash-fixture.ts', i.id],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let stderr = '';
  child.stderr.on('data', (data) => {
    stderr += data;
  });
  assert.equal(await new Promise((resolve) => child.on('exit', resolve)), 73, stderr);
  let p = await detail(f, q.plan_id);
  assert.equal(p.legs.length, 2);
  assert.equal(p.legs[1].outcome, 'confirmed');
  await processIntent(i.id);
  p = await detail(f, q.plan_id);
  assert.equal(p.legs.length, 3);
  assert.equal(p.capacity_state, 'consumed');
});
test('partial payout rejection retains financial hold, capacity, and reconciliation on retry', async () => {
  const f = await fixture(),
    { q, i } = await f.intent('insufficient_float');
  await processIntent(i.id);
  await processIntent(i.id);
  const p = await detail(f, q.plan_id);
  assert.deepEqual(
    p.legs.map((l: { outcome: string }) => l.outcome),
    ['confirmed', 'confirmed', 'rejected'],
  );
  assert.equal(p.capacity_state, 'held');
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state, 'unknown');
  assert.deepEqual(await ngn(f.merchant), { available: '9840000', reserved: '160000' });
  assert.equal((await f.post(`/v1/intents/${i.id}/cancel`, {})).statusCode, 409);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM reconciliation_items WHERE intent_id=$1 AND state='open'",
        [i.id],
      )
    ).rows[0].n,
    1,
  );
});
test('merchant pause permits known status lookup but blocks a new payout leg', async () => {
  const f = await fixture(),
    { q, i } = await f.intent('timeout');
  await processIntent(i.id);
  assert.equal(
    (await f.post('/v1/controls/pause', { reason: 'Partial route incident' })).statusCode,
    200,
  );
  await processIntent(i.id);
  const p = await detail(f, q.plan_id);
  assert.equal(p.legs.length, 2);
  assert.ok(p.legs.every((l: { state: string }) => l.state === 'confirmed'));
  assert.equal(p.capacity_state, 'held');
});
test('cancellation frees corridor capacity; route cannot switch to a direct connector', async () => {
  const f = await fixture(),
    { q, i } = await f.intent();
  await assert.rejects(processIntent(i.id, { connector: new FakeConnector() }), /cannot fall back/);
  assert.equal((await f.post(`/v1/intents/${i.id}/cancel`, {})).statusCode, 200);
  assert.equal((await detail(f, q.plan_id)).capacity_state, 'released');
  assert.deepEqual(await ngn(f.merchant), { available: '10000000', reserved: '0' });
});
test('tenant isolation and unavailable frozen participant prevent admission without funds held', async () => {
  const a = await fixture(),
    b = await fixture(),
    q = await a.quote();
  assert.equal((await b.get(`/v1/network/plans/${q.plan_id}`)).statusCode, 404);
  assert.equal(
    (
      await b.post('/v1/network/intents', {
        plan_id: q.plan_id,
        customer_id: b.customer.id,
        destination_instrument_id: b.destination.id,
        reference: 'foreign',
      })
    ).statusCode,
    404,
  );
  await pool.query(
    "UPDATE network_participants SET enabled=false WHERE id='nigeria-payout-sandbox'",
  );
  try {
    const r = await a.post('/v1/network/intents', {
      plan_id: q.plan_id,
      customer_id: a.customer.id,
      destination_instrument_id: a.destination.id,
      reference: 'held-provider',
    });
    assert.equal(r.statusCode, 422, r.body);
    assert.deepEqual(await ngn(a.merchant), { available: '10000000', reserved: '0' });
  } finally {
    await pool.query(
      "UPDATE network_participants SET enabled=true WHERE id='nigeria-payout-sandbox'",
    );
  }
});
test('capacity admission serializes concurrent routes and rolls back rejected holds', async () => {
  const f = await fixture(),
    corridor = id('corridor');
  await pool.query(
    "INSERT INTO network_corridors SELECT $1,source_asset,destination_asset,origin_id,settlement_id,destination_id,true,160000,mode FROM network_corridors WHERE id='ng-ng-sandbox'",
    [corridor],
  );
  const quotes = await Promise.all([f.quote('success', corridor), f.quote('success', corridor)]);
  const responses = await Promise.all(
    quotes.map((q) =>
      f.post('/v1/network/intents', {
        plan_id: q.plan_id,
        customer_id: f.customer.id,
        destination_instrument_id: f.destination.id,
        reference: id('order'),
      }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.statusCode).sort(), [201, 422]);
  assert.deepEqual(await ngn(f.merchant), { available: '9840000', reserved: '160000' });
  const accepted = responses.find((r) => r.statusCode === 201)!.json();
  await f.post(`/v1/intents/${accepted.id}/cancel`, {});
  await pool.query('UPDATE network_corridors SET enabled=false WHERE id=$1', [corridor]);
});
test('all route journals remain balanced and merchant funds nonnegative', async () => {
  const report = await invariantReport();
  assert.equal(
    report.balanced && report.nonnegative && report.no_empty_journals,
    true,
    JSON.stringify(report),
  );
});
test('expiry before submission releases capacity; expiry after acceptance retains the hold', async () => {
  const f = await fixture(),
    first = await f.intent(),
    clock = () => new Date(Date.now() + 600000);
  await processIntent(first.i.id, { clock });
  assert.equal((await detail(f, first.q.plan_id)).capacity_state, 'released');
  const second = await f.intent('timeout');
  await processIntent(second.i.id);
  await processIntent(second.i.id, { clock });
  const p = await detail(f, second.q.plan_id);
  assert.equal(p.capacity_state, 'held');
  assert.equal(p.legs.length, 2);
  assert.deepEqual(await ngn(f.merchant), { available: '9840000', reserved: '160000' });
});
test('quote arithmetic preserves amounts above the JavaScript integer range', async () => {
  const f = await fixture();
  await pool.query('UPDATE merchants SET max_source_minor=$2 WHERE id=$1', [
    f.merchant,
    '999999999999999999',
  ]);
  const gross = 900719925474099301n,
    fee = (gross * 5n + 999n) / 1000n;
  const r = await f.post('/v1/network/quotes', {
    corridor_id: 'ng-ng-sandbox',
    amount_minor: gross.toString(),
  });
  assert.equal(r.statusCode, 201, r.body);
  assert.equal(r.json().source.amount_minor, gross.toString());
  assert.equal(r.json().fee.amount_minor, fee.toString());
  assert.equal(
    r.json().destination.amount_minor,
    (((((gross - fee) * 10000000n) / 160000n) * 160000n) / 10000000n).toString(),
  );
});
