import type { FastifyInstance, FastifyRequest } from 'fastify';
import { evaluateRoutes, recordHealth } from '../../../packages/network/src/routing.js';
import { pool } from '../../../packages/database/src/index.js';
import { registry, quoteCorridor, detail } from '../../../packages/network/src/index.js';
import { createIntent, publicIntent, PaymentError } from '../../../packages/payments/src/index.js';
import { requireScope } from '../../../packages/payments/src/auth.js';
import { mutate } from '../../../packages/payments/src/idempotency.js';
import {
  networkQuoteSchema,
  networkRoutingQuery,
  networkHealthSchema,
  networkIntentSchema,
  typedId,
} from '../../../packages/contracts/src/index.js';
function principal(r: FastifyRequest, write = false) {
  if (!r.principal) throw new PaymentError(401, 'invalid_api_key', 'Authentication required');
  requireScope(r.principal, write ? 'payments:write' : 'payments:read');
  return r.principal;
}
export async function registerNetwork(app: FastifyInstance) {
  app.get('/v1/network/routing', async (r) => {
    const p = principal(r),
      input = networkRoutingQuery.parse(r.query),
      c = await pool.connect();
    try {
      return await evaluateRoutes(c, p.merchant_id, input.amount_minor);
    } finally {
      c.release();
    }
  });
  app.post('/v1/network/health', async (r, reply) => {
    const p = r.principal;
    if (!p) throw new PaymentError(401, 'invalid_api_key', 'Authentication required');
    requireScope(p, 'operations:write');
    const input = networkHealthSchema.parse(r.body);
    const result = await mutate(
      p.merchant_id,
      'POST /v1/network/health',
      r.headers['idempotency-key'],
      input,
      async (c) => ({ status: 201, body: await recordHealth(c, p.merchant_id, p.key_id, input) }),
    );
    if (result.replayed) reply.header('idempotency-replayed', 'true');
    return reply.status(result.status).send(result.body);
  });
  app.get('/v1/network', async (r) => {
    principal(r);
    const c = await pool.connect();
    try {
      return await registry(c);
    } finally {
      c.release();
    }
  });
  app.get('/v1/network/plans', async (r) => ({
    data: (
      await pool.query(
        'SELECT id,quote_id,corridor_id,created_at FROM network_plans WHERE merchant_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',
        [principal(r).merchant_id],
      )
    ).rows,
  }));
  app.get('/v1/network/plans/:id', async (r) => {
    const p = principal(r),
      c = await pool.connect();
    try {
      return await detail(c, p.merchant_id, typedId.parse((r.params as { id: string }).id));
    } finally {
      c.release();
    }
  });
  app.post('/v1/network/quotes', async (r, reply) => {
    const p = principal(r, true),
      i = networkQuoteSchema.parse(r.body),
      result = await mutate(
        p.merchant_id,
        'POST /v1/network/quotes',
        r.headers['idempotency-key'],
        i,
        async (c) => {
          const { quote, plan_id, routing } = await quoteCorridor(c, p.merchant_id, i);
          return {
            status: 201,
            body: {
              id: quote.id,
              plan_id,
              source: { asset: quote.source_asset, amount_minor: quote.source_minor },
              destination: {
                asset: quote.destination_asset,
                amount_minor: quote.destination_minor,
              },
              fee: { asset: quote.source_asset, amount_minor: quote.fee_minor },
              route: quote.route,
              expires_at: quote.expires_at,
              mode: 'sandbox',
              routing,
              settlement_mode: 'simulated',
            },
          };
        },
      );
    if (result.replayed) reply.header('idempotency-replayed', 'true');
    return reply.status(result.status).send(result.body);
  });
  app.post('/v1/network/intents', async (r, reply) => {
    const p = principal(r, true),
      i = networkIntentSchema.parse(r.body),
      result = await mutate(
        p.merchant_id,
        'POST /v1/network/intents',
        r.headers['idempotency-key'],
        i,
        async (c) => {
          const plan = (
            await c.query('SELECT * FROM network_plans WHERE id=$1 AND merchant_id=$2', [
              i.plan_id,
              p.merchant_id,
            ])
          ).rows[0];
          if (!plan) throw new PaymentError(404, 'route_not_found', 'Route plan not found');
          return {
            status: 201,
            body: publicIntent(
              await createIntent(c, p.merchant_id, {
                quote_id: plan.quote_id,
                customer_id: i.customer_id,
                destination_instrument_id: i.destination_instrument_id,
                reference: i.reference,
                type: 'transfer',
                scenario: plan.scenario,
              }),
            ),
          };
        },
      );
    if (result.replayed) reply.header('idempotency-replayed', 'true');
    return reply.status(result.status).send(result.body);
  });
}
