// Trusted local test fixtures. This module is never imported by the API or worker.
import { randomBytes } from 'node:crypto';
import { pool, id, transaction } from '../packages/database/src/index.js';
import { createMerchant, sandboxFund } from '../packages/ledger/src/index.js';
import { hashKey, allScopes, type Principal } from '../packages/payments/src/auth.js';
import { addEvidence, gateKinds, dailyReport } from '../packages/controls/src/index.js';
export async function controlFixture(name: string) {
  const merchant = id('pilot');
  await createMerchant(merchant, name);
  await sandboxFund(merchant, 'NGN', '10000000', `${merchant}:fund`);
  const actors = [];
  for (const label of ['Requester', 'Reviewer']) {
    const operator = id('opr'),
      key = id('key'),
      secret = `kora_test_${randomBytes(32).toString('hex')}`;
    await transaction(async (c) => {
      await c.query(
        'INSERT INTO control_operators(id,merchant_id,display_name,external_subject) VALUES($1,$2,$3,$4)',
        [operator, merchant, label, `local-rehearsal:${operator}`],
      );
      await c.query(
        'INSERT INTO api_keys(id,merchant_id,name,prefix,hash,scopes,operator_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [key, merchant, label, secret.slice(0, 18), hashKey(secret), [...allScopes], operator],
      );
    });
    actors.push({
      secret,
      principal: {
        merchant_id: merchant,
        key_id: key,
        scopes: [...allScopes],
        operator_id: operator,
      } as Principal,
    });
  }
  const [requester, reviewer] = actors;
  await transaction(async (c) => {
    for (const kind of gateKinds)
      await addEvidence(c, requester.principal, {
        kind,
        outcome: 'checked',
        reference: 'local-rehearsal-fixture',
        reason: 'Simulated staging review; external assurance remains pending',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });
    await dailyReport(c, requester.principal, new Date().toISOString().slice(0, 10));
  });
  return { merchant, requester, reviewer };
}
