import { createHash } from 'node:crypto';
import { transaction, type Client } from '../../database/src/index.js';
import { PaymentError } from './errors.js';
import { seal, unseal } from './secrets.js';
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(k=>`${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
}
export interface MutationResult { status: number; body: unknown; replayed?: boolean }
export async function mutate(merchantId: string, endpoint: string, key: unknown, payload: unknown, run: (c:Client)=>Promise<MutationResult>): Promise<MutationResult> {
  if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new PaymentError(400,'idempotency_key_required','Use an Idempotency-Key of 1–128 letters, digits, dots, underscores, colons or hyphens');
  const fingerprint = createHash('sha256').update(canonical(payload)).digest('hex');
  return transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`idem:${merchantId}:${endpoint}:${key}`]);
    const existing=(await c.query('SELECT * FROM idempotency WHERE merchant_id=$1 AND endpoint=$2 AND key=$3',[merchantId,endpoint,key])).rows[0];
    if(existing) {
      if(existing.fingerprint!==fingerprint) throw new PaymentError(409,'idempotency_conflict','This key was used with a different request');
      return {status:existing.status,body:JSON.parse(unseal(existing.response.sealed)),replayed:true};
    }
    const result=await run(c);
    const response={sealed:seal(JSON.stringify(result.body))};
    await c.query('INSERT INTO idempotency(merchant_id,endpoint,key,fingerprint,response,status) VALUES($1,$2,$3,$4,$5,$6)',[merchantId,endpoint,key,fingerprint,response,result.status]);
    return result;
  });
}
