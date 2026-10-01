# Phase 6: Nigeria sandbox network

The first executable route follows the selected Nigeria/NGN sandbox scope:
**NGN source conversion → simulated KUSD settlement → NGN destination payout**.
It uses the existing merchant balance, hold, intent, outbox, receipt, webhook,
controls, and reconciliation engine. These participants are durable simulators.
This route does not call Paystack or broadcast Stellar transactions. Phase 4's
separate Testnet connector remains available through its existing endpoints.

The Kenya/KES registry entry and corridor are disabled templates. A second
country/provider has not been selected or validated. This delivery is the local
Phase 6 foundation; the original cross-border exit criterion remains pending.

## API and console

Open `/app/network` after sandbox onboarding. Add a sandbox NGN bank recipient,
choose an amount in kobo and a scenario, get a quote, and start the route.
The timeline shows each saved instruction, participant binding, provider receipt,
and stage journal. Transactions and operations show the parent intent and source
hold. Payment read/write scopes protect registry/plan reads and quote/intent
creation; recipient creation requires customer permissions, and recovery requires
operations write permission.

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/network` | Participants, enabled corridors, sandbox capacity |
| `POST /v1/network/quotes` | Frozen three-step quote and immutable route plan |
| `POST /v1/network/intents` | Reserve source funds and corridor budget atomically |
| `GET /v1/network/plans` | Latest 100 owned plans |
| `GET /v1/network/plans/:id` | Frozen route, leg states, receipts and journals |
| `POST /v1/operations/intents/:id/recover` | Existing recovery of the saved intent |

The TypeScript SDK exposes `getNetwork`, `createNetworkQuote`,
`createNetworkIntent`, `listNetworkPlans`, and `getNetworkPlan`. Every mutation
requires an idempotency key. The UI saves the original request and key when a
response is lost. Changed bodies cannot reuse a key. A quote funds one intent.
All amounts are decimal strings calculated with bigint. The quote includes a
rounded-up 0.5% NGN fee and a fixed **simulated** NGN/KUSD rate; this is not a
partner FX quote. Quotes expire after five minutes.

## Acceptance and recovery

Each leg instruction is saved before simulator acceptance, including participant
binding, amounts, beneficiary, parent instruction, and source hold. The simulator
atomically saves its movement receipt and balanced stage journal. Unique leg
positions and immutable movements prevent duplicate acceptance on replay.
Stage journals use dedicated `network_settled`/`network_in_transit` accounts so
they do not duplicate the parent engine's clearing/funding entries. Stage accounts
are simulation audit positions, not statements of provider cash or custody.

A settlement timeout persists acceptance before losing the acknowledgement.
Recovery looks up existing receipts and sends only the remaining payout leg.
The same behavior applies after a process crash between acceptance and local
acknowledgement. Three confirmed receipts are required before the parent receipt
captures the source hold. Existing accepted steps never switch to another provider.

A destination rejection after earlier acceptance keeps the intent unknown, the
source hold reserved, and capacity held. Repeated recovery reads the same rejection;
it never refunds a partially executed route. An operator must resolve the partial
route against external evidence before any future compensating workflow can be
implemented. This phase does not implement automatic compensation or force-close.

Emergency pause blocks dispatch of remaining legs. Status lookup can still record
known acceptance. The existing independent staging-resume requirements remain in
force: unresolved partial routes can block resume. No route-specific exception
bypasses those controls. Quote expiry before submission releases the source hold
and capacity; expiry after possible acceptance retains both for review.

## Sandbox capacity

Capacity is a shared gross-source admission budget, serialized on the corridor
row. Held and consumed reservations both count against it. Successful routes
consume the budget; cancellation or expiry before submission releases it. It is
not a replenishing liquidity account. The default Nigeria budget is NGN 1,000,000.
Templates can be inspected but remain disabled. Binding changes or participant
holds prevent admission against a previously frozen plan.

## Validation and remaining gates

`pnpm test:network` covers immutable quotes/receipts, tenant isolation, concurrent
admission and budget fencing, success, accepted timeouts, a separate-process crash,
partial rejection, emergency pause, cancellation, forbidden fallback, expiry,
exact amounts above JavaScript's integer range, and ledger invariants.
`pnpm test:browser:network` includes route completion, lost-response retry, and a mobile
partial-rejection timeline. `pnpm smoke:phase6` writes a local real-HTTP/SDK proof
without exposing credentials.

Local validation passed: 13 core/signer tests, 133 PostgreSQL/API integration
tests (including 12 network cases), and 20 browser cases across the base, rail,
Stellar, and controls suites: **166 distinct tests**. The route completion browser
assertion was corrected to match the console's existing “Completed” label and
passed on rerun. Typecheck, generated-contract drift, SDK/dashboard builds, and
frozen offline dependency installation passed. The HTTP/SDK rehearsal persisted
three receipts after a settlement process crash, one parent receipt and one
capacity reservation, then independently recovered an accepted timeout. Proof is
stored privately in `.sandbox/phase6-evidence.json`. These are local results;
remote CI and real-provider cross-border completion are not claimed.

A real second-country rail, partner FX/liquidity, production custody, Paystack test
credentials, cross-border legal/partner assurance, and provider cash reconciliation
remain external gates. Registry `external_validated` stays false; live mode is
unavailable. No simulator result satisfies the cross-border production criterion.

## Phone development preview

Run `pnpm dev` with `KORA_DEV_PORT` set (default 5176), then point a temporary
Cloudflare Tunnel at `http://127.0.0.1:5176`. Set the exact tunnel hostname in
`KORA_PREVIEW_HOST` and append its HTTPS origin to `KORA_CONSOLE_ORIGINS`, then
restart the dev servers. Open the tunnel's `/connect` URL on the phone and tap
**Start sandbox**, then open **Network** in the mobile menu.

The dev server proxies the API on the same origin. Console cookies are Secure,
HttpOnly and SameSite Strict on HTTPS. Vite permits only the specific preview host
and required source directories; private `.env`, `.sandbox`, and Git files are
blocked. The tunnel URL is temporary and works while both processes are running.
Use only sandbox information in a public development preview.

The public development preview was additionally verified through HTTPS at a
390-pixel viewport: sandbox onboarding, recipient creation, delayed-settlement
recovery, three leg receipts and consumed capacity, Secure/HttpOnly/Strict cookies,
no browser storage of credentials, and explicit rejection of private file paths.
Run `pnpm preview:check` with the configured temporary hostname to repeat it.
