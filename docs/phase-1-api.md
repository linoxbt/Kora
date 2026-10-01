# Phase 1 API and worker

This API is a sandbox payment engine. Rates, liquidity, identity verification,
local rails, and Stellar delivery are simulated. It has no live provider keys or
network signer. The product is Kora across supported sandbox assets.

## Setup and authentication

Follow the root README. `pnpm sandbox:init` generates encryption/callback keys
into the ignored `.env` with private file permissions and preserves existing
keys. `pnpm sandbox:create --output .sandbox/credentials.json` creates a new
merchant, funds NGN/USDC fixtures through the ledger, and writes a private API key
file. Choose a different output path when creating another merchant.

The API key secret is only returned during provisioning; PostgreSQL stores its
SHA-256 hash. Each key carries read/write scopes for payments, customers, and
webhooks. The internal `issueApiKey` function can provision a narrower key.
Revoked keys cannot authenticate. Live keys and non-sandbox runtime modes are
rejected.

Requests use these headers:

```http
Authorization: Bearer kora_test_<secret>
Idempotency-Key: order-001
Content-Type: application/json
```

The idempotency header is required on every public POST. Its namespace contains
the merchant, method, route, and resource parameters. Equivalent JSON object key
ordering returns the original response; different validated request contents
return `409 idempotency_conflict`. A replay includes
`Idempotency-Replayed: true`. The original response is preserved even when the
underlying intent later advances. Read the intent for its current state.

Every response includes `X-Request-Id`. Errors have
`error.type`, `error.code`, `error.message`, and `error.request_id`. Validation
uses 400, missing/invalid keys use 401, scopes use 403, resource ownership failures
use 404, conflicts use 409, financial/compliance rejection uses 422, and rate
limits use 429. The API defaults to 300 requests per minute per IP.

## Create a sandbox payment

1. `POST /v1/customers` with `{"name":"Sandbox recipient"}`. The result includes
   a `cus_...` ID and explicitly simulated verification state.
2. `POST /v1/customers/:id/instruments` with:

   ```json
   {
     "type": "stellar_account",
     "asset": "USDC",
     "label": "Recipient account",
     "sandbox_identifier": "sandbox:stellar:recipient"
   }
   ```

   Save the `inst_...` ID. Local assets use `bank_account` or `mobile_money`.
   Instrument identifiers must use the sandbox prefix; no real account data is
   required.
3. `POST /v1/quotes` with:

   ```json
   {
     "source_asset": "NGN",
     "destination_asset": "USDC",
     "amount_minor": "160000"
   }
   ```

   This fixture quote funds NGN 1,600, charges NGN 8, and delivers simulated
   USDC 0.995. Quotes expire after five minutes and can fund only one intent.
4. `POST /v1/intents` with the returned resource IDs:

   ```json
   {
     "quote_id": "qte_<id>",
     "customer_id": "cus_<id>",
     "destination_instrument_id": "inst_<id>",
     "type": "asset_purchase",
     "reference": "order-001",
     "scenario": "success"
   }
   ```

   `transfer` is the default type. `asset_purchase` requires USDC delivery;
   `asset_redemption` requires USDC funding. An instrument must belong to the
   specified customer and merchant and support the destination asset.
5. Run the worker and poll `GET /v1/intents/:id`. It returns source/destination
   amounts, explicit source fee, current state, route snapshot, and history.

The sandbox transaction cap is configured per merchant as source minor units;
it is not a cross-currency USD-normalized limit. Quotes are illustrative fixed
rates. The route snapshot is descriptive; one fake provider fulfills the
simulated movement in Phase 1.

## Lifecycle and recovery

`processing` means funds are reserved and the worker has work to do.
`unknown` retains the reservation while a possibly accepted instruction is
recovered. `succeeded` requires exact matching provider evidence and journaled
source/destination assets. `failed` releases the reservation only on a confirmed
rejection or expiry before possible submission. `canceled` is available before
instruction creation. The broader model recognizes `returned`, but provider
return workflows are not exposed in this phase.

Supported scenarios:

