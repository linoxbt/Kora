import { PaystackClient, PaystackTestConnector } from '../connectors/paystack/src/index.js';
import { runOnce } from '../services/worker/src/worker.js';
import { runRailOnce } from '../packages/rails/src/index.js';
import { pool } from '../packages/database/src/index.js';
const [mode, resource, origin] = process.argv.slice(2);
if (
  !['intent', 'rail'].includes(mode) ||
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
  !/^[a-z]+_[a-f0-9]{32}$/.test(resource)
)
  throw new Error('Invalid test worker arguments');
const client = new PaystackClient({
  secretKey: process.env.KORA_TEST_PAYSTACK_KEY ?? '',
  fetch: ((input, init) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://api.paystack.co') throw new Error('Invalid provider origin');
    return fetch(`${origin}${url.pathname}${url.search}`, init);
  }) as typeof fetch,
});
try {
  if (mode === 'rail') await runRailOnce({ client, onlyResource: resource });
  else
    await runOnce({
      onlyIntent: resource,
      leaseMs: 1000,
      connector: new PaystackTestConnector(client),
      checkpoint: async (point) => {
        if (point === process.env.KORA_TEST_CRASH_CHECKPOINT) process.kill(process.pid, 'SIGKILL');
      },
    });
} finally {
  await pool.end();
}
