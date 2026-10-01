import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { buildApi } from '../services/api/src/app.js';
import { pool, id } from '../packages/database/src/index.js';
import {
  createMerchant,
  sandboxFund,
  invariantReport,
  balances,
  reverseJournal,
} from '../packages/ledger/src/index.js';
import { issueApiKey } from '../packages/payments/src/auth.js';
import { processIntent } from '../packages/payments/src/index.js';
import { stellarAmount, units } from '../connectors/stellar/src/index.js';
import { accountChallenge } from '../packages/stellar/src/index.js';
import { stellarHarness } from './stellar-harness.js';
process.env.KORA_WEBHOOK_ENCRYPTION_KEY = randomBytes(32).toString('base64');
const clean: (() => Promise<unknown>)[] = [];
after(async () => {
  for (const close of clean.reverse()) await close();
  await pool.end();
});
async function fixture() {
  const h = stellarHarness(),
    m = id('test');
  await createMerchant(m, 'Testnet integration');
  await sandboxFund(m, 'NGN', '1000000', `fund:${m}`);
  const key = await issueApiKey(m, 'Test'),
    app = await buildApi({ serveWeb: false, rateLimitMax: 10000, stellarConnector: h.connector });
  clean.push(() => app.close());
  const headers = { authorization: `Bearer ${key.secret}` };
  const post = (url: string, payload: Record<string, unknown>, idem = id('idem')) =>
    app.inject({ method: 'POST', url, payload, headers: { ...headers, 'idempotency-key': idem } });
  const get = (url: string) => app.inject({ url, headers });
  const customer = (await post('/v1/customers', { name: 'Testnet customer' })).json();
  async function register(signature?: string) {
    const challenge = accountChallenge(m, customer.id, h.customer.publicKey(), h.connector);
    const r = await post(`/v1/customers/${customer.id}/stellar_accounts`, {
      address: h.customer.publicKey(),
      signature: signature ?? Buffer.from(h.customer.sign(challenge)).toString('hex'),
      label: 'Testnet wallet',
    });
    return r;
  }
  async function purchase() {
    const r = await register();
    assert.equal(r.statusCode, 201, r.body);
    const p = await post('/v1/stellar/purchases', {
      customer_id: customer.id,
      destination_instrument_id: r.json().instrument_id,
      amount_minor: '160000',
      reference: 'Testnet buy',
    });
    assert.equal(p.statusCode, 201, p.body);
    return p.json();
  }
  function incoming(
    source = h.customer,
    destination = h.treasury.publicKey(),
    issuer = h.issuer.publicKey(),
    amount = '1.0000000',
  ) {
    const tx = new TransactionBuilder(new Account(source.publicKey(), '500'), {
      fee: '1000',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.payment({ destination, asset: new Asset('KUSD', issuer), amount }))
      .setTimeout(300)
      .build();
    tx.sign(source);
    const hash = Buffer.from(tx.hash()).toString('hex');
    h.records.set(hash, {
      hash,
      successful: true,
      ledger: 1234,
      envelope_xdr: tx.toXDR(),
      fee_charged: '1000',
    });
    return hash;
  }
  return { h, m, app, headers, post, get, customer, register, purchase, incoming };
}
test('Stellar amount encoding preserves seven decimals and signed 64-bit limit', () => {
  assert.equal(stellarAmount('1'), '0.0000001');
  assert.equal(units(stellarAmount('9223372036854775807')), 9223372036854775807n);
  assert.throws(() => stellarAmount('9223372036854775808'));
  assert.throws(() => stellarAmount('0'));
  assert.throws(() => units('1.1'));
});
test('wallet ownership binds the merchant, customer, network and exact issuer', async () => {
  const f = await fixture();
  const c = (
    await f.get(
      `/v1/customers/${f.customer.id}/stellar_challenge?address=${f.h.customer.publicKey()}`,
    )
  ).json();
  assert.equal((await f.get(`/v1/customers/${f.customer.id}/stellar_challenge`)).statusCode, 400);
  assert.equal(
    c.challenge_hex,
    accountChallenge(f.m, f.customer.id, f.h.customer.publicKey(), f.h.connector).toString('hex'),
  );
  assert.equal(
    (
      await f.register(
        Buffer.from(Keypair.random().sign(Buffer.from(c.challenge_hex, 'hex'))).toString('hex'),
      )
    ).statusCode,
    422,
  );
  const r = await f.register();
  assert.equal(r.statusCode, 201, r.body);
  assert.equal(r.json().binding, undefined);
  assert.equal((await f.register()).json().instrument_id, r.json().instrument_id);
});
test('wrong network, issuer and unauthorized trustlines cannot register', async () => {
  for (const control of ['wrongNetwork', 'wrongIssuer', 'authorized'] as const) {
    const f = await fixture();
    f.h[control] = control === 'authorized' ? false : true;
    const r = await f.register();
    assert.notEqual(r.statusCode, 201);
    assert.equal(
      (await pool.query('SELECT 1 FROM stellar_accounts WHERE merchant_id=$1', [f.m])).rowCount,
      0,
    );
  }
});
test('wallet challenge and records are tenant isolated and scoped', async () => {
  const f = await fixture(),
    m = id('test');
  await createMerchant(m, 'Other');
  const k = await issueApiKey(m, 'Other');
  assert.equal(
    (
      await f.app.inject({
        url: `/v1/customers/${f.customer.id}/stellar_accounts`,
        headers: { authorization: `Bearer ${k.secret}` },
      })
    ).statusCode,
    404,
  );
  const read = await issueApiKey(f.m, 'Readonly', ['payments:read']);
  assert.equal(
    (
      await f.app.inject({
        method: 'POST',
        url: '/v1/stellar/redemptions',
        headers: { authorization: `Bearer ${read.secret}`, 'idempotency-key': id('idem') },
        payload: { amount_minor: '10000000' },
      })
    ).statusCode,
    403,
  );
});
test('Testnet purchase has one transaction, matched receipt and balanced capture', async () => {
  const f = await fixture(),
    p = await f.purchase();
  assert.equal(p.destination.amount_minor, '9950000');
  assert.equal(await processIntent(p.id, { connector: f.h.connector }), 'terminal');
  assert.equal(await processIntent(p.id, { connector: f.h.connector }), 'terminal');
  assert.equal(f.h.submissions, 1);
  const d = (await f.get(`/v1/operations/intents/${p.id}`)).json();
  assert.equal(d.intent.state, 'succeeded');
  assert.equal(d.receipts.length, 1);
  assert.equal(d.receipts[0].payload.stellar_data.issuer, f.h.issuer.publicKey());
  assert.equal(
    d.journals.some((j: { reference: string }) => j.reference === `destination:${p.id}`),
    true,
  );
  const st = (
    await pool.query('SELECT * FROM stellar_transactions WHERE instruction_id=$1', [
      d.instructions[0].id,
    ])
  ).rows[0];
  await assert.rejects(
    pool.query('UPDATE stellar_transactions SET signed_xdr=$2 WHERE instruction_id=$1', [
      st.instruction_id,
      'changed',
    ]),
    /immutable/,
  );
  assert.equal((await invariantReport()).balanced, true);
});
test('accepted transaction with lost response retains hold and recovers by hash without resending', async () => {
  const f = await fixture(),
    p = await f.purchase();
  f.h.dropAfterAccept = true;
  assert.equal(await processIntent(p.id, { connector: f.h.connector }), 'pending');
  assert.equal((await f.get(`/v1/intents/${p.id}`)).json().state, 'unknown');
  assert.equal(
    (await balances(f.m)).find((b) => b.asset === 'NGN' && b.purpose === 'reserved')?.minor,
    '160000',
  );
  f.h.statusUnavailable = false;
  assert.equal(await processIntent(p.id, { connector: f.h.connector }), 'terminal');
  assert.equal(f.h.submissions, 1);
});
test('receipt envelope mismatch cannot capture reserved funds', async () => {
  const f = await fixture(),
    p = await f.purchase();
  f.h.dropAfterAccept = true;
  await processIntent(p.id, { connector: f.h.connector });
  f.h.statusUnavailable = false;
  const [hash, record] = [...f.h.records][0];
  f.h.records.set(hash, { ...record, envelope_xdr: 'invalid' });
  assert.equal(await processIntent(p.id, { connector: f.h.connector }), 'pending');
  assert.equal((await f.get(`/v1/intents/${p.id}`)).json().state, 'unknown');
  assert.equal(f.h.submissions, 1);
});
test('failed on-chain transaction releases source hold exactly once', async () => {
  const f = await fixture(),
    p = await f.purchase();
  f.h.success = false;
  await processIntent(p.id, { connector: f.h.connector });
  assert.equal((await f.get(`/v1/intents/${p.id}`)).json().state, 'failed');
  assert.equal(
    (await balances(f.m)).find((b) => b.asset === 'NGN' && b.purpose === 'available')?.minor,
    '1000000',
  );
  assert.equal(f.h.submissions, 1);
});
test('one unknown treasury sequence blocks a different payout before signing', async () => {
  const f = await fixture(),
    a = await f.purchase(),
    b = await f.purchase();
  f.h.dropAfterAccept = true;
  await processIntent(a.id, { connector: f.h.connector });
  await processIntent(b.id, { connector: f.h.connector });
  assert.equal(f.h.submissions, 1);
  assert.equal(
    (
      await pool.query(
        'SELECT 1 FROM stellar_transactions st JOIN instructions i ON i.id=st.instruction_id WHERE i.intent_id=$1',
        [b.id],
      )
    ).rowCount,
    0,
  );
  f.h.statusUnavailable = false;
  await processIntent(a.id, { connector: f.h.connector });
  await processIntent(b.id, { connector: f.h.connector });
  assert.equal(f.h.submissions, 2);
  const rows = (
    await pool.query(
      'SELECT sequence::text FROM stellar_transactions WHERE source_address=$1 ORDER BY sequence',
      [f.h.treasury.publicKey()],
    )
  ).rows;
  assert.deepEqual(
    rows.map((r) => r.sequence),
    ['101', '102'],
  );
});
test('confirmed deposit credits once under duplicate and concurrent requests', async () => {
  const f = await fixture(),
    a = (await f.register()).json(),
    hash = f.incoming();
  const body = {
    customer_id: f.customer.id,
    instrument_id: a.instrument_id,
    transaction_hash: hash,
  };
  const [x, y] = await Promise.all([
    f.post('/v1/stellar/deposits', body),
    f.post('/v1/stellar/deposits', body),
  ]);
  assert.equal(x.statusCode, 201, x.body);
  assert.equal(y.statusCode, 201, y.body);
  assert.equal(x.json().id, y.json().id);
  assert.equal(
    (await balances(f.m)).find((b) => b.asset === 'KUSD' && b.purpose === 'available')?.minor,
    '10000000',
  );
  await assert.rejects(
    reverseJournal(x.json().journal_id, id('rev'), 'Not allowed'),
    /payment lifecycle/,
  );
});
test('deposits reject wrong source, issuer, destination and unsuccessful evidence', async () => {
  const f = await fixture(),
    a = (await f.register()).json();
  for (const hash of [
    f.incoming(Keypair.random()),
    f.incoming(f.h.customer, f.h.customer.publicKey()),
    f.incoming(f.h.customer, f.h.treasury.publicKey(), Keypair.random().publicKey()),
  ])
    assert.equal(
      (
        await f.post('/v1/stellar/deposits', {
          customer_id: f.customer.id,
          instrument_id: a.instrument_id,
          transaction_hash: hash,
        })
      ).statusCode,
      422,
    );
  const hash = f.incoming();
  f.h.records.get(hash)!.successful = false;
  assert.equal(
    (
      await f.post('/v1/stellar/deposits', {
        customer_id: f.customer.id,
        instrument_id: a.instrument_id,
        transaction_hash: hash,
      })
    ).statusCode,
    422,
  );
});
test('verified KUSD deposit redeems to fixture NGN with stable idempotency and no overdraft', async () => {
  const f = await fixture(),
    a = (await f.register()).json(),
    hash = f.incoming();
  await f.post('/v1/stellar/deposits', {
    customer_id: f.customer.id,
    instrument_id: a.instrument_id,
    transaction_hash: hash,
  });
  const key = id('idem'),
    body = { amount_minor: '10000000' };
  const r = await f.post('/v1/stellar/redemptions', body, key);
  assert.equal(r.statusCode, 201, r.body);
  assert.equal(r.json().destination_minor, '160000');
  assert.equal((await f.post('/v1/stellar/redemptions', body, key)).json().id, r.json().id);
  assert.notEqual((await f.post('/v1/stellar/redemptions', body)).statusCode, 201);
  assert.equal(
    (await balances(f.m)).find((b) => b.asset === 'NGN' && b.purpose === 'available')?.minor,
    '1160000',
  );
  assert.deepEqual(await invariantReport(), {
    balanced: true,
    nonnegative: true,
    no_empty_journals: true,
    violations: [],
  });
});
test('expired saved envelope is never replaced or resent', async (t) => {
  const f = await fixture(),
    p = await f.purchase();
  f.h.dropAfterAccept = true;
  await processIntent(p.id, { connector: f.h.connector });
  f.h.records.clear();
  f.h.statusUnavailable = false;
  const row = (
    await pool.query(
      'SELECT st.*,i.request FROM stellar_transactions st JOIN instructions i ON i.id=st.instruction_id WHERE i.intent_id=$1',
      [p.id],
    )
  ).rows[0];
  const original = row.transaction_hash;
  t.mock.method(Date, 'now', () => Number(row.expires_at) * 1000 + 1000);
  await assert.rejects(f.h.connector.payout(row.request), /Expired transaction/);
  t.mock.restoreAll();
  assert.equal(f.h.submissions, 1);
  assert.equal(
    (
      await pool.query(
        'SELECT transaction_hash FROM stellar_transactions WHERE instruction_id=$1',
        [row.instruction_id],
      )
    ).rows[0].transaction_hash,
    original,
  );
});
test('changed issuer binding cannot recover through another provider', async () => {
  const f = await fixture(),
    p = await f.purchase();
  f.h.dropAfterAccept = true;
  await processIntent(p.id, { connector: f.h.connector });
  const other = stellarHarness();
  assert.equal(await processIntent(p.id, { connector: other.connector }), 'pending');
  assert.equal(other.submissions, 0);
  assert.equal((await f.get(`/v1/intents/${p.id}`)).json().state, 'unknown');
});
test('capacity preflight and held customer reject purchase before reserving funds', async () => {
  const f = await fixture(),
    a = (await f.register()).json();
  f.h.capacity = '100.0000000';
  const body = {
    customer_id: f.customer.id,
    destination_instrument_id: a.instrument_id,
    amount_minor: '160000',
    reference: 'blocked',
  };
  assert.notEqual((await f.post('/v1/stellar/purchases', body)).statusCode, 201);
  assert.equal(
    (await balances(f.m)).find((b) => b.asset === 'NGN' && b.purpose === 'reserved')?.minor,
    '0',
  );
  f.h.capacity = '1000000.0000000';
  await pool.query("UPDATE customers SET verification_state='held' WHERE id=$1", [f.customer.id]);
  assert.equal((await f.post('/v1/stellar/purchases', body)).statusCode, 422);
});
test('treasury Testnet fees are journaled in XLM for both success and failure', async () => {
  for (const success of [true, false]) {
    const f = await fixture(),
      p = await f.purchase();
    f.h.success = success;
    await processIntent(p.id, { connector: f.h.connector });
    const r = (await f.get(`/v1/operations/intents/${p.id}`)).json();
    const fee = r.journals.find(
      (j: { reference: string }) => j.reference === `stellar-fee:${p.id}`,
    );
    assert.ok(fee);
    assert.equal(fee.entries.length, 2);
    assert.ok(
      fee.entries.every(
        (e: { asset: string; amount: string }) => e.asset === 'XLM' && e.amount === '1000',
      ),
    );
    assert.equal(r.stellar_transactions.length, 1);
    assert.equal(r.stellar_transactions[0].signed_xdr, undefined);
  }
});
test('worker termination after Testnet acceptance recovers the durable hash with one submission', async () => {
  const { createServer } = await import('node:http'),
    { spawn } = await import('node:child_process');
  const f = await fixture(),
    p = await f.purchase();
  const server = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      for await (const part of req) chunks.push(Buffer.from(part));
      const r = await f.h.connector.config.fetch!('https://horizon-testnet.stellar.org' + req.url, {
        method: req.method,
        body: req.method === 'POST' ? Buffer.concat(chunks).toString() : undefined,
      });
      res.writeHead(r.status, { 'content-type': 'application/json' }).end(await r.text());
    } catch {
      res.writeHead(503).end('{}');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address() as { port: number };
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'tests/stellar-process-worker.ts', p.id],
      {
        cwd: process.cwd(),
        stdio: 'ignore',
        env: {
          ...process.env,
          KORA_TEST_STELLAR_ORIGIN: `http://127.0.0.1:${address.port}`,
          KORA_TEST_STELLAR_SECRET: f.h.treasury.secret(),
          KORA_TEST_STELLAR_ISSUER: f.h.issuer.publicKey(),
        },
      },
    );
    const stopped = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('Worker crash checkpoint timed out'));
        }, 30000);
        child.once('exit', (code, signal) => {
          clearTimeout(timer);
          resolve({ code, signal });
        });
        child.once('error', reject);
      },
    );
    assert.equal(stopped.signal, 'SIGKILL');
    assert.equal(f.h.submissions, 1);
    assert.equal(await processIntent(p.id, { connector: f.h.connector }), 'terminal');
    assert.equal(f.h.submissions, 1);
    const detail = (await f.get(`/v1/operations/intents/${p.id}`)).json();
    assert.equal(detail.intent.state, 'succeeded');
    assert.equal(detail.receipts.length, 1);
    assert.equal(detail.stellar_transactions.length, 1);
    assert.equal(
      detail.journals.filter((j: { reference: string }) => j.reference.startsWith('capture:'))
        .length,
      1,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
