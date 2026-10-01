import 'dotenv/config';
import { createServer } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { paystackHarness } from '../tests/paystack-harness.js';
import { buildApi } from '../services/api/src/app.js';
import { pool } from '../packages/database/src/index.js';
import { runOnce } from '../services/worker/src/worker.js';
import { runRailOnce } from '../packages/rails/src/index.js';
const started = new Date().toISOString(),
  h = await paystackHarness();
// This entry point is exclusively a browser test server. Production never
// imports the harness or exposes these test-only completion controls.
const app = await buildApi({ paystackClient: h.client });
const controls = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const part of req) chunks.push(part);
    const input = JSON.parse(Buffer.concat(chunks).toString());
    if (req.method !== 'POST') throw new Error();
    const event =
      req.url === '/complete'
        ? 'charge.success'
        : req.url === '/reverse'
          ? 'transfer.reversed'
          : null;
    if (!event) throw new Error();
    if (event === 'charge.success') {
      if (!h.charges.has(input.reference)) throw new Error();
      h.complete(input.reference);
    } else {
      if (!h.transfers.has(input.reference)) throw new Error();
      h.reverse(input.reference);
    }
    const raw = JSON.stringify({ event, data: { reference: input.reference, domain: 'test' } });
    const result = await app.inject({
      method: 'POST',
      url: '/internal/providers/paystack/webhook',
      headers: { 'content-type': 'application/json', 'x-paystack-signature': h.sign(raw) },
      payload: raw,
    });
    res.writeHead(result.statusCode, { 'content-type': 'application/json' }).end(result.body);
  } catch {
    res.writeHead(400).end('{}');
  }
});
await new Promise<void>((resolve) => controls.listen(4312, '127.0.0.1', resolve));
await app.listen({ host: '127.0.0.1', port: 4310 });
let running = true;
const close = () => {
  running = false;
};
process.on('SIGTERM', close);
process.on('SIGINT', close);
try {
  while (running) {
    const job = (
      await pool.query(
        "SELECT o.intent_id,i.provider FROM outbox o JOIN intents i ON i.id=o.intent_id WHERE o.kind='execute' AND o.processed_at IS NULL AND o.available_at<=now() AND i.created_at>=$1 ORDER BY o.available_at LIMIT 1",
        [started],
      )
    ).rows[0];
    if (job)
      await runOnce({
        onlyIntent: job.intent_id,
        ...(job.provider === 'paystack-test' ? { connector: h.connector } : {}),
      });
    const rail = (
      await pool.query(
        'SELECT o.resource_id FROM outbox o LEFT JOIN collections c ON c.id=o.resource_id LEFT JOIN provider_inbox p ON p.id=o.resource_id LEFT JOIN statement_runs s ON s.id=o.resource_id LEFT JOIN intents i ON i.id=o.resource_id WHERE o.processed_at IS NULL AND o.available_at<=now() AND COALESCE(c.created_at,p.created_at,s.created_at,i.created_at)>=$1 ORDER BY o.available_at LIMIT 1',
        [started],
      )
    ).rows[0];
    if (rail) await runRailOnce({ client: h.client, onlyResource: rail.resource_id });
    await setTimeout(150);
  }
} finally {
  await app.close();
  await new Promise<void>((resolve) => controls.close(() => resolve()));
  await h.close();
  await pool.end();
}
