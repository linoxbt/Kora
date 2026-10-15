import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportSPKI, SignJWT } from 'jose';
import { buildApi } from '../services/api/src/app.js';
import { pool, id, transaction } from '../packages/database/src/index.js';
import { createMerchant, invariantReport } from '../packages/ledger/src/index.js';
import { issueApiKey, allScopes, hashKey } from '../packages/payments/src/auth.js';
import { identityPrincipal } from '../services/api/src/identity.js';
const origin = 'http://127.0.0.1:4310';
const pair = await generateKeyPair('ES256');
const publicKey = await exportSPKI(pair.publicKey);
const appId = 'kora-auth-fixture';
const apps: Awaited<ReturnType<typeof buildApi>>[] = [];
after(async () => {
  for (const app of apps) await app.close();
  await pool.end();
});
async function fixture(config = { appId, verificationKey: publicKey }) {
  const app = await buildApi({ serveWeb: false, rateLimitMax: 10000, privyConfig: config });
  apps.push(app);
  const sign = (subject = `did:privy:${id('person')}`, claims: Record<string, unknown> = {}) =>
    new SignJWT({ sid: id('sid'), ...claims })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer('privy.io')
      .setAudience(appId)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(pair.privateKey);
  const login = async (
    token: string,
    extra: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) =>
    app.inject({
      method: 'POST',
      url: '/console/auth/privy',
      headers: { origin, ...headers },
      payload: { access_token: token, ...extra },
    });
  return { app, sign, login };
}
const cookieOf = (r: { headers: Record<string, unknown> }) =>
  String(r.headers['set-cookie']).split(';')[0];
async function guest(
  app: Awaited<ReturnType<typeof buildApi>>,
  scopes: (typeof allScopes)[number][] = [...allScopes],
) {
  const merchant = id('test');
  await createMerchant(merchant, 'Saved workspace');
  const key = await issueApiKey(merchant, 'Guest administrator', scopes);
  const r = await app.inject({
    method: 'POST',
    url: '/console/session',
    headers: { origin },
    payload: { api_key: key.secret },
  });
  assert.equal(r.statusCode, 200, r.body);
  return { merchant, key, cookie: cookieOf(r), csrf: r.json().csrf_token };
}

test('login readiness exposes only public identifiers and fails closed on absent or malformed keys', async () => {
  for (const config of [
    { appId: '', verificationKey: '' },
    { appId, verificationKey: 'broken' },
  ]) {
    const f = await fixture(config);
    const r = await f.app.inject({ url: '/console/auth/config' });
    assert.equal(r.json().enabled, false);
    assert.equal(r.json().app_id, null);
    assert.equal((await f.login('anything')).statusCode, 503);
  }
  const f = await fixture();
  const r = await f.app.inject({ url: '/console/auth/config' });
  assert.deepEqual(r.json(), { provider: 'privy', enabled: true, app_id: appId, client_id: null });
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.equal(r.body.includes(publicKey), false);
});
test('verified first login atomically creates one funded sandbox owner and a hashed HttpOnly session', async () => {
  const f = await fixture(),
    token = await f.sign();
  const r = await f.login(token, { name: 'Persistent account' });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().account_saved, true);
  assert.equal(r.json().auth_method, 'privy');
  assert.match(String(r.headers['set-cookie']), /HttpOnly/);
  assert.match(String(r.headers['set-cookie']), /SameSite=Strict/);
  assert.equal(r.body.includes(token), false);
  assert.equal(r.body.includes('kora_test_'), false);
  const c = cookieOf(r),
    raw = c.split('=')[1];
  const saved = (await pool.query('SELECT * FROM sessions WHERE token_hash=$1', [hashKey(raw)]))
    .rows[0];
  assert.equal(saved.token_hash.includes(raw), false);
  const me = await f.app.inject({ url: '/v1/me', headers: { cookie: c } });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().id, r.json().merchant_id);
  assert.equal(
    (
      await pool.query('SELECT count(*)::int n FROM journals WHERE reference LIKE $1', [
        `${r.json().merchant_id}:fixture:%`,
      ])
    ).rows[0].n,
    4,
  );
  const key = (await pool.query('SELECT operator_id FROM api_keys WHERE id=$1', [r.json().key_id]))
    .rows[0];
  assert.equal(key.operator_id, null);
  assert.deepEqual(await invariantReport(), {
    balanced: true,
    nonnegative: true,
    no_empty_journals: true,
    violations: [],
  });
});

