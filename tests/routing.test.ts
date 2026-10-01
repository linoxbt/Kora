import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, id } from '../packages/database/src/index.js';
import { createMerchant, sandboxFund, balances } from '../packages/ledger/src/index.js';
import { issueApiKey } from '../packages/payments/src/auth.js';
import { processIntent } from '../packages/payments/src/index.js';
import { CorridorSandboxConnector } from '../packages/network/src/index.js';
import { buildApi } from '../services/api/src/app.js';
const apps: Awaited<ReturnType<typeof buildApi>>[] = [];
after(async () => {
  for (const app of apps) await app.close();
  await pool.end();
});
async function fixture() {
  const merchant = id('test');
  await createMerchant(merchant, 'Routing fixture');
  await sandboxFund(merchant, 'NGN', '10000000', id('fund'));
  const key = await issueApiKey(merchant, 'Routing fixture');
  const app = await buildApi({ serveWeb: false, rateLimitMax: 10000 });
  apps.push(app);
  const get = (url: string, secret = key.secret) =>
    app.inject({ url, headers: { authorization: `Bearer ${secret}` } });
  const post = (url: string, body: unknown, idem = id('idem'), secret = key.secret) =>
    app.inject({
      method: 'POST',
      url,
      headers: { authorization: `Bearer ${secret}`, 'idempotency-key': idem },
      payload: body as Record<string, unknown>,
    });
  const customer = (await post('/v1/customers', { name: 'Routing recipient' })).json();
  const instrument = (
    await post(`/v1/customers/${customer.id}/instruments`, {
      type: 'bank_account',
      asset: 'NGN',
      label: 'Sandbox bank',
      sandbox_identifier: 'sandbox:routing:recipient',
    })
  ).json();
  const routes = async () => {
    const r = await get('/v1/network/routing?amount_minor=160000');
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  };
  const health = async (participant_id = 'nigeria-payout-sandbox', status = 'unavailable') => {
    const r = await post('/v1/network/health', {
      participant_id,
      status,
      reason: 'Local health rehearsal',
      valid_for_seconds: 300,
    });
    assert.equal(r.statusCode, 201, r.body);
    return r.json();
  };
  const quote = async (scenario = 'success', corridor_id = 'auto') => {
    const r = await post('/v1/network/quotes', { corridor_id, amount_minor: '160000', scenario });
    assert.equal(r.statusCode, 201, r.body);
    return r.json();
  };
  const intent = async (q: { plan_id: string }) => {
    const r = await post('/v1/network/intents', {
      plan_id: q.plan_id,
      customer_id: customer.id,
      destination_instrument_id: instrument.id,
      reference: id('order'),
    });
    assert.equal(r.statusCode, 201, r.body);
    return r.json();
  };
  const plan = async (planId: string) => {
    const r = await get(`/v1/network/plans/${planId}`);
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  };
  return {
    merchant,
    app,
    key,
    get,
    post,
    routes,
    health,
    quote,
    intent,
    plan,
    customer,
    instrument,
  };
}
const ngn = async (merchant: string) =>
  Object.fromEntries(
    (await balances(merchant)).filter((b) => b.asset === 'NGN').map((b) => [b.purpose, b.minor]),
  );
