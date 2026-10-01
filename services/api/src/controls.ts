import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool, type Client } from '../../../packages/database/src/index.js';
import { requireScope, type Principal } from '../../../packages/payments/src/auth.js';
import { mutate, type MutationResult } from '../../../packages/payments/src/idempotency.js';
import { PaymentError } from '../../../packages/payments/src/errors.js';
import {
  readiness,
  addEvidence,
  requestChange,
  reviewChange,
  pause,
  dailyReport,
} from '../../../packages/controls/src/index.js';
import {
  controlEvidenceSchema,
  controlRequestSchema,
  controlReviewSchema,
  controlPauseSchema,
  controlDaySchema,
  typedId,
} from '../../../packages/contracts/src/index.js';
export async function registerControls(app: FastifyInstance) {
  const principal = (r: FastifyRequest, write = false) => {
    if (!r.principal) throw new PaymentError(401, 'invalid_api_key', 'Authentication required');
    requireScope(r.principal, write ? 'operations:write' : 'operations:read');
    return r.principal;
  };
  function write<T>(
    url: string,
    schema: z.ZodType<T>,
    run: (c: Client, p: Principal, input: T, r: FastifyRequest) => Promise<MutationResult>,
  ) {
    app.post(url, async (r, reply) => {
      const p = principal(r, true),
        input = schema.parse(r.body ?? {}),
        result = await mutate(
          p.merchant_id,
          `POST ${r.routeOptions.url}:${JSON.stringify(r.params)}`,
          r.headers['idempotency-key'],
          input,
          (c) => run(c, p, input, r),
        );
      if (result.replayed) reply.header('idempotency-replayed', 'true');
      return reply.status(result.status).send(result.body);
    });
  }
  app.get('/v1/controls', async (r) => {
    const p = principal(r),
      c = await pool.connect();
    try {
      return { ...(await readiness(c, p.merchant_id)), operator_id: p.operator_id ?? null };
    } finally {
      c.release();
    }
  });
  const tables = {
    evidence: 'control_evidence',
    approvals: 'control_requests',
    reports: 'daily_control_reports',
    audit: 'control_audit',
  } as const;
  for (const [name, table] of Object.entries(tables))
    app.get(`/v1/controls/${name}`, async (r) => ({
      data: (
        await pool.query(
          `SELECT *${name === 'reports' ? ',day::text AS day' : ''} FROM ${table} WHERE merchant_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,
          [principal(r).merchant_id],
        )
      ).rows,
    }));
  write('/v1/controls/evidence', controlEvidenceSchema, async (c, p, i) => ({
    status: 201,
    body: await addEvidence(c, p, i),
  }));
  write('/v1/controls/approvals', controlRequestSchema, async (c, p, i) => ({
    status: 201,
    body: await requestChange(c, p, i),
  }));
  write('/v1/controls/approvals/:id/review', controlReviewSchema, async (c, p, i, r) => ({
    status: 200,
    body: await reviewChange(c, p, typedId.parse((r.params as { id: string }).id), i),
  }));
  write('/v1/controls/pause', controlPauseSchema, async (c, p, i) => ({
    status: 200,
    body: await pause(c, p, i.reason),
  }));
  write('/v1/controls/reports', controlDaySchema, async (c, p, i) => ({
    status: 201,
    body: await dailyReport(c, p, i.day),
  }));
}
