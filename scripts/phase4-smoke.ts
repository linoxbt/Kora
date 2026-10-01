import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { buildApi } from '../services/api/src/app.js';
import { id, pool } from '../packages/database/src/index.js';
import { createMerchant, sandboxFund, invariantReport } from '../packages/ledger/src/index.js';
import { issueApiKey } from '../packages/payments/src/auth.js';
import { processIntent } from '../packages/payments/src/index.js';
import { StellarTestnetConnector } from '../connectors/stellar/src/index.js';
import { accountChallenge } from '../packages/stellar/src/index.js';
const connector = StellarTestnetConnector.fromEnvironment();
const keys = JSON.parse(
  await readFile(new URL('../.sandbox/stellar-testnet.json', import.meta.url), 'utf8'),
) as { customer: string };
const customerKey = Keypair.fromSecret(keys.customer),
  merchant = id('smoke');
await createMerchant(merchant, 'Stellar Testnet staging');
await sandboxFund(merchant, 'NGN', '1000000', `phase4:${merchant}`);
const key = await issueApiKey(merchant, 'Testnet smoke'),
  app = await buildApi({ serveWeb: false });
const post = async (url: string, payload: unknown, idem = id('idem')) => {
  const r = await app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${key.secret}`, 'idempotency-key': idem },
    payload: payload as Record<string, unknown>,
  });
  assert.equal(r.statusCode, 201, r.body);
  return r.json();
};
try {
  // The isolated setup wallet is claimed by this smoke merchant once; use a fresh
  // customer wallet for subsequent runs to retain immutable historical attribution.
  const server = new Horizon.Server('https://horizon-testnet.stellar.org');
  let wallet = customerKey;
  if (
    (
      await pool.query('SELECT 1 FROM stellar_accounts WHERE address=$1 AND binding=$2', [
        wallet.publicKey(),
        connector.binding,
      ])
    ).rowCount
  ) {
    wallet = Keypair.random();
    await mkdir(new URL('../.sandbox/wallets/', import.meta.url), { recursive: true });
    await writeFile(
      new URL(`../.sandbox/wallets/${merchant}.json`, import.meta.url),
      JSON.stringify({ network: 'testnet', address: wallet.publicKey(), secret: wallet.secret() }),
      { mode: 0o600 },
    );
    const funded = await fetch(`https://friendbot.stellar.org?addr=${wallet.publicKey()}`, {
      signal: AbortSignal.timeout(30000),
      redirect: 'error',
    });
    if (!funded.ok) throw new Error('Friendbot failed');
    const source = await server.loadAccount(wallet.publicKey());
    const trust = new TransactionBuilder(source, {
      fee: '1000',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.changeTrust({
          asset: new Asset('KUSD', connector.config.issuer),
          limit: '1000000',
        }),
      )
      .setTimeout(300)
      .build();
    trust.sign(wallet);
    await server.submitTransaction(trust);
  }
  const customer = await post('/v1/customers', { name: 'Testnet smoke wallet' });
  const account = await post(`/v1/customers/${customer.id}/stellar_accounts`, {
    address: wallet.publicKey(),
    signature: Buffer.from(
      wallet.sign(accountChallenge(merchant, customer.id, wallet.publicKey(), connector)),
    ).toString('hex'),
    label: 'Testnet staging wallet',
  });
  const intent = await post('/v1/stellar/purchases', {
    customer_id: customer.id,
    destination_instrument_id: account.instrument_id,
    amount_minor: '160000',
    reference: 'Phase 4 Testnet staging',
  });
  await processIntent(intent.id);
  const state = (await pool.query('SELECT state FROM intents WHERE id=$1', [intent.id])).rows[0];
  assert.equal(
    state.state,
    'succeeded',
    'Purchase must have matched authoritative Horizon evidence',
  );
  const purchase = (
    await pool.query(
      'SELECT st.transaction_hash FROM stellar_transactions st JOIN instructions i ON i.id=st.instruction_id WHERE i.intent_id=$1',
      [intent.id],
    )
  ).rows[0];
  await processIntent(intent.id);
  const source = await server.loadAccount(wallet.publicKey());
  const tx = new TransactionBuilder(source, { fee: '1000', networkPassphrase: Networks.TESTNET })
    .addOperation(
      Operation.payment({
        destination: connector.config.treasury,
        asset: new Asset('KUSD', connector.config.issuer),
        amount: '0.9950000',
      }),
    )
    .setTimeout(300)
    .build();
  tx.sign(wallet);
  await server.submitTransaction(tx);
  const hash = Buffer.from(tx.hash()).toString('hex'),
    payload = {
      customer_id: customer.id,
      instrument_id: account.instrument_id,
      transaction_hash: hash,
    };
  const d = await post('/v1/stellar/deposits', payload),
    duplicate = await post('/v1/stellar/deposits', payload);
  assert.equal(d.id, duplicate.id);
  const redeemKey = id('idem'),
    redemption = await post('/v1/stellar/redemptions', { amount_minor: '9950000' }, redeemKey),
    replay = await post('/v1/stellar/redemptions', { amount_minor: '9950000' }, redeemKey);
  assert.equal(redemption.id, replay.id);
  assert.equal(redemption.destination_minor, '159200');
  const invariants = await invariantReport();
  assert.deepEqual(invariants, {
    balanced: true,
    nonnegative: true,
    no_empty_journals: true,
    violations: [],
  });
  await mkdir(new URL('../.sandbox/wallets/', import.meta.url), { recursive: true });
  await writeFile(
    new URL(`../.sandbox/wallets/${merchant}.json`, import.meta.url),
    JSON.stringify({ network: 'testnet', address: wallet.publicKey(), secret: wallet.secret() }),
    { mode: 0o600 },
  );
  await writeFile(
    new URL('../.sandbox/phase4-credentials.json', import.meta.url),
    JSON.stringify(
      {
        merchant_id: merchant,
        api_key: key.secret,
        customer_id: customer.id,
        customer_address: wallet.publicKey(),
        instrument_id: account.instrument_id,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  const evidence = {
    network: 'testnet',
    asset: 'KUSD',
    issuer: connector.config.issuer,
    treasury: connector.config.treasury,
    merchant_id: merchant,
    customer_address: wallet.publicKey(),
    purchase_intent: intent.id,
    purchase_hash: purchase.transaction_hash,
    deposit_hash: hash,
    deposit_id: d.id,
    redemption_id: redemption.id,
    one_deposit_credit: true,
    idempotent_redemption: true,
    ledger: invariants,
    fx: 'fixture_1600_ngn_per_kusd',
    paystack_payout: 'not_performed_no_test_key',
    partner_fx: false,
    operator_credentials: '.sandbox/phase4-credentials.json (private)',
    validated_at: new Date().toISOString(),
  };
  await mkdir(new URL('../.sandbox/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('../.sandbox/phase4-evidence.json', import.meta.url),
    JSON.stringify(evidence, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await app.close();
  await pool.end();
}
