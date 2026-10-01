// Test-only child process. No production entry point imports this transport.
import {
  LocalTestnetSigner,
  StellarTestnetConnector,
  HORIZON,
} from '../connectors/stellar/src/index.js';
import { processIntent } from '../packages/payments/src/index.js';
import { pool } from '../packages/database/src/index.js';
const origin = process.env.KORA_TEST_STELLAR_ORIGIN ?? '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Invalid harness origin');
const signer = new LocalTestnetSigner(
  process.env.KORA_TEST_STELLAR_SECRET ?? '',
  process.env.KORA_TEST_STELLAR_ISSUER ?? '',
);
const connector = new StellarTestnetConnector({
  issuer: process.env.KORA_TEST_STELLAR_ISSUER ?? '',
  treasury: signer.publicKey,
  signer,
  fetch: (input, init) => {
    const url = String(input);
    if (!url.startsWith(HORIZON + '/')) throw new Error('Wrong provider');
    return fetch(origin + url.slice(HORIZON.length), init);
  },
});
await processIntent(process.argv[2], {
  connector,
  checkpoint: async (point) => {
    if (point === 'provider_accepted') process.kill(process.pid, 'SIGKILL');
  },
});
await pool.end();
