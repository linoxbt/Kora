// Local browser fixtures only; production never imports these controls.
import { createServer } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { stellarHarness } from '../tests/stellar-harness.js';
import { buildApi } from '../services/api/src/app.js';
import { pool } from '../packages/database/src/index.js';
import { runOnce } from '../services/worker/src/worker.js';
const h = stellarHarness(),
  started = new Date().toISOString(),
  wallets = new Map<string, Keypair>();
const app = await buildApi({ stellarConnector: h.connector });
const controls = createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    for await (const p of req) chunks.push(Buffer.from(p));
    const input = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    let output: unknown;
    if (req.method !== 'POST') throw new Error();
    if (req.url === '/wallet') {
      const key = Keypair.random();
      wallets.set(key.publicKey(), key);
      output = { address: key.publicKey() };
    } else if (req.url === '/sign') {
      const key = wallets.get(input.address);
      if (!key) throw new Error();
      output = {
        signature: Buffer.from(key.sign(Buffer.from(input.challenge, 'hex'))).toString('hex'),
      };
    } else if (req.url === '/deposit') {
      const key = wallets.get(input.address);
      if (!key) throw new Error();
      const tx = new TransactionBuilder(new Account(key.publicKey(), '1000'), {
        fee: '1000',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: h.treasury.publicKey(),
            asset: new Asset('KUSD', h.issuer.publicKey()),
            amount: '1.0000000',
          }),
        )
        .setTimeout(300)
        .build();
      tx.sign(key);
      const hash = Buffer.from(tx.hash()).toString('hex');
      h.records.set(hash, {
        hash,
        successful: true,
        ledger: 1234,
        envelope_xdr: tx.toXDR(),
        fee_charged: '1000',
      });
      output = { hash };
    } else throw new Error();
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(output));
  } catch {
    res.writeHead(400).end('{}');
  }
});
await new Promise<void>((resolve) => controls.listen(4312, '127.0.0.1', resolve));
await app.listen({ host: '127.0.0.1', port: 4310 });
let running = true;
process.on('SIGTERM', () => {
  running = false;
});
process.on('SIGINT', () => {
  running = false;
});
try {
  while (running) {
    const job = (
      await pool.query(
        "SELECT o.intent_id FROM outbox o JOIN intents i ON i.id=o.intent_id WHERE o.kind='execute' AND o.processed_at IS NULL AND o.available_at<=now() AND i.created_at>=$1 ORDER BY o.available_at LIMIT 1",
        [started],
      )
    ).rows[0];
    if (job)
      await runOnce({
        onlyIntent: job.intent_id,
        connector:
          job.intent_id &&
          (await pool.query('SELECT provider FROM intents WHERE id=$1', [job.intent_id])).rows[0]
            .provider === 'stellar-testnet'
            ? h.connector
            : undefined,
      });
    await setTimeout(150);
  }
} finally {
  await app.close();
  await new Promise<void>((resolve) => controls.close(() => resolve()));
  await pool.end();
}
