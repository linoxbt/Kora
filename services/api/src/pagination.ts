import { z } from 'zod';
import { pool } from '../../../packages/database/src/index.js';
import { typedId } from '../../../packages/contracts/src/index.js';
import { PaymentError } from '../../../packages/payments/src/errors.js';
const querySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    after: z.string().max(512).optional(),
  })
  .strict();
export type ListTable =
  | 'collections'
  | 'statement_runs'
  | 'customers'
  | 'instruments'
  | 'quotes'
  | 'intents'
  | 'events'
  | 'webhook_endpoints'
  | 'api_keys';
export async function page(
  table: ListTable,
  merchantId: string,
  query: unknown,
  extra?: { field: 'customer_id'; value: string },
) {
  const input =
    table === 'intents'
      ? querySchema
          .extend({
            state: z
              .enum(['processing', 'unknown', 'succeeded', 'failed', 'canceled', 'returned'])
              .optional(),
            search: z.string().max(128).optional(),
          })
          .parse(query)
      : querySchema.parse(query);
  const { limit, after } = input;
  let cursor: { at: string; id: string } | null = null;
  if (after) {
    try {
      cursor = z
        .object({ at: z.string().min(1).max(64), id: typedId })
        .strict()
        .parse(JSON.parse(Buffer.from(after, 'base64url').toString()));
      if (!Number.isFinite(Date.parse(cursor.at))) throw new Error();
    } catch {
      throw new PaymentError(400, 'invalid_cursor', 'Pagination cursor is invalid');
    }
  }
  const values: unknown[] = [merchantId, cursor?.at ?? null, cursor?.id ?? null, limit + 1];
  let filter = '';
  if (extra) {
    values.push(extra.value);
    filter = 'AND customer_id=$5';
  }
  if (table === 'intents') {
    const q = input as { state?: string; search?: string };
    values.push(q.state ?? null, q.search ?? null);
    filter =
      'AND ($5::text IS NULL OR state=$5) AND ($6::text IS NULL OR strpos(lower(reference),lower($6))>0 OR strpos(id,$6)>0)';
  }
  const result = await pool.query(
    `SELECT *,created_at::text AS _cursor_at FROM ${table} WHERE merchant_id=$1 AND ($2::text IS NULL OR (created_at,id)<($2::timestamptz,$3::text)) ${filter} ORDER BY created_at DESC,id DESC LIMIT $4`,
    values,
  );
  const hasMore = result.rows.length > limit,
    rows = result.rows.slice(0, limit),
    last = rows.at(-1);
  const next =
    hasMore && last
      ? Buffer.from(JSON.stringify({ at: last._cursor_at, id: last.id })).toString('base64url')
      : null;
  return { data: rows.map(({ _cursor_at, ...row }) => row), has_more: hasMore, next_cursor: next };
}
