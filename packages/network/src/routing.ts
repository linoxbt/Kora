import { id, type Client } from '../../database/src/index.js';
import { minor } from '../../core/src/index.js';
import { PaymentError } from '../../payments/src/errors.js';
export interface Health {
  participant_id: string;
  provider_binding: string;
  status: 'healthy' | 'degraded' | 'unavailable' | 'unknown';
  source: 'simulator_registry' | 'receipt_measurement' | 'operator_simulation';
  samples: number;
  confirmed: number;
  rejected: number;
  failure_rate_ppm: number;
  latency_ms: number | null;
  observed_at: string;
  expires_at: string;
}
export interface Candidate {
  corridor_id: string;
  destination_participant_id: string;
  priority: number;
  eligible: boolean;
  reason: string | null;
  capacity_minor: string;
  available_minor: string;
  health: Health[];
}
export interface RoutingDecision {
  mode: 'sandbox';
  strategy: 'healthy_then_acceptance_then_latency_then_priority';
  amount_minor: string;
  evaluated_at: string;
  window_seconds: number;
  selected_corridor_id: string | null;
  candidates: Candidate[];
}
export const healthLock = (merchant: string, participant: string) =>
  `network-health:${merchant}:${participant}`;
export async function participantHealth(
  c: Client,
  merchant: string,
  participant: string,
): Promise<Health> {
  const p = (await c.query('SELECT * FROM network_participants WHERE id=$1', [participant]))
    .rows[0];
  if (!p) throw new PaymentError(404, 'participant_not_found', 'Sandbox participant not found');
  const metric = (
    await c.query(
      `SELECT count(*)::int samples,count(*) FILTER(WHERE m.outcome='confirmed')::int confirmed,
     count(*) FILTER(WHERE m.outcome='rejected')::int rejected,
     round(avg(GREATEST(0,extract(epoch FROM(m.created_at-l.created_at))*1000)))::integer latency_ms,
     max(m.created_at) observed_at FROM network_movements m JOIN network_legs l ON l.id=m.leg_id
     JOIN network_plans p ON p.id=l.plan_id
     WHERE p.merchant_id=$1 AND l.participant_id=$2 AND l.provider_binding=$3 AND m.created_at>now()-interval '5 minutes'`,
      [merchant, participant, p.provider_binding],
    )
  ).rows[0];
  const override = (
    await c.query(
      'SELECT *,expires_at>now() fresh FROM network_health_overrides WHERE merchant_id=$1 AND participant_id=$2 ORDER BY observed_at DESC,id DESC LIMIT 1',
      [merchant, participant],
    )
  ).rows[0];
  let status: Health['status'] = metric.rejected > 0 ? 'degraded' : 'healthy';
  let source: Health['source'] = metric.samples ? 'receipt_measurement' : 'simulator_registry';
  let observed = metric.observed_at ? new Date(metric.observed_at) : new Date();
  let expires = new Date(observed.getTime() + 300000);
  if (override) {
    source = 'operator_simulation';
    observed = new Date(override.observed_at);
    expires = new Date(override.expires_at);
    status =
      override.fresh && override.provider_binding === p.provider_binding
        ? override.status
        : 'unknown';
  }
  if (!p.enabled || p.mode !== 'sandbox' || !p.provider_binding.startsWith('sim:'))
    status = 'unavailable';
  return {
    participant_id: participant,
    provider_binding: p.provider_binding,
    status,
    source,
    samples: metric.samples,
    confirmed: metric.confirmed,
    rejected: metric.rejected,
    failure_rate_ppm: metric.samples
      ? Number(
          (BigInt(metric.rejected) * 1000000n + BigInt(metric.samples) - 1n) /
            BigInt(metric.samples),
        )
      : 0,
    latency_ms: metric.latency_ms ?? null,
    observed_at: observed.toISOString(),
    expires_at: expires.toISOString(),
  };
}
export async function requireHealthy(c: Client, merchant: string, participant: string) {
  const health = await participantHealth(c, merchant, participant);
  if (health.status !== 'healthy')
    throw new PaymentError(
      422,
      'participant_health',
      'Frozen sandbox participant is unavailable, degraded, or has stale health',
    );
  return health;
}
export async function recordHealth(
  c: Client,
  merchant: string,
  actor: string,
  input: {
    participant_id: string;
    status: 'healthy' | 'degraded' | 'unavailable';
    reason: string;
    valid_for_seconds: number;
  },
) {
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    healthLock(merchant, input.participant_id),
  ]);
  const p = (
    await c.query('SELECT * FROM network_participants WHERE id=$1 FOR SHARE', [
      input.participant_id,
    ])
  ).rows[0];
  if (!p) throw new PaymentError(404, 'participant_not_found', 'Sandbox participant not found');
  const result = (
    await c.query(
      `INSERT INTO network_health_overrides(id,merchant_id,participant_id,provider_binding,status,reason,actor_key_id,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,now()+($8::int*interval '1 second')) RETURNING *`,
      [
        id('hlt'),
        merchant,
        input.participant_id,
        p.provider_binding,
        input.status,
        input.reason,
        actor,
        input.valid_for_seconds,
      ],
    )
  ).rows[0];
  return { ...result, mode: 'sandbox', source: 'operator_simulation' };
}
export async function evaluateRoutes(
  c: Client,
  merchant: string,
  amount: string,
): Promise<RoutingDecision> {
  const gross = minor(amount);
  const rows = (
    await c.query(`SELECT n.*,o.priority,
    (n.capacity_minor-COALESCE((SELECT sum(r.amount_minor) FROM network_reservations r WHERE r.corridor_id=n.id AND r.state IN ('held','consumed')),0))::text available_minor
    FROM network_route_options o JOIN network_corridors n ON n.id=o.corridor_id WHERE o.family='nigeria-ngn' ORDER BY o.priority,n.id`)
  ).rows;
  const health = new Map<string, Health>();
  for (const row of rows)
    for (const participant of [row.origin_id, row.settlement_id, row.destination_id])
      if (!health.has(participant))
        health.set(participant, await participantHealth(c, merchant, participant));
  const candidates: Candidate[] = rows.map((row) => {
    const signals = [row.origin_id, row.settlement_id, row.destination_id].map((p) =>
      health.get(p)!,
    );
    const reason = !row.enabled
      ? 'corridor_disabled'
      : signals.some((h) => h.status !== 'healthy')
        ? 'participant_health'
        : BigInt(row.available_minor) < gross
          ? 'corridor_capacity'
          : null;
    return {
      corridor_id: row.id,
      destination_participant_id: row.destination_id,
      priority: row.priority,
      eligible: reason === null,
      reason,
      capacity_minor: String(row.capacity_minor),
      available_minor: row.available_minor,
      health: signals,
    };
  });
  const worstFailure = (r: Candidate) => Math.max(...r.health.map((h) => h.failure_rate_ppm));
  const latency = (r: Candidate) =>
    r.health.reduce((total, h) => total + (h.latency_ms ?? 2147483647), 0);
  const ordered = candidates
    .filter((c) => c.eligible)
    .sort(
      (a, b) =>
        worstFailure(a) - worstFailure(b) ||
        latency(a) - latency(b) ||
        a.priority - b.priority ||
        a.corridor_id.localeCompare(b.corridor_id),
    );
  return {
    mode: 'sandbox',
    strategy: 'healthy_then_acceptance_then_latency_then_priority',
    amount_minor: amount,
    evaluated_at: new Date().toISOString(),
    window_seconds: 300,
    selected_corridor_id: ordered[0]?.corridor_id ?? null,
    candidates,
  };
}
