import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApi } from '../services/api/src/app.js';
import { id, pool } from '../packages/database/src/index.js';
import { invariantReport } from '../packages/ledger/src/index.js';

const origin = 'http://127.0.0.1:4310';
const codes = new Map<string,string>();
const app = await buildApi({ serveWeb: false, rateLimitMax: 10000, personal: {
  codeSecret: 'personal-test-only-secret',
  sendCode: async (email, code) => { codes.set(email, code); },
} });
after(async () => { await app.close(); await pool.end(); });
const cookie = (r: { headers: Record<string,unknown> }) => String(r.headers['set-cookie']).split(';')[0];
async function login(email: string) {
  const start = await app.inject({ method: 'POST', url: '/personal/api/auth/start', headers: { origin }, payload: { email } });
  assert.equal(start.statusCode, 200, start.body);
  const verify = await app.inject({ method: 'POST', url: '/personal/api/auth/verify', headers: { origin }, payload: { challenge_id: start.json().challenge_id, code: codes.get(email) } });
  assert.equal(verify.statusCode, 200, verify.body);
  return { cookie: cookie(verify), csrf: verify.json().csrf_token, challenge: start.json().challenge_id, code: codes.get(email) };
}
const write = (auth: { cookie: string; csrf: string }, url: string, payload: object, key?: string) => app.inject({
  method: 'POST', url, headers: { origin, cookie: auth.cookie, 'x-kora-csrf': auth.csrf, ...(key ? { 'idempotency-key': key } : {}) }, payload,
});

test('Personal email OTP is single use, creates a distinct account, and requires sandbox approval', async () => {
  const email = `${id('personal')}@example.test`;
  const auth = await login(email);
  const replay = await app.inject({ method: 'POST', url: '/personal/api/auth/verify', headers: { origin }, payload: { challenge_id: auth.challenge, code: auth.code } });
  assert.equal(replay.statusCode, 401);
  const session = await app.inject({ url: '/personal/api/session', headers: { cookie: auth.cookie } });
  assert.equal(session.json().email, email);
  assert.equal(session.json().kyc_state, 'not_started');
  const before = await write(auth, '/personal/api/sandbox/fund', {});
  assert.equal(before.statusCode, 403);
  const noCsrf = await app.inject({ method: 'POST', url: '/personal/api/sandbox/verify', headers: { origin, cookie: auth.cookie }, payload: { residence_country: 'NG', acknowledge_simulation: true } });
  assert.equal(noCsrf.statusCode, 403);
  const approved = await write(auth, '/personal/api/sandbox/verify', { residence_country: 'NG', acknowledge_simulation: true });
  assert.equal(approved.statusCode, 200, approved.body);
  const funded = await write(auth, '/personal/api/sandbox/fund', {});
  assert.equal(funded.statusCode, 200, funded.body);
  assert.equal((await write(auth, '/personal/api/sandbox/fund', {})).statusCode, 409);
  const home = await app.inject({ url: '/personal/api/home', headers: { cookie: auth.cookie } });
  assert.equal(home.json().balance.available_minor, '10000000');
  assert.equal(home.json().sandbox_funded, true);
});

test('Personal transfer posts once under an idempotency key and cannot overdraw', async () => {
  const senderEmail = `${id('sender')}@example.test`;
  const recipientEmail = `${id('receiver')}@example.test`;
  const sender = await login(senderEmail), recipient = await login(recipientEmail);
  for (const auth of [sender, recipient]) assert.equal((await write(auth, '/personal/api/sandbox/verify', { residence_country: 'NG', acknowledge_simulation: true })).statusCode, 200);
  assert.equal((await write(sender, '/personal/api/sandbox/fund', {})).statusCode, 200);
  const key = id('key'), payload = { recipient_email: recipientEmail, amount_minor: '125000' };
  const first = await write(sender, '/personal/api/transfers', payload, key);
  assert.equal(first.statusCode, 200, first.body);
  const retry = await write(sender, '/personal/api/transfers', payload, key);
  assert.equal(retry.json().id, first.json().id);
  assert.equal((await write(sender, '/personal/api/transfers', { ...payload, amount_minor: '125001' }, key)).statusCode, 409);
  assert.equal((await write(sender, '/personal/api/transfers', { ...payload, amount_minor: '99999999' }, id('key'))).statusCode, 422);
  const senderHome = await app.inject({ url: '/personal/api/home', headers: { cookie: sender.cookie } });
  const receiverHome = await app.inject({ url: '/personal/api/home', headers: { cookie: recipient.cookie } });
  assert.equal(senderHome.json().balance.available_minor, '9875000');
  assert.equal(receiverHome.json().balance.available_minor, '125000');
  const activity = await app.inject({ url: '/personal/api/activity', headers: { cookie: recipient.cookie } });
  assert.equal(activity.json().data.length, 1);
  assert.equal(activity.json().data[0].direction, 'received');
  assert.deepEqual(await invariantReport(), { balanced: true, nonnegative: true, no_empty_journals: true, violations: [] });
});
