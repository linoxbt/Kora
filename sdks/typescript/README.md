# @kora/sdk

The TypeScript client targets Node.js 22+ and modern browsers. The source
package is available through the workspace; `pnpm sdk:build` emits ESM and types.
It is not yet published to npm.

```ts
import { Kora, KoraError } from '@kora/sdk';

const kora = new Kora({
  baseUrl: 'http://127.0.0.1:4310',
  apiKey: process.env.KORA_API_KEY,
});
const customer = await kora.createCustomer({name: 'Nairobi recipient'}, crypto.randomUUID());
const instrument = await kora.createInstrument(customer.id, {
  type: 'mobile_money', asset: 'KES', label: 'Sandbox wallet',
  sandbox_identifier: 'sandbox:recipient-wallet',
}, crypto.randomUUID());
const quote = await kora.createQuote({
  source_asset: 'NGN', destination_asset: 'KES', amount_minor: '1600000',
}, crypto.randomUUID());
const intent = await kora.createIntent({
  quote_id: quote.id, customer_id: customer.id,
  destination_instrument_id: instrument.id, reference: 'Invoice 1043',
  type: 'transfer', scenario: 'success',
}, crypto.randomUUID());
console.log(await kora.getIntent(intent.id));
```

Amounts are integer strings. NGN/KES/GHS use scale 2; simulated USDC uses scale 6.
The quote source amount includes the fee. Mutations require stable idempotency
keys: reuse the same key and exact body after an uncertain network result. Changed
bodies conflict. The client has a configurable 15-second timeout and performs
no automatic mutation retries. `KoraError` exposes status, code and requestId.

Cursor iteration is available for paged resources:

```ts
for await (const payment of kora.paginate(kora.listIntents, {limit: '100'})) {
  console.log(payment.reference, payment.state);
}
```

For the console only, omit `apiKey` and supply the session's `csrfToken`.
The client sends credentials with requests. Server integrations should use a
key stored in their server environment, never browser storage.

Verify webhook signatures in Node using the unmodified raw request body:

```ts
import { verifyWebhook } from '@kora/sdk/webhooks';
if (!verifyWebhook(rawBody, signatureHeader, endpointSecret)) {
  throw new Error('Invalid signature');
}
```

Deduplicate events by ID. A webhook replay retains the ID and may deliver again.
The generated `components`, `operations`, and `paths` types are exported for
applications that need the complete OpenAPI contract.

## Paystack test-mode local rail

The server must configure its own `PAYSTACK_SECRET_KEY`. The SDK uses a Kora API
key; never send a provider secret to a browser.

```ts
const enquiry = await kora.resolveBank({
  bank_code: '058', account_number: '0001234567',
}, crypto.randomUUID());
const bank = await kora.createBankAccount(customer.id, {
  resolution_id: enquiry.id, label: 'NGN beneficiary',
}, crypto.randomUUID());
const payout = await kora.createLocalPayout({
  customer_id: customer.id, destination_instrument_id: bank.instrument_id,
  amount_minor: '100000', reference: 'Domestic NGN test',
}, crypto.randomUUID());
const collection = await kora.createCollection({
  customer_id: customer.id, amount_minor: '100000', email: 'payer@example.test',
}, crypto.randomUUID());
```

Use provider-supported test account details when connecting to Paystack; the
example account above belongs to the local harness. Poll `getCollection` for its
checkout URL and verified outcome. `verifyCollection`, `verifyLocalPayout`,
`releaseCollection`, compliance decisions and statement runs expose explicit
scoped controls. Event `data` is an Intent-or-Collection union: narrow by
`data.object` before reading intent-specific fields. See the
[Phase 3 guide](../../docs/phase-3-paystack.md) for accounting, callback and binding
semantics, and the external provider validation gate.


## Stellar Testnet

Version 0.4 adds `getStellarStatus`, `getStellarChallenge`, `createStellarAccount`,
`listStellarAccounts`, `createStellarPurchase`, `verifyStellarDeposit`,
`listStellarDeposits`, `redeemStellarBalance` and `listStellarRedemptions`.
KUSD uses 7 decimals. The separate USDC flow remains simulated.

Sign the decoded challenge bytes with the customer wallet before registering
its address. Every mutation takes a stable idempotency key. No signer secret or
Paystack credential is sent through this SDK.

```ts
const status = await kora.getStellarStatus();
const purchase = await kora.createStellarPurchase({
  customer_id: customer.id,
  destination_instrument_id: verifiedWallet.instrument_id,
  amount_minor: '160000',
  reference: 'Testnet delivery',
}, crypto.randomUUID());
// Total includes the 0.5% Kora fee; fixture FX is 1600 NGN per KUSD.
// Follow purchase.id until authoritative network evidence matches.
```

Events can now carry Stellar deposit or redemption data in addition to intents
and collections; branch on the event type. Operation detail includes public
saved Stellar hashes and sequence numbers, never signer secrets or signed XDR.
See [Phase 4](../../docs/phase-4-stellar.md) for exact accounting and remaining
partner configuration gates.
