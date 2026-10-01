import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
if (process.env.KORA_MODE && process.env.KORA_MODE !== 'sandbox') throw new Error('This phase of Kora supports sandbox mode only');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://kora:kora_local_only@127.0.0.1:55432/kora', max: 12 });
export const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll('-', '')}`;
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { return await transactionOn(client, fn); } finally { client.release(); }
}
export async function transactionOn<T>(client: pg.PoolClient, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
}
export type Client = pg.PoolClient;