test('automatic selection freezes deterministic provider choice and evaluation evidence', async () => {
  const f = await fixture(),
    routes = await f.routes();
  assert.equal(routes.candidates.length, 2);
  assert.equal(routes.selected_corridor_id, 'ng-ng-sandbox');
  assert.ok(routes.candidates.every((c: { eligible: boolean }) => c.eligible));
  const body = { corridor_id: 'auto', amount_minor: '160000' },
    key = id('idem');
  const r = await f.post('/v1/network/quotes', body, key);
  assert.equal(r.statusCode, 201, r.body);
  const q = r.json();
  assert.equal(q.routing.selected_corridor_id, 'ng-ng-sandbox');
  assert.equal(q.route[2].provider_binding, 'sim:nigeria-payout:v1');
  assert.deepEqual((await f.plan(q.plan_id)).snapshot.routing, q.routing);
  await f.health();
  assert.deepEqual((await f.post('/v1/network/quotes', body, key)).json(), q);
  await assert.rejects(
    pool.query("UPDATE network_plans SET snapshot='{}' WHERE id=$1", [q.plan_id]),
    /immutable/i,
  );
});
test('unavailable primary falls back before freezing; alternate route executes and captures once', async () => {
  const f = await fixture();
  await f.health();
  const q = await f.quote(),
    i = await f.intent(q);
  assert.equal(q.routing.selected_corridor_id, 'ng-ng-alternate');
  assert.equal(q.route[2].participant_id, 'nigeria-payout-alternate');
  await processIntent(i.id);
  await processIntent(i.id);
  const p = await f.plan(q.plan_id);
  assert.equal(p.capacity_state, 'consumed');
  assert.equal(p.legs.length, 3);
  assert.equal(p.legs[2].provider_binding, 'sim:nigeria-alternate:v1');
  assert.deepEqual(await ngn(f.merchant), { available: '9840000', reserved: '0' });
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int n FROM receipts WHERE instruction_id=(SELECT id FROM instructions WHERE intent_id=$1)',
        [i.id],
      )
    ).rows[0].n,
    1,
  );
});
test('no eligible provider returns a clear error without creating a plan or financial hold', async () => {
  const f = await fixture();
  await f.health();
  await f.health('nigeria-payout-alternate');
  assert.equal((await f.routes()).selected_corridor_id, null);
  const r = await f.post('/v1/network/quotes', { corridor_id: 'auto', amount_minor: '160000' });
  assert.equal(r.statusCode, 422, r.body);
  assert.equal(r.json().error.code, 'no_eligible_route');
  assert.equal(
    (
      await pool.query('SELECT count(*)::int n FROM network_plans WHERE merchant_id=$1', [
        f.merchant,
      ])
    ).rows[0].n,
    0,
  );
  assert.deepEqual(await ngn(f.merchant), { available: '10000000', reserved: '0' });
});
test('recent rejected receipts generate measured degradation and route selection avoids that participant', async () => {
  const f = await fixture(),
    q = await f.quote('insufficient_float', 'ng-ng-sandbox'),
    i = await f.intent(q);
  await processIntent(i.id);
  const routes = await f.routes(),
    primary = routes.candidates.find(
      (c: { corridor_id: string }) => c.corridor_id === 'ng-ng-sandbox',
    );
  const signal = primary.health.find(
    (h: { participant_id: string }) => h.participant_id === 'nigeria-payout-sandbox',
  );
  assert.equal(signal.source, 'receipt_measurement');
  assert.equal(signal.samples, 1);
  assert.equal(signal.rejected, 1);
  assert.equal(signal.failure_rate_ppm, 1000000);
  assert.equal(signal.status, 'degraded');
  assert.ok(signal.latency_ms >= 0);
  assert.equal(primary.eligible, false);
  assert.equal(routes.selected_corridor_id, 'ng-ng-alternate');
  assert.equal((await f.quote()).routing.selected_corridor_id, 'ng-ng-alternate');
});
test('low capacity selects the alternate, and capacity changes after quoting never rebind a plan', async () => {
  const f = await fixture(),
    q = await f.quote();
  const original = (
    await pool.query("SELECT capacity_minor FROM network_corridors WHERE id='ng-ng-sandbox'")
  ).rows[0].capacity_minor;
  await pool.query("UPDATE network_corridors SET capacity_minor=1 WHERE id='ng-ng-sandbox'");
  try {
    const routes = await f.routes();
    assert.equal(routes.selected_corridor_id, 'ng-ng-alternate');
    assert.equal(routes.candidates[0].reason, 'corridor_capacity');
    const r = await f.post('/v1/network/intents', {
      plan_id: q.plan_id,
      customer_id: f.customer.id,
      destination_instrument_id: f.instrument.id,
      reference: 'changed-capacity',
    });
    assert.equal(r.statusCode, 422, r.body);
    assert.equal(r.json().error.code, 'corridor_capacity');
    assert.deepEqual(await ngn(f.merchant), { available: '10000000', reserved: '0' });
    assert.equal((await f.plan(q.plan_id)).corridor_id, 'ng-ng-sandbox');
  } finally {
    await pool.query("UPDATE network_corridors SET capacity_minor=$1 WHERE id='ng-ng-sandbox'", [
      original,
    ]);
  }
});
test('health changes after quoting reject admission atomically instead of changing the frozen route', async () => {
  const f = await fixture(),
    q = await f.quote();
  await f.health();
  const r = await f.post('/v1/network/intents', {
    plan_id: q.plan_id,
    customer_id: f.customer.id,
    destination_instrument_id: f.instrument.id,
    reference: 'changed-health',
  });
  assert.equal(r.statusCode, 422, r.body);
  assert.equal(r.json().error.code, 'participant_health');
  assert.deepEqual(await ngn(f.merchant), { available: '10000000', reserved: '0' });
  const p = await f.plan(q.plan_id);
  assert.equal(p.capacity_state, null);
  assert.equal(p.snapshot.routing.selected_corridor_id, 'ng-ng-sandbox');
});
test('an accepted timeout never switches providers when health changes; explicit restoration recovers saved steps', async () => {
  const f = await fixture(),
    q = await f.quote('timeout'),
    i = await f.intent(q);
  await processIntent(i.id);
  const before = await f.plan(q.plan_id);
  await f.health();
  await processIntent(i.id);
  let p = await f.plan(q.plan_id);
  assert.equal(
    p.legs.filter((l: { outcome: string | null }) => l.outcome === 'confirmed').length,
    2,
  );
  assert.equal(p.legs[2].outcome, null);
  assert.equal(p.capacity_state, 'held');
  assert.equal((await f.routes()).selected_corridor_id, 'ng-ng-alternate');
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int n FROM network_legs WHERE plan_id=$1 AND participant_id=$2',
        [q.plan_id, 'nigeria-payout-alternate'],
      )
    ).rows[0].n,
    0,
  );
  assert.deepEqual(await ngn(f.merchant), { available: '9840000', reserved: '160000' });
  await f.health('nigeria-payout-sandbox', 'healthy');
  await processIntent(i.id);
  p = await f.plan(q.plan_id);
  assert.equal(p.capacity_state, 'consumed');
  assert.deepEqual(
    p.legs.slice(0, 2).map((l: { provider_reference: string }) => l.provider_reference),
    before.legs.map((l: { provider_reference: string }) => l.provider_reference),
  );
  assert.equal(p.legs[2].participant_id, 'nigeria-payout-sandbox');
});
test('known complete acceptance can settle after a provider-health hold', async () => {
  const f = await fixture(),
    q = await f.quote(),
    i = await f.intent(q);
  await processIntent(i.id, {
    connector: new CorridorSandboxConnector({
      checkpoint: async (position) => {
        if (position === 3) await f.health();
      },
    }),
  });
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state, 'succeeded');
  assert.equal((await f.plan(q.plan_id)).capacity_state, 'consumed');
});
test('expired overrides are unknown until refreshed, with no automatic return to healthy', async () => {
  const f = await fixture();
  await pool.query(
    `INSERT INTO network_health_overrides(id,merchant_id,participant_id,provider_binding,status,reason,actor_key_id,observed_at,expires_at)
    VALUES($1,$2,'nigeria-payout-sandbox','sim:nigeria-payout:v1','healthy','Expired fixture',$3,now()-interval '10 minutes',now()-interval '5 minutes')`,
    [id('hlt'), f.merchant, f.key.id],
  );
  let routes = await f.routes();
  assert.equal(routes.candidates[0].health[2].status, 'unknown');
  assert.equal(routes.selected_corridor_id, 'ng-ng-alternate');
  await f.health('nigeria-payout-sandbox', 'healthy');
  routes = await f.routes();
  assert.equal(routes.selected_corridor_id, 'ng-ng-sandbox');
});
test('merchant-scoped health never affects another merchant or accepts a foreign actor key', async () => {
  const a = await fixture(),
    b = await fixture();
  await a.health();
  assert.equal((await a.routes()).selected_corridor_id, 'ng-ng-alternate');
  assert.equal((await b.routes()).selected_corridor_id, 'ng-ng-sandbox');
  await assert.rejects(
    pool.query(
      `INSERT INTO network_health_overrides(id,merchant_id,participant_id,provider_binding,status,reason,actor_key_id,expires_at)
    VALUES($1,$2,'nigeria-payout-sandbox','sim:nigeria-payout:v1','unavailable','Foreign actor',$3,now()+interval '1 minute')`,
      [id('hlt'), a.merchant, b.key.id],
    ),
    /foreign key/i,
  );
});
test('health writes require operations scope, strict fields, and stable idempotency', async () => {
  const f = await fixture(),
    read = await issueApiKey(f.merchant, 'Read', ['payments:read']),
    ops = await issueApiKey(f.merchant, 'Ops', ['operations:write']);
  const body = {
      participant_id: 'nigeria-payout-sandbox',
      status: 'unavailable',
      reason: 'Scope fixture',
    },
    key = id('idem');
  assert.equal(
    (await f.get('/v1/network/routing?amount_minor=160000', read.secret)).statusCode,
    200,
  );
  assert.equal((await f.post('/v1/network/health', body, id('idem'), read.secret)).statusCode, 403);
  const first = await f.post('/v1/network/health', body, key, ops.secret);
  assert.equal(first.statusCode, 201, first.body);
  const replay = await f.post('/v1/network/health', body, key, ops.secret);
  assert.deepEqual(first.json(), replay.json());
  assert.equal(replay.headers['idempotency-replayed'], 'true');
  assert.equal(
    (await f.post('/v1/network/health', { ...body, status: 'healthy' }, key, ops.secret))
      .statusCode,
    409,
  );
  assert.equal(
    (await f.post('/v1/network/health', { ...body, merchant_id: 'injected' })).statusCode,
    400,
  );
  assert.equal(
    (await f.post('/v1/network/health', { ...body, valid_for_seconds: 301 })).statusCode,
    400,
  );
  assert.equal(
    (await f.post('/v1/network/health', { ...body, participant_id: 'missing' })).statusCode,
    404,
  );
  assert.equal((await f.get('/v1/network/routing?amount_minor=1.5')).statusCode, 400);
  await assert.rejects(
    pool.query("UPDATE network_health_overrides SET status='healthy' WHERE id=$1", [
      first.json().id,
    ]),
    /immutable/i,
  );
});
test('binding changes invalidate health and a frozen route without holding money', async () => {
  const f = await fixture();
  await f.health('nigeria-payout-sandbox', 'healthy');
  const q = await f.quote();
  await pool.query(
    "UPDATE network_participants SET provider_binding='sim:nigeria-payout:v2' WHERE id='nigeria-payout-sandbox'",
  );
  try {
    assert.equal((await f.routes()).candidates[0].health[2].status, 'unknown');
    const r = await f.post('/v1/network/intents', {
      plan_id: q.plan_id,
      customer_id: f.customer.id,
      destination_instrument_id: f.instrument.id,
      reference: 'binding-change',
    });
    assert.equal(r.statusCode, 422, r.body);
    assert.deepEqual(await ngn(f.merchant), { available: '10000000', reserved: '0' });
  } finally {
    await pool.query(
      "UPDATE network_participants SET provider_binding='sim:nigeria-payout:v1' WHERE id='nigeria-payout-sandbox'",
    );
  }
});
test('healthy candidates are ranked by measured acceptance latency', async () => {
  const f = await fixture(),
    primary = await f.quote('success', 'ng-ng-sandbox'),
    first = await f.intent(primary);
  await processIntent(first.id, {
    connector: new CorridorSandboxConnector({
      beforeAcceptance: async (position) => {
        if (position === 3) await new Promise((resolve) => setTimeout(resolve, 200));
      },
    }),
  });
  const alternate = await f.quote('success', 'ng-ng-alternate'),
    second = await f.intent(alternate);
  await processIntent(second.id);
  const routes = await f.routes();
  assert.ok(routes.candidates.every((c: { eligible: boolean }) => c.eligible));
  const a = routes.candidates[0].health[2],
    b = routes.candidates[1].health[2];
  assert.ok(a.latency_ms >= 200);
  assert.ok(a.latency_ms > b.latency_ms);
  assert.equal(routes.selected_corridor_id, 'ng-ng-alternate');
});
test('acknowledging an outage waits for an acceptance in flight and fences later sends', async () => {
  const f = await fixture(),
    q = await f.quote(),
    i = await f.intent(q);
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const execution = processIntent(i.id, {
    connector: new CorridorSandboxConnector({
      beforeAcceptance: async (position) => {
        if (position === 3) {
          enter();
          await gate;
        }
      },
    }),
  });
  await entered;
  let acknowledged = false;
  const held = f.health().then((result) => {
    acknowledged = true;
    return result;
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(acknowledged, false);
  } finally {
    release();
  }
  await held;
  await execution;
  assert.equal((await f.plan(q.plan_id)).capacity_state, 'consumed');
  assert.equal((await f.routes()).candidates[0].eligible, false);
  const r = await f.post('/v1/network/quotes', {
    corridor_id: 'ng-ng-sandbox',
    amount_minor: '160000',
  });
  assert.equal(r.statusCode, 422, r.body);
});
