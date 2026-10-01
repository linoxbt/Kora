# Phase 4 — Stellar Testnet staging

Kora now executes **KUSD (Kora Test USD)** payments on Stellar Testnet through
its existing Payment Intent worker, reservations, immutable receipts and ledger.
KUSD is an isolated test asset, not USDC or a cash-backed product. The earlier
USDC simulator remains a separate product flow. Production custody, approved
asset issuers and partner FX/liquidity are pending.

## Local configuration

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm stellar:init
pnpm build
pnpm start
# In another terminal:
pnpm worker
```

Setup generates three isolated accounts, funds them with Testnet Friendbot,
creates exact KUSD trustlines and issues fixture treasury liquidity. It stores
keys in ignored `.sandbox/stellar-testnet.json` with mode 0600 and writes only
`STELLAR_TESTNET_ISSUER` and `STELLAR_TESTNET_TREASURY_SECRET` into private `.env`.
The issuer's secret and customer wallet secret stay in the private setup file.
Repeated setup preserves the same accounts. Restart API/worker after changing
configuration. Never expose these files in a frontend bundle or Git.

The connector uses only `https://horizon-testnet.stellar.org`, checks its network
passphrase, and signs with `Networks.TESTNET`. There is no environment override
for a public network or arbitrary Horizon host. Configuration binds the network,
asset code, exact issuer and treasury address. Old records cannot migrate to a
new issuer or treasury automatically. The local signer permits one KUSD payment
under that issuer, bounds the transaction fee/time window and rejects Public
network signing. Its interface can be replaced by a custody signer later; this
local development key is not a production custody implementation.

## Product and API

