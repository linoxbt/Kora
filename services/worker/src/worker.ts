import { id, pool, transaction } from '../../../packages/database/src/index.js';
import { processIntent, type EngineOptions } from '../../../packages/payments/src/index.js';
export interface WorkerOptions extends EngineOptions {
  onlyIntent?: string;
  onlyMerchant?: string;
  leaseMs?: number;
}
export async function runOnce(options: WorkerOptions = {}): Promise<boolean> {
  const token = id('lease');
  const job = await transaction(async (c) => {
    const found = (
      await c.query(
        "SELECT * FROM outbox WHERE kind='execute' AND processed_at IS NULL AND available_at<=now() AND (locked_until IS NULL OR locked_until<now()) AND ($1::text IS NULL OR intent_id=$1) AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM intents i WHERE i.id=outbox.intent_id AND i.merchant_id=$2)) ORDER BY priority DESC,available_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
        [options.onlyIntent ?? null, options.onlyMerchant ?? null],
      )
    ).rows[0];
    if (!found) return null;
    return (
      await c.query(
        "UPDATE outbox SET locked_by=$2,locked_until=now()+($3::integer*interval '1 millisecond'),attempts=attempts+1 WHERE id=$1 RETURNING *",
        [found.id, token, options.leaseMs ?? 30000],
      )
    ).rows[0];
  });
  if (!job) return false;
  try {
    const outcome = await processIntent(job.intent_id, options);
    if (outcome === 'terminal')
      await pool.query(
        'UPDATE outbox SET processed_at=now(),locked_by=NULL,locked_until=NULL,last_error=NULL,priority=0 WHERE id=$1 AND locked_by=$2',
        [job.id, token],
      );
    else
      await pool.query(
        "UPDATE outbox SET available_at=now()+($3::integer*interval '1 second'),locked_by=NULL,locked_until=NULL,last_error=$4,priority=0 WHERE id=$1 AND locked_by=$2",
        [
          job.id,
          token,
          Math.min(60, 2 ** Math.min(job.attempts, 5)),
          outcome === 'busy' ? 'intent_busy' : 'recovery_pending',
        ],
      );
  } catch {
    await pool.query(
      "UPDATE outbox SET available_at=now()+interval '2 seconds',locked_by=NULL,locked_until=NULL,last_error='execution_error',priority=0 WHERE id=$1 AND locked_by=$2",
      [job.id, token],
    );
  }
  return true;
}
