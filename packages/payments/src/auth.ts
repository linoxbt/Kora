import { createHash, randomBytes } from 'node:crypto';
import { id, pool, type Client } from '../../database/src/index.js';
import { PaymentError } from './errors.js';
export const allScopes = [
  'payments:read',
  'payments:write',
  'customers:read',
  'customers:write',
  'webhooks:read',
  'webhooks:write',
  'keys:read',
  'keys:write',
  'operations:read',
  'operations:write',
] as const;
export type Scope = (typeof allScopes)[number];
export interface Principal {
  merchant_id: string;
  key_id: string;
  scopes: Scope[];
  operator_id?: string | null;
}
export const hashKey = (secret: string) => createHash('sha256').update(secret).digest('hex');
export async function issueApiKey(
  merchantId: string,
  name: string,
  scopes: readonly Scope[] = allScopes,
  client?: Client,
) {
  const secret = `kora_test_${randomBytes(32).toString('hex')}`,
    keyId = id('key');
  await (client ?? pool).query(
    'INSERT INTO api_keys(id,merchant_id,name,prefix,hash,scopes) VALUES($1,$2,$3,$4,$5,$6)',
    [keyId, merchantId, name, secret.slice(0, 18), hashKey(secret), scopes],
  );
  return { id: keyId, secret, prefix: secret.slice(0, 18) };
}
export async function authenticate(header?: string): Promise<Principal> {
  if (!header || !/^Bearer kora_test_[a-f0-9]{64}$/.test(header))
    throw new PaymentError(401, 'invalid_api_key', 'A valid sandbox Bearer API key is required');
  const secret = header.slice(7);
  const result = await pool.query(
    "SELECT k.id,k.merchant_id,k.scopes,k.operator_id FROM api_keys k JOIN merchants m ON m.id=k.merchant_id WHERE k.hash=$1 AND k.revoked_at IS NULL AND m.mode='sandbox'",
    [hashKey(secret)],
  );
  if (!result.rowCount)
    throw new PaymentError(401, 'invalid_api_key', 'A valid sandbox Bearer API key is required');
  return {
    key_id: result.rows[0].id,
    merchant_id: result.rows[0].merchant_id,
    scopes: result.rows[0].scopes,
    operator_id: result.rows[0].operator_id,
  };
}
export function requireScope(principal: Principal, scope: Scope) {
  if (!principal.scopes.includes(scope))
    throw new PaymentError(403, 'insufficient_scope', `This operation requires ${scope}`);
}
