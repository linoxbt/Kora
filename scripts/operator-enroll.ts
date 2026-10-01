import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { transaction, pool, id } from '../packages/database/src/index.js';
import { hashKey } from '../packages/payments/src/auth.js';
const [merchant, subject, name] = process.argv.slice(2);
try {
  if (!merchant || !subject || !name || subject.length > 240 || name.length > 120)
    throw new Error(
      'Usage: pnpm operator:enroll <merchant-id> <verified-subject-reference> <display-name>',
    );
  const secret = `kora_test_${randomBytes(32).toString('hex')}`;
  const result = await transaction(async (c) => {
    const operator = id('opr'),
      key = id('key');
    await c.query(
      'INSERT INTO control_operators(id,merchant_id,display_name,external_subject) VALUES($1,$2,$3,$4)',
      [operator, merchant, name, subject],
    );
    await c.query(
      'INSERT INTO api_keys(id,merchant_id,name,prefix,hash,scopes,operator_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        key,
        merchant,
        name,
        secret.slice(0, 18),
        hashKey(secret),
        ['operations:read', 'operations:write'],
        operator,
      ],
    );
    // Persist credentials before committing enrollment; fail closed on storage failure.
    await mkdir('.sandbox/operators', { recursive: true, mode: 0o700 });
    const path = `.sandbox/operators/${operator}.json`;
    await writeFile(
      path,
      JSON.stringify(
        { merchant_id: merchant, operator_id: operator, key_id: key, api_key: secret },
        null,
        2,
      ) + '\n',
      { mode: 0o600, flag: 'wx' },
    );
    return { operator_id: operator, credentials_path: path };
  });
  console.log(JSON.stringify(result));
} finally {
  await pool.end();
}