test('Privy Business starts unfunded and requires the sandbox KYB fixture', async () => {
  const f = await fixture();
  const login = await f.login(await f.sign(), { name: 'Privy Business', business_account: true });
  assert.equal(login.statusCode, 200, login.body);
  const merchant = login.json().merchant_id;
  const organization = (await pool.query('SELECT kyb_required,kyb_state FROM organizations WHERE legacy_merchant_id=$1', [merchant])).rows[0];
  assert.equal(organization.kyb_required, true);
  assert.equal(organization.kyb_state, 'not_started');
  const before = await f.app.inject({ url: '/v1/balances', headers: { cookie: cookieOf(login) } });
  assert.equal(before.statusCode, 200);
  assert.equal(before.body.includes('250000000'), false);
  const approved = await f.app.inject({ method: 'POST', url: '/business/api/sandbox/verify', headers: { origin, cookie: cookieOf(login), 'x-kora-csrf': login.json().csrf_token }, payload: { acknowledge_simulation: true } });
  assert.equal(approved.statusCode, 200, approved.body);
});
test('concurrent first logins and response retries preserve one workspace, owner key and funding set', async () => {
  const f = await fixture(),
    token = await f.sign();
  const responses = await Promise.all(Array.from({ length: 4 }, () => f.login(token)));
  responses.forEach((r) => assert.equal(r.statusCode, 200, r.body));
  assert.equal(new Set(responses.map((r) => r.json().merchant_id)).size, 1);
  assert.equal(new Set(responses.map((r) => r.json().key_id)).size, 1);
  const r = await f.login(token, { name: 'Ignored rename' });
  assert.equal(r.json().merchant_id, responses[0].json().merchant_id);
  assert.equal(
    (
      await pool.query('SELECT count(*)::int n FROM api_keys WHERE merchant_id=$1', [
        r.json().merchant_id,
      ])
    ).rows[0].n,
    1,
  );
});
test('expired, future, wrong issuer/audience and missing claims cannot create an account', async () => {
  const f = await fixture();
  for (const change of ['expired', 'future', 'issuer', 'audience', 'subject', 'sid', 'exp']) {
    let jwt = new SignJWT(change === 'sid' ? {} : { sid: id('sid') })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuedAt(change === 'future' ? Math.floor(Date.now() / 1000) + 600 : undefined)
      .setIssuer(change === 'issuer' ? 'foreign.io' : 'privy.io')
      .setAudience(change === 'audience' ? 'another-app' : appId)
      .setSubject(change === 'subject' ? 'not-a-privy-did' : `did:privy:${id('reject')}`);
    if (change !== 'exp')
      jwt = jwt.setExpirationTime(
        change === 'expired' ? Math.floor(Date.now() / 1000) - 600 : '1h',
      );
    const r = await f.login(await jwt.sign(pair.privateKey));
    assert.equal(r.statusCode, 401, change);
    assert.equal(r.headers['set-cookie'], undefined);
  }
});
test('forged signatures, unsigned tokens and wrong algorithms are rejected without token disclosure', async () => {
  const f = await fixture(),
    foreign = await generateKeyPair('ES256');
  const wrong = await new SignJWT({ sid: 'fixture' })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer('privy.io')
    .setAudience(appId)
    .setSubject('did:privy:forged')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(foreign.privateKey);
  const hs = await new SignJWT({ sid: 'fixture' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('privy.io')
    .setAudience(appId)
    .setSubject('did:privy:forged')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new Uint8Array(32));
  for (const token of [wrong, hs, 'eyJhbGciOiJub25lIn0.e30.', 'secret-marker-invalid']) {
    const r = await f.login(token);
    assert.equal(r.statusCode, 401);
    assert.equal(r.body.includes(token), false);
  }
});
test('identity exchange enforces allowed origin, strict body and a bounded login rate', async () => {
  const f = await fixture(),
    token = await f.sign();
  assert.equal((await f.login(token, {}, { origin: 'https://foreign.test' })).statusCode, 403);
  for (const extra of [
    { merchant_id: 'foreign' },
    { subject: 'foreign' },
    { role: 'operator' },
    { email: 'unverified@test' },
    { name: '' },
  ])
    assert.equal((await f.login(token, extra)).statusCode, 400);
  const limited = await fixture();
  for (let i = 0; i < 10; i++) assert.equal((await limited.login('bad')).statusCode, 401);
  assert.equal((await limited.login('bad')).statusCode, 429);
});
test('explicit workspace save requires current administrator cookie and matching CSRF', async () => {
  const f = await fixture(),
    token = await f.sign(),
    g = await guest(f.app);
  assert.equal((await f.login(token, { link_current: true })).statusCode, 401);
  assert.equal(
    (await f.login(token, { link_current: true }, { cookie: g.cookie })).statusCode,
    403,
  );
  assert.equal(
    (
      await f.login(
        token,
        { link_current: true },
        { cookie: g.cookie, 'x-kora-csrf': '0'.repeat(64) },
      )
    ).statusCode,
    403,
  );
  const r = await f.login(
    token,
    { link_current: true },
    { cookie: g.cookie, 'x-kora-csrf': g.csrf },
  );
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().merchant_id, g.merchant);
  assert.notEqual(r.json().key_id, g.key.id);
  assert.equal(
    (await f.app.inject({ url: '/v1/me', headers: { cookie: g.cookie } })).statusCode,
    401,
  );
});
test('restricted sessions cannot claim workspace ownership and rejection rolls back identity creation', async () => {
  const f = await fixture(),
    subject = `did:privy:${id('limited')}`,
    token = await f.sign(subject);
  const g = await guest(f.app, ['payments:read', 'keys:write']);
  const r = await f.login(
    token,
    { link_current: true },
    { cookie: g.cookie, 'x-kora-csrf': g.csrf },
  );
  assert.equal(r.statusCode, 403);
  assert.equal(r.headers['set-cookie'], undefined);
  assert.equal(
    (
      await pool.query('SELECT 1 FROM console_identities WHERE app_id=$1 AND subject=$2', [
        appId,
        subject,
      ])
    ).rowCount,
    0,
  );
  assert.equal(
    (await f.app.inject({ url: '/v1/me', headers: { cookie: g.cookie } })).statusCode,
    200,
  );
});
test('workspace ownership cannot be stolen by another verified identity with an administrator key', async () => {
  const f = await fixture(),
    g = await guest(f.app),
    token = await f.sign();
  const a = await f.login(
    token,
    { link_current: true },
    { cookie: g.cookie, 'x-kora-csrf': g.csrf },
  );
  assert.equal(a.statusCode, 200);
  const login = await f.app.inject({
    method: 'POST',
    url: '/console/session',
    headers: { origin },
    payload: { api_key: g.key.secret },
  });
  const b = await f.login(
    await f.sign(),
    { link_current: true },
    { cookie: cookieOf(login), 'x-kora-csrf': login.json().csrf_token },
  );
  assert.equal(b.statusCode, 409);
  assert.equal(
    (
      await pool.query('SELECT count(*)::int n FROM console_memberships WHERE merchant_id=$1', [
        g.merchant,
      ])
    ).rows[0].n,
    1,
  );
});
test('an account already saved elsewhere cannot be rebound or rename its owned workspace', async () => {
  const f = await fixture(),
    token = await f.sign(),
    a = await f.login(token, { name: 'Original owner' }),
    g = await guest(f.app);
  const r = await f.login(
    token,
    { link_current: true },
    { cookie: g.cookie, 'x-kora-csrf': g.csrf },
  );
  assert.equal(r.statusCode, 409);
  const resumed = await f.login(token, { name: 'Attempted rename' });
  assert.equal(resumed.json().merchant_id, a.json().merchant_id);
  assert.equal(
    (await pool.query('SELECT name FROM merchants WHERE id=$1', [a.json().merchant_id])).rows[0]
      .name,
    'Original owner',
  );
});
test('identity-backed sessions enforce CSRF and cannot access another account’s payment resources', async () => {
  const f = await fixture(),
    a = await f.login(await f.sign()),
    b = await f.login(await f.sign());
  const headers = { origin, cookie: cookieOf(a), 'idempotency-key': id('idem') };
  assert.equal(
    (
      await f.app.inject({
        method: 'POST',
        url: '/v1/customers',
        headers,
        payload: { name: 'Blocked' },
      })
    ).statusCode,
    403,
  );
  const customer = await f.app.inject({
    method: 'POST',
    url: '/v1/customers',
    headers: { ...headers, 'x-kora-csrf': a.json().csrf_token },
    payload: { name: 'Owned' },
  });
  assert.equal(customer.statusCode, 201);
  assert.equal(
    (
      await f.app.inject({
        url: `/v1/customers/${customer.json().id}`,
        headers: { cookie: cookieOf(b) },
      })
    ).statusCode,
    404,
  );
});
test('revoking the login credential disables existing sessions and future logins without issuing a replacement', async () => {
  const f = await fixture(),
    token = await f.sign(),
    r = await f.login(token);
  await pool.query('UPDATE api_keys SET revoked_at=now() WHERE id=$1', [r.json().key_id]);
  assert.equal(
    (await f.app.inject({ url: '/v1/me', headers: { cookie: cookieOf(r) } })).statusCode,
    401,
  );
  const retry = await f.login(token);
  assert.equal(retry.statusCode, 403);
  assert.equal(retry.headers['set-cookie'], undefined);
  assert.equal(
    (
      await pool.query('SELECT count(*)::int n FROM api_keys WHERE merchant_id=$1', [
        r.json().merchant_id,
      ])
    ).rows[0].n,
    1,
  );
});
test('disabled accounts and a changed configured app cannot continue an old console session', async () => {
  const f = await fixture(),
    token = await f.sign(),
    r = await f.login(token);
  await pool.query(
    'UPDATE console_identities SET disabled_at=now() WHERE id=(SELECT identity_id FROM sessions WHERE token_hash=$1)',
    [hashKey(cookieOf(r).split('=')[1])],
  );
  assert.equal(
    (await f.app.inject({ url: '/console/session', headers: { cookie: cookieOf(r) } })).json()
      .authenticated,
    false,
  );
  assert.equal((await f.login(token)).statusCode, 403);
  const original = await f.login(await f.sign());
  const changed = await fixture({ appId: 'another-app', verificationKey: publicKey });
  assert.equal(
    (await changed.app.inject({ url: '/v1/me', headers: { cookie: cookieOf(original) } }))
      .statusCode,
    401,
  );
});
test('logout removes identity sessions; the same verified account later returns to its original workspace', async () => {
  const f = await fixture(),
    token = await f.sign(),
    r = await f.login(token);
  const out = await f.app.inject({
    method: 'POST',
    url: '/console/logout',
    headers: { origin, cookie: cookieOf(r), 'x-kora-csrf': r.json().csrf_token },
  });
  assert.equal(out.statusCode, 200);
  assert.equal(
    (await f.app.inject({ url: '/v1/me', headers: { cookie: cookieOf(r) } })).statusCode,
    401,
  );
  const back = await f.login(token);
  assert.equal(back.statusCode, 200);
  assert.equal(back.json().merchant_id, r.json().merchant_id);
});
test('ownership and session composite foreign keys reject cross-merchant credentials', async () => {
  const f = await fixture(),
    a = await f.login(await f.sign()),
    b = await f.login(await f.sign());
  const account = (
    await pool.query('SELECT identity_id FROM console_memberships WHERE merchant_id=$1', [
      a.json().merchant_id,
    ])
  ).rows[0].identity_id;
  await assert.rejects(
    pool.query(
      "INSERT INTO sessions(token_hash,merchant_id,api_key_id,csrf_token,expires_at,auth_method,identity_id) VALUES($1,$2,$3,$4,now()+interval '1 day','privy',$5)",
      [hashKey(id('token')), b.json().merchant_id, b.json().key_id, '0'.repeat(64), account],
    ),
    /foreign key/,
  );
  await assert.rejects(
    pool.query('UPDATE console_memberships SET merchant_id=$1 WHERE identity_id=$2', [
      b.json().merchant_id,
      account,
    ]),
    /immutable/,
  );
  await assert.rejects(
    pool.query('UPDATE console_identities SET subject=$1 WHERE id=$2', [
      'did:privy:rebound',
      account,
    ]),
    /immutable/,
  );
});
test('HTTPS login sets Secure cookies and expired sessions cannot read workspace data', async () => {
  const previous = process.env.KORA_CONSOLE_ORIGINS;
  process.env.KORA_CONSOLE_ORIGINS = `${origin},https://login-preview.test`;
  try {
    const f = await fixture();
    const r = await f.login(await f.sign(), {}, { origin: 'https://login-preview.test' });
    assert.equal(r.statusCode, 200, r.body);
    assert.match(String(r.headers['set-cookie']), /Secure/);
    await pool.query(
      "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [hashKey(cookieOf(r).split('=')[1])],
    );
    assert.equal(
      (await f.app.inject({ url: '/v1/me', headers: { cookie: cookieOf(r) } })).statusCode,
      401,
    );
    assert.equal(
      (await f.app.inject({ url: '/console/session', headers: { cookie: cookieOf(r) } })).json()
        .authenticated,
      false,
    );
  } finally {
    if (previous === undefined) delete process.env.KORA_CONSOLE_ORIGINS;
    else process.env.KORA_CONSOLE_ORIGINS = previous;
  }
});
test('failed ownership transaction leaves no workspace, funding, identity or key behind', async () => {
  const subject = `did:privy:${id('rollback')}`;
  let merchant = '';
  await assert.rejects(
    transaction(async (c) => {
      const result = await identityPrincipal(c, { app_id: appId, subject }, 'Rollback account');
      merchant = result.principal.merchant_id;
      throw new Error('Simulated commit failure');
    }),
    /Simulated commit failure/,
  );
  assert.equal(
    (
      await pool.query('SELECT 1 FROM console_identities WHERE app_id=$1 AND subject=$2', [
        appId,
        subject,
      ])
    ).rowCount,
    0,
  );
  assert.equal((await pool.query('SELECT 1 FROM merchants WHERE id=$1', [merchant])).rowCount, 0);
  assert.equal(
    (await pool.query('SELECT 1 FROM journals WHERE reference LIKE $1', [`${merchant}:fixture:%`]))
      .rowCount,
    0,
  );
  assert.equal(
    (await pool.query('SELECT 1 FROM api_keys WHERE merchant_id=$1', [merchant])).rowCount,
    0,
  );
});
test('owner invites a viewer, redemption is single-use, and revocation stops an existing session', async () => {
  const f = await fixture();
  const owner = await f.login(await f.sign());
  const ownerHeaders = { origin, cookie: cookieOf(owner), 'x-kora-csrf': owner.json().csrf_token };
  const invited = await f.app.inject({
    method: 'POST',
    url: '/console/team/invitations',
    headers: ownerHeaders,
    payload: { role: 'viewer' },
  });
  assert.equal(invited.statusCode, 201, invited.body);
  assert.match(invited.json().token, /^kora_inv_[a-f0-9]{64}$/);
  const listing = await f.app.inject({
    url: '/console/team',
    headers: { cookie: cookieOf(owner) },
  });
  assert.equal(listing.body.includes(invited.json().token), false);
  const viewerToken = await f.sign();
  const viewer = await f.login(viewerToken, { invite_token: invited.json().token });
  assert.equal(viewer.statusCode, 200, viewer.body);
  assert.equal(viewer.json().merchant_id, owner.json().merchant_id);
  assert.equal(viewer.json().role, 'viewer');
  assert.deepEqual(viewer.json().scopes, ['payments:read', 'customers:read', 'operations:read']);
  assert.equal(
    (await f.login(await f.sign(), { invite_token: invited.json().token })).statusCode,
    404,
  );
  assert.equal(
    (await f.app.inject({ url: '/v1/me', headers: { cookie: cookieOf(viewer) } })).statusCode,
    200,
  );
  const member = (
    await f.app.inject({ url: '/console/team', headers: { cookie: cookieOf(owner) } })
  )
    .json()
    .members.find((m: { role: string }) => m.role === 'viewer');
  assert.ok(member);
  assert.equal(
    (
      await f.app.inject({
        method: 'POST',
        url: `/console/team/members/${member.id}/revoke`,
        headers: { origin, cookie: cookieOf(viewer), 'x-kora-csrf': viewer.json().csrf_token },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await f.app.inject({
        method: 'POST',
        url: `/console/team/members/${member.id}/revoke`,
        headers: ownerHeaders,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await f.app.inject({ url: '/v1/me', headers: { cookie: cookieOf(viewer) } })).statusCode,
    401,
  );
  assert.equal((await f.login(viewerToken)).statusCode, 403);
});
test('an existing account can join another workspace and switch; revoked invites cannot be redeemed', async () => {
  const f = await fixture();
  const owner = await f.login(await f.sign());
  const memberToken = await f.sign();
  const own = await f.login(memberToken);
  const headers = { origin, cookie: cookieOf(owner), 'x-kora-csrf': owner.json().csrf_token };
  const revoked = await f.app.inject({
    method: 'POST',
    url: '/console/team/invitations',
    headers,
    payload: { role: 'viewer' },
  });
  assert.equal(
    (
      await f.app.inject({
        method: 'POST',
        url: `/console/team/invitations/${revoked.json().id}/revoke`,
        headers,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await f.login(memberToken, { invite_token: revoked.json().token })).statusCode,
    404,
  );
  const invite = await f.app.inject({
    method: 'POST',
    url: '/console/team/invitations',
    headers,
    payload: { role: 'editor' },
  });
  const joined = await f.login(
    memberToken,
    { invite_token: invite.json().token },
    { origin, cookie: cookieOf(own), 'x-kora-csrf': own.json().csrf_token },
  );
  assert.equal(joined.statusCode, 200, joined.body);
  assert.equal(joined.json().role, 'editor');
  assert.equal(joined.json().merchant_id, owner.json().merchant_id);
  assert.equal(joined.json().scopes.includes('keys:write'), false);
  const workspaces = (
    await f.app.inject({ url: '/console/workspaces', headers: { cookie: cookieOf(joined) } })
  ).json().data;
  assert.equal(workspaces.length, 2);
  const switched = await f.app.inject({
    method: 'POST',
    url: '/console/workspaces/switch',
    headers: { origin, cookie: cookieOf(joined), 'x-kora-csrf': joined.json().csrf_token },
    payload: { merchant_id: own.json().merchant_id },
  });
  assert.equal(switched.statusCode, 200, switched.body);
  assert.equal(switched.json().role, 'owner');
  assert.equal(switched.json().merchant_id, own.json().merchant_id);
  assert.equal(
    (await f.app.inject({ url: '/v1/me', headers: { cookie: cookieOf(joined) } })).statusCode,
    401,
  );
  assert.equal((await f.login(memberToken)).json().merchant_id, own.json().merchant_id);
});
test('team controls require owner identity and CSRF; competing redemptions admit only one member', async () => {
  const f = await fixture();
  const owner = await f.login(await f.sign());
  const ownerHeaders = { origin, cookie: cookieOf(owner), 'x-kora-csrf': owner.json().csrf_token };
  assert.equal(
    (
      await f.app.inject({
        method: 'POST',
        url: '/console/team/invitations',
        headers: { origin, cookie: cookieOf(owner) },
        payload: { role: 'viewer' },
      })
    ).statusCode,
    403,
  );
  const invite = await f.app.inject({
    method: 'POST',
    url: '/console/team/invitations',
    headers: ownerHeaders,
    payload: { role: 'editor' },
  });
  const results = await Promise.all([
    f.login(await f.sign(), { invite_token: invite.json().token }),
    f.login(await f.sign(), { invite_token: invite.json().token }),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 404]);
  const editor = results.find((r) => r.statusCode === 200)!;
  assert.equal(
    (await f.app.inject({ url: '/console/team', headers: { cookie: cookieOf(editor) } }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await f.app.inject({
        method: 'POST',
        url: '/console/team/invitations',
        headers: { origin, cookie: cookieOf(editor), 'x-kora-csrf': editor.json().csrf_token },
        payload: { role: 'viewer' },
      })
    ).statusCode,
    403,
  );
  const me = await f.app.inject({ url: '/v1/me', headers: { cookie: cookieOf(editor) } });
  assert.equal(me.statusCode, 200);
  assert.equal(editor.json().scopes.includes('operations:write'), false);
});