The console's **Stellar Testnet** page shows the exact issuer and treasury,
wallet verification, purchases, incoming deposits and fixture redemptions.
Operations includes saved hashes and sequences even before settlement, matched
receipts and journals. Keys use the existing customer, payment and operations
scopes. Mutations require a stable `Idempotency-Key` and use the existing encrypted
response cache, cookie/CSRF controls and tenant ownership checks.

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/stellar` | Configuration and explicit fixture FX status |
| `GET /v1/customers/:id/stellar_challenge?address=G…` | Hex ownership challenge |
| `POST /v1/customers/:id/stellar_accounts` | Register address, signature and label |
| `GET /v1/customers/:id/stellar_accounts` | Owned verified wallets |
| `POST /v1/stellar/purchases` | Reserve total NGN and queue KUSD delivery |
| `POST /v1/stellar/deposits` | Verify and credit one incoming transaction |
| `GET /v1/stellar/deposits` | Owned confirmed deposit receipts |
| `POST /v1/stellar/redemptions` | Convert credited KUSD into fixture NGN |
| `GET /v1/stellar/redemptions` | Owned conversion journals |

The TypeScript SDK exposes corresponding methods. All routes and concrete
responses are included in generated OpenAPI and SDK types.

Sign the **decoded challenge bytes**, not the UTF-8 hex string, with the customer
wallet. The challenge binds merchant, customer, address and provider configuration.
A customer account must have an authorized trustline to the exact issuer. One
address/configuration can be attributed to only one merchant/customer. Requests
cannot register the issuer or treasury as a customer wallet. No wallet secret is
accepted by an API endpoint or browser form.

Purchases take the same customer, instrument, total NGN minor amount and reference
fields as local payouts. They reserve NGN; the 0.5% Kora fee rounds up in kobo.
Fixture FX uses **1 KUSD = 1600 NGN**. Delivery rounds down to Stellar's seven
decimals. KUSD uses seven minor-unit decimals; the simulated USDC uses six. XLM is
used only for treasury network-fee accounting and has no trading endpoint.

## Submission and recovery

The worker persists its normal immutable provider instruction first. Under an
account advisory lock, the connector loads current sequence, available treasury
balance, selling liabilities, destination limit, buying liabilities and trustline
authorization. It signs one single-operation payment, verifies the signer's
signature/hash, then commits the XDR, hash, sequence, expiry and binding **before
network submission**. Database triggers prohibit rewriting or deleting it.

Every retry first queries that hash. Submission always uses the same saved XDR;
no new sequence or replacement transaction is signed for that instruction. An
acknowledged or failed transaction must match the expected envelope, hash,
operation, source, destination, exact issuer and amount. A matched successful
receipt captures the hold; a matched failed receipt releases it. Both record the
actual treasury fee in a balanced XLM expense/funding journal. Testnet delivery
has its own balanced KUSD liquidity journal. Reservations and receipts remain
atomic with intent transitions and merchant webhook events.

A lost acknowledgement or unavailable/mismatched status keeps funds reserved and
the intent unknown. The next worker verifies the original hash. One unresolved
treasury sequence blocks signing another payout. This deliberately favors
reconciliation over throughput. An expired, unobserved envelope remains held for
operator investigation; Kora does not infer absence from a single 404, silently
release funds or construct a replacement. Use Operations' recovery action after
restoring access. Fee bumps, multi-signer custody, automated expired-transaction
resolution and higher-throughput sequence lanes are later work.

## Deposit and redemption accounting

A deposit must be a successful Testnet transaction with exactly one KUSD payment
from the registered customer wallet to treasury under the configured issuer.
The transaction hash is globally unique; concurrent or repeated verification
credits the merchant only once. Outbound Kora transactions cannot also fund a
deposit. Held customers/disabled merchants cannot credit a deposit until their
controls are cleared; the on-chain payment remains available to verify later.
The customer's network fee is recorded as evidence, not as a Kora treasury cost.

Credited KUSD can be reserved and captured into clearing, then converted into
fixture NGN funding with an immutable redemption record and balanced NGN journal.
A separate domestic Paystack **test** payout can consume that NGN. These are
explicit staging legs, not an atomic cross-provider route or real cash redemption.
Deposit and redemption events (`stellar.deposit_confirmed`, `stellar.redeemed`)
use the existing durable merchant webhook deliveries. Financial journals cannot
be corrected with the generic reversal helper outside their domain lifecycle.

## Validation and remaining gates

`pnpm smoke:phase4` makes actual Testnet transactions: one NGN-backed KUSD
purchase, a customer-to-treasury deposit, duplicate deposit verification and an
idempotent fixture redemption. It saves public transaction identifiers and ledger
invariants in private `.sandbox/phase4-evidence.json`. Each repeat uses a fresh
merchant/wallet when necessary; it retains prior accounting evidence. The latest
smoke workspace’s Kora API key and identifiers are in private
`.sandbox/phase4-credentials.json`; use that key on the console Connect screen to
inspect the actual round trip. Customer Testnet keys are retained separately in
`.sandbox/wallets/`, also mode 0600. Never share these private files.

Local tests exercise exact seven-decimal encoding, ownership proofs, tenant and
scope isolation, issuer/network/authorization/capacity checks, matched receipts,
failed transactions, lost responses, immutable envelopes, duplicate deposits,
sequence blocking, expiry without replacement, credential changes, fees and
redemption idempotency. CI runs local fixtures; remote Testnet calls are opt-in.

The external Paystack gate is still open. Orion's deployed Paystack credential
is a **live** key. At the user's request it is retained only in private local
`ORION_PAYSTACK_SECRET_KEY`, which no Kora connector reads. `PAYSTACK_SECRET_KEY`
requires an actual `sk_test_…` key. No Orion service was modified and no Paystack
live API payment was sent.

Phase 4's production/partner exit criteria remain open: approved issuer/asset,
real FX quotes and liquidity limits, custody integration, real Paystack sandbox
collection/payout reconciliation and partner-approved staging of both local legs.
The implemented/Testnet-validated scope does not claim those approvals.

References: [Stellar asset issuance](https://developers.stellar.org/docs/tokens/how-to-issue-an-asset),
[trustline verification](https://developers.stellar.org/docs/build/guides/basics/verify-trustlines),
[transactions](https://developers.stellar.org/docs/build/guides/transactions),
[official JavaScript SDK](https://github.com/stellar/js-stellar-sdk).
