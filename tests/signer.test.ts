import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { RemoteTestnetSigner, StellarTestnetConnector } from '../connectors/stellar/src/index.js';
function fixture() {
  const key = Keypair.random(),
    issuer = Keypair.random(),
    dest = Keypair.random();
  const make = (amount = '1.0000000') =>
    new TransactionBuilder(new Account(key.publicKey(), '100'), {
      fee: '1000',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: dest.publicKey(),
          asset: new Asset('KUSD', issuer.publicKey()),
          amount,
        }),
      )
      .setTimeout(300)
      .build();
  return { key, issuer, make };
}
test('remote custody bridge requests exactly the approved Testnet transaction and validates signature', async () => {
  const f = fixture(),
    tx = f.make();
  let calls = 0;
  const signer = new RemoteTestnetSigner({
    endpoint: 'https://custody.example/sign',
    token: 'fixture-only',
    publicKey: f.key.publicKey(),
    issuer: f.issuer.publicKey(),
    fetch: async (input, init) => {
      calls++;
      assert.equal(String(input), 'https://custody.example/sign');
      assert.equal(init?.redirect, 'error');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.network, 'testnet');
      assert.equal(body.transaction_hash, Buffer.from(tx.hash()).toString('hex'));
      assert.equal(
        (init?.headers as Record<string, string>)['idempotency-key'],
        body.transaction_hash,
      );
      const signed = TransactionBuilder.fromXDR(body.unsigned_xdr, Networks.TESTNET) as Transaction;
      signed.sign(f.key);
      return Response.json({ transaction_hash: body.transaction_hash, signed_xdr: signed.toXDR() });
    },
  });
  const signed = await signer.sign(tx);
  assert.equal(calls, 1);
  assert.equal(f.key.verify(signed.hash(), signed.signatures[0].signature), true);
});
test('remote signer refuses wrong asset before IO and never accepts changed or unsigned envelopes', async () => {
  const f = fixture();
  for (const mode of ['changed', 'unsigned', 'other-signer']) {
    const original = f.make();
    const signer = new RemoteTestnetSigner({
      endpoint: 'https://custody.example/sign',
      token: 'fixture',
      publicKey: f.key.publicKey(),
      issuer: f.issuer.publicKey(),
      fetch: async () => {
        const tx =
          mode === 'changed'
            ? f.make('2.0000000')
            : (TransactionBuilder.fromXDR(original.toXDR(), Networks.TESTNET) as Transaction);
        if (mode !== 'unsigned') tx.sign(mode === 'other-signer' ? Keypair.random() : f.key);
        return Response.json({
          transaction_hash: Buffer.from(original.hash()).toString('hex'),
          signed_xdr: tx.toXDR(),
        });
      },
    });
    await assert.rejects(signer.sign(original), /does not match/);
  }
  let sent = false;
  const signer = new RemoteTestnetSigner({
    endpoint: 'https://custody.example/sign',
    token: 'fixture',
    publicKey: f.key.publicKey(),
    issuer: Keypair.random().publicKey(),
    fetch: async () => {
      sent = true;
      throw new Error();
    },
  });
  await assert.rejects(signer.sign(f.make()), /policy/);
  assert.equal(sent, false);
});
test('remote custody failures are closed and response size is bounded without content-length', async () => {
  const f = fixture();
  for (const fetcher of [
    async () => {
      throw new Error('Secret provider diagnostics');
    },
    async () => new Response('refused', { status: 403 }),
    async () => new Response('x'.repeat(65537)),
  ]) {
    const signer = new RemoteTestnetSigner({
      endpoint: 'https://custody.example/sign',
      token: 'fixture',
      publicKey: f.key.publicKey(),
      issuer: f.issuer.publicKey(),
      fetch: fetcher,
    });
    await assert.rejects(signer.sign(f.make()));
  }
  assert.throws(
    () =>
      new RemoteTestnetSigner({
        endpoint: 'http://custody.example/sign',
        token: 'fixture',
        publicKey: f.key.publicKey(),
        issuer: f.issuer.publicKey(),
      }),
  );
});
test('remote environment selection never substitutes a configured local treasury secret', () => {
  const saved = { ...process.env };
  try {
    process.env.STELLAR_SIGNER_MODE = 'remote';
    process.env.STELLAR_SIGNER_URL = '';
    process.env.STELLAR_TESTNET_ISSUER = Keypair.random().publicKey();
    process.env.STELLAR_TESTNET_TREASURY_SECRET = Keypair.random().secret();
    assert.equal(StellarTestnetConnector.configured(), false);
    assert.throws(() => StellarTestnetConnector.fromEnvironment());
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  }
});
