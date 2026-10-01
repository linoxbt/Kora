// Local browser fixture only. No production service imports this file.
import { mkdir, writeFile } from 'node:fs/promises';
import { controlFixture } from './control-fixture.js';
import { buildApi } from '../services/api/src/app.js';
import { pool } from '../packages/database/src/index.js';
const fixture = await controlFixture('Pilot controls browser fixture');
await mkdir('.sandbox', { recursive: true, mode: 0o700 });
await writeFile('.sandbox/controls-browser-credentials.json', JSON.stringify(fixture), {
  mode: 0o600,
});
const app = await buildApi();
await app.listen({ port: 4310, host: '127.0.0.1' });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
  await pool.end();
}
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