| Scenario | Behavior |
| --- | --- |
| `success` | One movement, matched receipt, capture, success event |
| `timeout` | Provider commits acceptance, acknowledgement is lost, intent becomes unknown, later status lookup settles it |
| `insufficient_float` | Durable provider rejection, released reservation, failed event |

The worker claims jobs with expiring leases and uses a per-intent advisory lock.
Instructions and immutable request snapshots exist before any external call.
After a crash, it checks the original instruction's status. It can resend the
same instruction key only when the connector guarantees external idempotency
and no known outcome exists. Otherwise it retains funds and opens reconciliation.

Quote expiry after a possible submission cannot release funds. Already-confirmed
evidence is reconciled even if the quote has since expired. Disabled merchants
and held/unverified beneficiaries block new submission; known external outcomes
must still be accounted for.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Database-backed API health |
| GET | `/v1/me` | Merchant, mode, enabled status and source cap |
| GET | `/v1/assets` | Explicit sandbox asset registry |
| GET | `/v1/balances` | Available/reserved ledger balances |
| POST / GET | `/v1/customers` | Create/list customers |
| GET | `/v1/customers/:id` | Read owned customer |
| POST / GET | `/v1/customers/:id/instruments` | Create/list owned instruments |
| POST | `/v1/quotes` | Create immutable quote |
| GET | `/v1/quotes/:id` | Read owned quote |
| POST / GET | `/v1/intents` | Create/list intents |
| GET | `/v1/intents/:id` | Intent and lifecycle history |
| POST | `/v1/intents/:id/cancel` | Cancel before execution starts |
| GET | `/v1/events` | List owned immutable events |
| POST / GET | `/v1/webhook_endpoints` | Register/list endpoints |
| POST | `/v1/webhook_endpoints/:id/disable` | Disable future deliveries |
| GET | `/v1/webhook_deliveries` | Recent delivery status/attempts |
| POST | `/v1/events/:id/replay` | Queue a stable event ID again |

Collection pagination accepts `limit` (1–100, default 25) and `after`; responses
include `data`, `has_more`, and `next_cursor`. Delivery logs currently expose only
the most recent `limit` records.

## Webhooks

Configure `KORA_WEBHOOK_ALLOWED_ORIGINS` as a comma-separated exact origin
allowlist. The default is `http://127.0.0.1:4311`. Register a URL such as
`http://127.0.0.1:4311/events`; the creation response returns its signing secret.
Persist it privately. It is omitted from list responses and encrypted in the
database and idempotency cache.

Set `KORA_RECEIVER_SECRET` to that secret and run `pnpm webhook:receiver` for the
local example. The receiver verifies raw bodies and deduplicates events during
its process lifetime. Real integrators must persist deduplication durably.

Delivery includes `Kora-Signature: t=<unix_seconds>,v1=<hex_hmac>` and
`X-Kora-Event-Id`. HMAC-SHA256 signs `<timestamp>.<raw_body>`.
`verifyWebhook` rejects signatures more than five minutes old or in the future.
Only a 2xx response counts as delivered. Calls time out after five seconds,
redirects are not followed, retries use exponential backoff, and eight failed
attempts mark a delivery failed. Replay resets attempts while preserving event ID.
Deliveries are at-least-once, including after worker crashes.

The internal fake-provider callback is
`POST /internal/providers/fake/callback`. It uses the same signature format with
`KORA_PROVIDER_CALLBACK_SECRET`. The engine checks the signed payload against
the simulator's durable evidence, then matches instruction, hold, asset identity,
issuer/network, amounts, fee, instrument and beneficiary before journal posting.
Duplicate callbacks do not duplicate receipts, accounting or success events.

## Validation and next phase

Run `pnpm check` and `pnpm smoke:phase1`. Tests exercise PostgreSQL, HTTP
injection, real loopback webhook receivers, concurrency, transactional faults,
and actual worker-process termination at five execution checkpoints.

The [Phase 2 product](phase-2-product.md) adds the web consoles, hosted sandbox
flow, generated OpenAPI/SDK, and operations visibility. Live bank integrations, production compliance/custody,
Stellar signing, and multi-provider route execution remain subsequent phases.
