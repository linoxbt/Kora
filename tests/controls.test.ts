import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { pool, id, transaction } from '../packages/database/src/index.js';
import { createMerchant, sandboxFund, balances } from '../packages/ledger/src/index.js';
import { issueApiKey, hashKey, allScopes, type Principal } from '../packages/payments/src/auth.js';
import { buildApi } from '../services/api/src/app.js';
import {
  gateKinds,
  recordUsage,
  pause,
  addEvidence,
  requestChange,
  reviewChange,
  dailyReport,
} from '../packages/controls/src/index.js';
import { processIntent } from '../packages/payments/src/index.js';
import { FakeConnector } from '../connectors/fake/src/index.js';
process.env.KORA_WEBHOOK_ENCRYPTION_KEY = randomBytes(32).toString('base64');
const apps: Awaited<ReturnType<typeof buildApi>>[] = [];
after(async () => {
  for (const app of apps) await app.close();
  await pool.end();
});
const policy = {
  caps: [{ asset: 'NGN' as const, per_transaction_minor: '200000', per_day_minor: '320000' }],
};
async function fixture() {
  const merchant = id('test');
  await createMerchant(merchant, 'Controls fixture');
  await sandboxFund(merchant, 'NGN', '10000000', id('fund'));
  const app = await buildApi({ serveWeb: false, rateLimitMax: 10000 });
  apps.push(app);
  const admin = await issueApiKey(merchant, 'Admin');
  async function enroll(operator = id('opr')) {
    await pool.query(
      'INSERT INTO control_operators(id,merchant_id,display_name,external_subject) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',
      [operator, merchant, 'Operator', id('subject')],
    );
    const secret = `kora_test_${randomBytes(32).toString('hex')}`,
      key_id = id('key');
    await pool.query(
      'INSERT INTO api_keys(id,merchant_id,name,prefix,hash,scopes,operator_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        key_id,
        merchant,
        'Operator',
        secret.slice(0, 18),
        hashKey(secret),
        [...allScopes],
        operator,
      ],
    );
    return {
      secret,
      principal: {
        merchant_id: merchant,
        key_id,
        scopes: [...allScopes],
        operator_id: operator,
      } as Principal,
    };
  }
  const a = await enroll(),
    b = await enroll();
  const post = (path: string, payload: unknown, key = admin.secret, idem = id('idem')) =>
    app.inject({
      method: 'POST',
      url: path,
      headers: { authorization: `Bearer ${key}`, 'idempotency-key': idem },
      payload: payload as Record<string, unknown>,
    });
  const get = (path: string, key = admin.secret) =>
    app.inject({ url: path, headers: { authorization: `Bearer ${key}` } });
  const customer = (await post('/v1/customers', { name: 'Reviewed customer' })).json();
  const instrument = (
    await post(`/v1/customers/${customer.id}/instruments`, {
      type: 'stellar_account',
      asset: 'USDC',
      label: 'Fixture',
      sandbox_identifier: 'sandbox:controls',
    })
  ).json();
  const evidence = (kind: string, customer_id?: string) => ({
    kind,
    outcome: 'checked',
    reference: 'fixture-review',
    reason: 'Local staging review fixture',
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    ...(customer_id ? { customer_id } : {}),
  });
  async function ready() {
    for (const kind of gateKinds)
      assert.equal((await post('/v1/controls/evidence', evidence(kind), a.secret)).statusCode, 201);
    for (const kind of ['kyc', 'screening'])
      await post('/v1/controls/evidence', evidence(kind, customer.id), a.secret);
    const report = await post('/v1/controls/reports', {
      day: new Date().toISOString().slice(0, 10),
    });
    assert.equal(report.statusCode, 201, report.body);
    assert.equal(report.json().control_clean, true, report.body);
  }
  async function active() {
    await ready();
    const r = await post(
      '/v1/controls/approvals',
      { action: 'start_staging', policy, reason: 'Start capped rehearsal' },
      a.secret,
    );
    assert.equal(r.statusCode, 201, r.body);
    const approved = await post(
      `/v1/controls/approvals/${r.json().id}/review`,
      { decision: 'approve', reason: 'Independent staging review' },
      b.secret,
    );
    assert.equal(approved.statusCode, 200, approved.body);
  }
  async function intent() {
    const q = (
      await post('/v1/quotes', {
        source_asset: 'NGN',
        destination_asset: 'USDC',
        amount_minor: '160000',
      })
    ).json();
    return post('/v1/intents', {
      quote_id: q.id,
      customer_id: customer.id,
      destination_instrument_id: instrument.id,
      reference: id('order'),
    });
  }
  return {
    merchant,
    app,
    admin,
    a,
    b,
    enroll,
    post,
    get,
    customer,
    evidence,
    ready,
    active,
    intent,
  };
}
test('sandbox cannot declare live readiness and ordinary merchant keys cannot enroll reviews', async () => {
  const f = await fixture(),
    r = (await f.get('/v1/controls')).json();
  assert.equal(r.live_ready, false);
  assert.equal(r.staging_ready, false);
  assert.equal(r.provider_cash_complete, false);
  assert.equal(r.gates.length, 7);
  assert.equal((await f.post('/v1/controls/evidence', f.evidence('legal'))).statusCode, 403);
});
test('approval requires another operator identity, including when the requester has two keys', async () => {
  const f = await fixture();
  await f.ready();
  const r = (
    await f.post(
      '/v1/controls/approvals',
      { action: 'start_staging', policy, reason: 'Test' },
      f.a.secret,
    )
  ).json();
  const second = await f.enroll(f.a.principal.operator_id!);
  for (const key of [f.a.secret, second.secret])
    assert.equal(
      (
        await f.post(
          `/v1/controls/approvals/${r.id}/review`,
          { decision: 'approve', reason: 'Self' },
          key,
        )
      ).statusCode,
      403,
    );
  assert.equal(
    (
      await f.post(
        `/v1/controls/approvals/${r.id}/review`,
        { decision: 'approve', reason: 'Independent' },
        f.b.secret,
      )
    ).statusCode,
    200,
  );
  assert.equal((await f.get('/v1/controls')).json().state, 'staging_active');
});
test('evidence and clean controls are required; current unresolved work invalidates a previously clean report', async () => {
  const f = await fixture();
  const r = (
    await f.post(
      '/v1/controls/approvals',
      { action: 'start_staging', policy, reason: 'Test' },
      f.a.secret,
    )
  ).json();
  assert.equal(
    (
      await f.post(
        `/v1/controls/approvals/${r.id}/review`,
        { decision: 'approve', reason: 'Review' },
        f.b.secret,
      )
    ).statusCode,
    422,
  );
  await f.ready();
  const i = await f.intent();
  assert.equal(i.statusCode, 201);
  assert.equal((await f.get('/v1/controls')).json().staging_ready, false);
  assert.equal(
    (
      await f.post(
        `/v1/controls/approvals/${r.id}/review`,
        { decision: 'approve', reason: 'Review' },
        f.b.secret,
      )
    ).statusCode,
    422,
  );
});
test('immutable audit, evidence, policy requests and operator bindings reject modification', async () => {
  const f = await fixture();
  await f.active();
  for (const table of [
    'control_evidence',
    'control_audit',
    'control_requests',
    'daily_control_reports',
  ])
    await assert.rejects(
      pool.query(`UPDATE ${table} SET id=id WHERE merchant_id=$1`, [f.merchant]),
    );
  await assert.rejects(
    pool.query('UPDATE api_keys SET operator_id=$2 WHERE id=$1', [
      f.a.principal.key_id,
      f.b.principal.operator_id,
    ]),
  );
});
test('parallel attempted gross debits consume one daily budget without overspending', async () => {
  const f = await fixture();
  await f.active();
  const results = await Promise.all([f.intent(), f.intent(), f.intent()]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 201, 422]);
  const usage = (
    await pool.query(
      'SELECT sum(amount_minor)::text used,count(*)::int n FROM pilot_usage WHERE merchant_id=$1',
      [f.merchant],
    )
  ).rows[0];
  assert.equal(usage.used, '320000');
  assert.equal(usage.n, 2);
  await assert.rejects(
    transaction((c) => recordUsage(c, f.merchant, 'KES', '1', id('resource'))),
    /Asset/,
  );
});
test('transaction cap and missing customer review fail atomically without reserving funds', async () => {
  const f = await fixture();
  await f.active();
  const before = await balances(f.merchant);
  await assert.rejects(
    transaction((c) => recordUsage(c, f.merchant, 'NGN', '200001', id('resource'), f.customer.id)),
    /cap/,
  );
  await f.post(
    '/v1/controls/evidence',
    { ...f.evidence('screening', f.customer.id), outcome: 'rejected' },
    f.a.secret,
  );
  assert.equal((await f.intent()).statusCode, 422);
  assert.deepEqual(await balances(f.merchant), before);
  assert.equal(
    (await pool.query('SELECT count(*)::int n FROM pilot_usage WHERE merchant_id=$1', [f.merchant]))
      .rows[0].n,
    0,
  );
});
test('emergency pause rejects new money but status recovery settles an accepted movement once', async () => {
  const f = await fixture(),
    i = (await f.intent()).json();
  await processIntent(i.id, {
    checkpoint: async (point) => {
      if (point === 'provider_accepted') throw new Error('Simulated lost worker');
    },
  }).catch(() => {});
  assert.equal(
    (await f.post('/v1/controls/pause', { reason: 'Incident investigation' })).statusCode,
    200,
  );
  assert.equal((await f.intent()).statusCode, 423);
  await processIntent(i.id);
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state, 'succeeded');
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int n FROM receipts r JOIN instructions ins ON ins.id=r.instruction_id WHERE ins.intent_id=$1',
        [i.id],
      )
    ).rows[0].n,
    1,
  );
});
test('pause prevents provider dispatch of prepared work', async () => {
  const f = await fixture(),
    i = (await f.intent()).json();
  await f.post('/v1/controls/pause', { reason: 'Stop dispatch' });
  await processIntent(i.id);
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int n FROM fake_provider_movements WHERE instruction_id IN(SELECT id FROM instructions WHERE intent_id=$1)',
        [i.id],
      )
    ).rows[0].n,
    0,
  );
});
test('pause acknowledgement waits for an in-flight dispatch lock', async () => {
  const f = await fixture(),
    c = await pool.connect();
  await c.query('SELECT pg_advisory_lock_shared(hashtextextended($1,0))', [
    `dispatch:${f.merchant}`,
  ]);
  let acknowledged = false;
  const pending = transaction((tx) =>
    pause(
      tx,
      { merchant_id: f.merchant, key_id: f.admin.id, scopes: [...allScopes] },
      'Wait for dispatch',
    ),
  ).then(() => {
    acknowledged = true;
  });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(acknowledged, false);
  await c.query('SELECT pg_advisory_unlock_shared(hashtextextended($1,0))', [
    `dispatch:${f.merchant}`,
  ]);
  c.release();
  await pending;
  assert.equal(acknowledged, true);
});
test('policy revisions fence stale approvals and pause requires fresh dual approval to resume', async () => {
  const f = await fixture();
  await f.ready();
  const request = () =>
    f.post(
      '/v1/controls/approvals',
      { action: 'start_staging', policy, reason: 'Test' },
      f.a.secret,
    );
  const [a, b] = await Promise.all([request(), request()]);
  assert.equal(
    (
      await f.post(
        `/v1/controls/approvals/${a.json().id}/review`,
        { decision: 'approve', reason: 'Review' },
        f.b.secret,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await f.post(
        `/v1/controls/approvals/${b.json().id}/review`,
        { decision: 'approve', reason: 'Review' },
        f.b.secret,
      )
    ).statusCode,
    409,
  );
  await f.post('/v1/controls/pause', { reason: 'Incident' });
  const resume = (
    await f.post(
      '/v1/controls/approvals',
      { action: 'resume', policy, reason: 'Resolved' },
      f.a.secret,
    )
  ).json();
  assert.equal(
    (
      await f.post(
        `/v1/controls/approvals/${resume.id}/review`,
        { decision: 'approve', reason: 'Resume' },
        f.b.secret,
      )
    ).statusCode,
    200,
  );
});
test('tenant ownership, operator deactivation and strict input protect review boundaries', async () => {
  const a = await fixture(),
    b = await fixture();
  const r = (
    await a.post(
      '/v1/controls/approvals',
      { action: 'start_staging', policy, reason: 'Test' },
      a.a.secret,
    )
  ).json();
  assert.equal(
    (
      await b.post(
        `/v1/controls/approvals/${r.id}/review`,
        { decision: 'reject', reason: 'Foreign' },
        b.b.secret,
      )
    ).statusCode,
    404,
  );
  assert.equal((await b.get('/v1/controls/approvals')).json().data.length, 0);
  assert.equal(
    (
      await a.post(
        '/v1/controls/evidence',
        { ...a.evidence('kyc'), customer_id: b.customer.id },
        a.a.secret,
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (await a.post('/v1/controls/pause', { reason: 'Test', operator_id: a.a.principal.operator_id }))
      .statusCode,
    400,
  );
  await pool.query('UPDATE control_operators SET active=false WHERE id=$1', [
    a.a.principal.operator_id,
  ]);
  assert.equal(
    (await a.post('/v1/controls/evidence', a.evidence('kyb'), a.a.secret)).statusCode,
    403,
  );
});
test('daily control snapshots flag incomplete operations and reject future or invalid dates', async () => {
  const f = await fixture();
  await f.intent();
  const r = await f.post('/v1/controls/reports', { day: new Date().toISOString().slice(0, 10) });
  assert.equal(r.statusCode, 201, r.body);
  assert.equal(r.json().day, new Date().toISOString().slice(0, 10));
  assert.equal(r.json().control_clean, false);
  assert.equal(r.json().data.open_intents, 1);
  assert.equal(r.json().provider_cash_complete, false);
  assert.equal(r.json().data.period_complete, false);
  for (const day of ['2026-02-30', '2999-01-01'])
    assert.equal((await f.post('/v1/controls/reports', { day })).statusCode, 422);
});
