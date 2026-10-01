import type { FastifyInstance } from 'fastify';
import { id, pool, transaction } from '../../../packages/database/src/index.js';
import { createMerchant, sandboxFund } from '../../../packages/ledger/src/index.js';
import { issueApiKey, allScopes, type Principal } from '../../../packages/payments/src/auth.js';
import { processIntent, createIntent, createQuote } from '../../../packages/payments/src/index.js';
import type { AssetId } from '../../../packages/core/src/index.js';
export async function provisionWorkspace(app: FastifyInstance, name: string): Promise<Principal> {
  const merchant = id('mcht');
  await createMerchant(merchant, name);
  for (const [asset, amount] of [
    ['NGN', '250000000'],
    ['USDC', '8000000000'],
    ['KES', '75000000'],
    ['GHS', '1200000'],
  ] as const)
    await sandboxFund(merchant, asset, amount, `${merchant}:fixture:${asset}`);
  const key = await issueApiKey(merchant, 'Console workspace administrator');
  async function post(path: string, body: unknown) {
    const response = await app.inject({
      method: 'POST',
      url: path,
      headers: { authorization: `Bearer ${key.secret}`, 'idempotency-key': id('seed') },
      payload: body as Record<string, unknown>,
    });
    if (response.statusCode !== 201) throw new Error('Sandbox provisioning failed');
    return response.json();
  }
  const samples = [
    {
      name: 'Nairobi Supply',
      source: 'NGN',
      destination: 'KES',
      amount: '16000000',
      reference: 'Invoice NS-1042',
      scenario: 'success',
    },
    {
      name: 'Lagos Studio',
      source: 'USDC',
      destination: 'NGN',
      amount: '350000000',
      reference: 'Studio settlement',
      scenario: 'success',
    },
    {
      name: 'Accra Labs',
      source: 'NGN',
      destination: 'GHS',
      amount: '8000000',
      reference: 'Partner payout',
      scenario: 'success',
    },
    {
      name: 'Atlas Treasury',
      source: 'NGN',
      destination: 'USDC',
      amount: '24000000',
      reference: 'Treasury conversion',
      scenario: 'success',
    },
    {
      name: 'Nairobi Supply',
      source: 'KES',
      destination: 'USDC',
      amount: '1300000',
      reference: 'Balance conversion',
      scenario: 'success',
    },
    {
      name: 'Accra Labs',
      source: 'GHS',
      destination: 'USDC',
      amount: '150000',
      reference: 'Sandbox liquidity test',
      scenario: 'insufficient_float',
    },
    {
      name: 'Lagos Studio',
      source: 'USDC',
      destination: 'NGN',
      amount: '125000000',
      reference: 'Acknowledgement recovery',
      scenario: 'timeout',
    },
  ];
  const customerIds = new Map<string, string>();
  for (const sample of samples) {
    let customer = customerIds.get(sample.name);
    if (!customer) {
      customer = (await post('/v1/customers', { name: sample.name })).id;
      customerIds.set(sample.name, customer!);
    }
    const instrument = await post(`/v1/customers/${customer}/instruments`, {
      asset: sample.destination,
      type:
        sample.destination === 'USDC'
          ? 'stellar_account'
          : sample.destination === 'KES'
            ? 'mobile_money'
            : 'bank_account',
      label: sample.name,
      sandbox_identifier: `sandbox:${sample.destination}:${customer}`,
    });
    const intent = await transaction(async (c) => {
      const quote = await createQuote(c, merchant, {
        source_asset: sample.source as AssetId,
        destination_asset: sample.destination as AssetId,
        amount_minor: sample.amount,
      });
      const intent = await createIntent(c, merchant, {
        quote_id: quote.id as string,
        customer_id: customer!,
        destination_instrument_id: instrument.id,
        reference: sample.reference,
        scenario: sample.scenario as 'success' | 'timeout' | 'insufficient_float',
        type: 'transfer',
      });
      // Commit seeding jobs with a future availability time so a running worker
      // cannot race the deterministic simulator setup or erase the unknown fixture.
      await c.query("UPDATE outbox SET available_at=now()+interval '1 hour' WHERE intent_id=$1", [
        intent.id,
      ]);
      return intent;
    });
    await processIntent(intent.id);
    // Keep one real ambiguous simulator outcome available to inspect and recover.
    if (sample.scenario === 'timeout')
      await pool.query(
        "UPDATE outbox SET available_at=now()+interval '1 hour' WHERE intent_id=$1",
        [intent.id],
      );
    else await pool.query('UPDATE outbox SET processed_at=now() WHERE intent_id=$1', [intent.id]);
  }
  return { merchant_id: merchant, key_id: key.id, scopes: [...allScopes] };
}
