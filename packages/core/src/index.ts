import { createHmac, timingSafeEqual } from 'node:crypto';

export const assets = [
  {
    id: 'XLM',
    positionId: 'pos_xlm_test',
    code: 'XLM',
    name: 'Testnet network fee',
    scale: 7,
    country: 'ST',
    flag: '◎',
    kind: 'stellar',
    rail: 'Treasury fees only',
    network: 'testnet',
    issuer: 'native',
    usdNumerator: '1',
    usdDenominator: '1',
  },
  {
    id: 'KUSD',
    positionId: 'pos_kusd_test',
    code: 'KUSD',
    name: 'Kora Test USD',
    scale: 7,
    country: 'ST',
    flag: '◎',
    kind: 'stellar',
    rail: 'Stellar Testnet',
    network: 'testnet',
    issuer: 'configured-kora-test-issuer',
    usdNumerator: '1',
    usdDenominator: '1',
  },
  {
    id: 'NGN',
    positionId: 'pos_ngn_fiat',
    code: 'NGN',
    name: 'Nigerian naira',
    scale: 2,
    country: 'NG',
    flag: '🇳🇬',
    kind: 'fiat',
    rail: 'Bank transfer',
    usdNumerator: '1',
    usdDenominator: '1600',
  },
  {
    id: 'KES',
    positionId: 'pos_kes_fiat',
    code: 'KES',
    name: 'Kenyan shilling',
    scale: 2,
    country: 'KE',
    flag: '🇰🇪',
    kind: 'fiat',
    rail: 'Mobile money',
    usdNumerator: '1',
    usdDenominator: '130',
  },
  {
    id: 'GHS',
    positionId: 'pos_ghs_fiat',
    code: 'GHS',
    name: 'Ghanaian cedi',
    scale: 2,
    country: 'GH',
    flag: '🇬🇭',
    kind: 'fiat',
    rail: 'Bank transfer',
    usdNumerator: '1',
    usdDenominator: '15',
  },
  {
    id: 'USDC',
    positionId: 'pos_usdc_sim',
    code: 'USDC',
    name: 'USD Coin',
    scale: 6,
    country: 'ST',
    flag: '◎',
    kind: 'stellar',
    rail: 'Stellar • simulated',
    network: 'sandbox',
    issuer: 'kora-simulated-usdc',
    usdNumerator: '1',
    usdDenominator: '1',
  },
] as const;
Object.freeze(assets);
assets.forEach(Object.freeze);
export type AssetId = (typeof assets)[number]['id'];
export interface AssetIdentity {
  id: AssetId;
  kind: 'fiat' | 'stellar';
  network?: string;
  issuer?: string;
}
export function assetIdentity(code: AssetId): AssetIdentity {
  const definition = asset(code);
  return definition.kind === 'stellar'
    ? { id: code, kind: 'stellar', network: definition.network, issuer: definition.issuer }
    : { id: code, kind: 'fiat' };
}
export type IntentState =
  'processing' | 'unknown' | 'succeeded' | 'failed' | 'canceled' | 'returned';
export type Scenario = 'success' | 'timeout' | 'insufficient_float' | 'returned';
export function asset(id: string) {
  const found = assets.find((a) => a.id === id);
  if (!found) throw new Error('Unsupported asset');
  return found;
}
export function assetPositionId(id: AssetId): string {
  return asset(id).positionId;
}
export function minor(value: string): bigint {
  if (!/^(0|[1-9]\d{0,23})$/.test(value))
    throw new Error('Amount must be an unsigned integer string');
  return BigInt(value);
}
export function parseAmount(value: string, id: AssetId): string {
  const { scale } = asset(id);
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`).test(value))
    throw new Error(`Use at most ${scale} decimal places`);
  const [whole, fraction = ''] = value.split('.');
  return minor(
    (BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0'))).toString(),
  ).toString();
}
export class Money {
  readonly minor: bigint;
  constructor(
    readonly asset: AssetId,
    amount: string | bigint,
  ) {
    assetRegistry(asset);
    this.minor = minor(amount.toString());
    Object.freeze(this);
  }
  add(other: Money) {
    this.same(other);
    return new Money(this.asset, this.minor + other.minor);
  }
  sub(other: Money) {
    this.same(other);
    return new Money(this.asset, this.minor - other.minor);
  }
  cmp(other: Money): -1 | 0 | 1 {
    this.same(other);
    return this.minor < other.minor ? -1 : this.minor > other.minor ? 1 : 0;
  }
  private same(other: Money) {
    if (other.asset !== this.asset) throw new Error('Asset mismatch');
  }
  toJSON() {
    return { asset: this.asset, minor: this.minor.toString() };
  }
}
const assetRegistry = asset;
export function calculateQuote(source: AssetId, destination: AssetId, amount: string) {
  const from = asset(source),
    to = asset(destination),
    total = minor(amount);
  if (source === destination) throw new Error('Choose different source and destination assets');
  if (total <= 0n) throw new Error('Amount must be greater than zero');
  // Fee rounds up; conversion rounds down. No floating point enters accounting.
  const fee = (total * 50n + 9999n) / 10000n;
  const delivered =
    ((total - fee) *
      BigInt(from.usdNumerator) *
      BigInt(to.usdDenominator) *
      10n ** BigInt(to.scale)) /
    (BigInt(from.usdDenominator) * BigInt(to.usdNumerator) * 10n ** BigInt(from.scale));
  if (delivered <= 0n) throw new Error('Amount is too small after fees');
  return {
    source_asset: source,
    destination_asset: destination,
    source_minor: total.toString(),
    destination_minor: delivered.toString(),
    fee_minor: fee.toString(),
  };
}
export function routeFor(source: AssetId, destination: AssetId) {
  return [
    { name: `${asset(source).code} funding`, rail: asset(source).rail, asset: source },
    { name: 'Kora conversion', rail: 'Reserved sandbox liquidity', asset: source },
    { name: 'Stellar settlement', rail: 'Simulated USDC settlement', asset: 'USDC' },
    {
      name: `${asset(destination).code} delivery`,
      rail: asset(destination).rail,
      asset: destination,
    },
  ];
}
export function canTransition(from: IntentState, to: IntentState) {
  const graph: Record<IntentState, IntentState[]> = {
    processing: ['unknown', 'succeeded', 'failed', 'canceled', 'returned'],
    unknown: ['succeeded', 'failed', 'returned'],
    succeeded: ['returned'],
    failed: [],
    canceled: [],
    returned: [],
  };
  return graph[from].includes(to);
}
export function signWebhook(
  body: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  return `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}
export function verifyWebhook(
  body: string,
  signature: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
) {
  const match = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(signature);
  if (!match || Math.abs(now - Number(match[1])) > 300) return false;
  const expected = signWebhook(body, secret, Number(match[1])).split('v1=')[1];
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(match[2], 'hex'));
}
