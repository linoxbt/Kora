# Phase 7: Nigerian sandbox routing

Kora now has two executable Nigerian sandbox payout participants. Both use the
existing three-leg intent engine and durable simulator receipts. The source and
KUSD settlement participants are shared; the primary and alternate payout
participants have separate immutable bindings and corridor admission budgets.
Kenya remains disabled. These are simulated provider choices, not bank/provider
connectivity or verified cross-border liquidity.

## Selection and evidence

`GET /v1/network/routing?amount_minor=160000` evaluates the Nigeria/NGN route
family. Each candidate includes eligibility, remaining gross-source budget,
participant health, receipt sample counts, rejection rate, measured simulator
latency, signal source, and observation expiry.

A route must be enabled, have all participants healthy, and have enough capacity.
Eligible routes are ordered by their highest participant rejection rate, then the
sum of participant simulator latencies, configured priority, and corridor ID.
Missing latency ranks behind measured latency. No receipt samples are presented
as registry-only health with null latency, never as measured provider performance.
All metrics use this merchant's receipts from the preceding five minutes and the
exact current provider binding. They describe simulator acceptance, not external
transport latency, provider cash, or success of a real bank transaction.

`POST /v1/network/quotes` accepts `corridor_id: "auto"` to freeze the selected
route. Its response and immutable plan snapshot include the complete selection
evidence. Explicit `ng-ng-sandbox` and `ng-ng-alternate` quotes remain supported.
Quotes reserve neither funds nor capacity. Admission rechecks health, binding,
and available budget inside the transaction that creates the original source
hold and intent. If conditions changed, it rejects atomically. A caller can then
request a fresh quote; the old plan is never edited or quietly replaced.

The SDK adds `getNetworkRouting(amount_minor)` and
`recordNetworkHealth(body, idempotencyKey)`. The browser Network page supports
automatic/explicit preferences, current route eligibility and metrics, frozen
selection evidence, and a workspace-scoped outage rehearsal.

## Sandbox health controls

`POST /v1/network/health` requires `operations:write` and an idempotency key:

```json
{
  "participant_id": "nigeria-payout-sandbox",
  "status": "unavailable",
  "reason": "Sandbox outage rehearsal",
  "valid_for_seconds": 300
}
```

Valid statuses are healthy, degraded, and unavailable. Duration is 10–300 seconds.
Overrides are append-only and bound to the authenticated merchant, actor key,
and exact participant binding. One merchant's scenario does not affect another.
The latest override takes precedence over receipt-derived health. An expired
or differently bound override is unknown and blocks new dispatch until refreshed;
expiry never silently removes an outage hold. Global participant disable and
unsupported bindings always block dispatch, including when an override says
healthy. The UI labels these controls as simulations and shows signal provenance.

Receipt failures also mark the participant degraded while they remain within
the five-minute measurement window. Operators can record a fresh healthy scenario
for a recovered simulator; existing rejection-rate measurements still affect
ranking. The route family is explicitly configured, so disabled country templates
and integration-test corridors cannot become automatic candidates.

## Recovery and fallback boundary

Fallback happens during quote selection before the provider choice is frozen.
After admission, every leg keeps the saved participant and binding. Immediately
before each new simulated acceptance, the connector rechecks merchant-scoped
health while holding a shared advisory transaction lock. A health mutation takes
the matching exclusive lock, waiting for an acceptance already in flight. Once
an outage update is acknowledged, later acceptance requires fresh healthy status.
The existing merchant emergency-pause lock and staging/compliance controls remain
in force.

Known receipts are read regardless of present health. Fully accepted routes can
complete their parent receipt and capture while a provider is unavailable.
A partially accepted route keeps its source hold and corridor reservation, and
never substitutes the alternate provider. Restoring the original participant's
health lets recovery continue the original remaining steps without repeating
accepted ones. A confirmed payout rejection retains funds for reconciliation;
health restoration does not erase a rejection or provide compensation.

The simulator may persist an unaccepted leg instruction before discovering an
outage. Its state can be unknown with no receipt. That is a saved instruction,
not evidence that funds moved. The timeline distinguishes receipt outcomes from
pending instructions. Operator-directed compensation and real-provider fallback
remain future work, subject to authoritative evidence and control approvals.

## Recovery scheduling

Requested recoveries use outbox priority 2, newly admitted payments priority 1,
and background retries priority 0. An operator recovery refreshes availability
and fences any previous lease token; an older worker acknowledgement cannot
remove or defer the new request. The intent advisory lock and provider deduplication
still protect against duplicate execution. A background attempt returns to normal
backoff after its first try, preventing an unresolved intent from retaining priority.

Continuous workers run payment execution, rail verification, and webhook delivery
in independent loops. Slow webhook IO does not stop payment/status recovery.
Each loop retains its existing single-consumer lease behavior. Shutdown and errors
stop new work and wait for in-flight operations before closing the pool. The
`--once` command preserves sequential payment, rail, and webhook processing.

Four queue regressions verify priority ahead of older retry jobs, fencing of an
active acknowledgement, payment progress while delivery is blocked, and waiting
for in-flight IO on an error. They run in the integration suite.

## Local verification

The local validation run passed 186 tests: 13 core/signer tests, 151 integration
tests, and 22 browser tests across the product, network, rail, Stellar, and control
fixtures. `pnpm build`, the generated-contract check, frozen-lockfile installation,
and both Phase 6 and Phase 7 HTTP/SDK smoke checks also passed. Browser provider
fixtures remain simulations; these results do not validate external provider cash.
The public HTTPS preview check also passed at a 390-by-844 mobile viewport: the
alternate route recovered its timeout with three confirmed simulated receipts,
secure session cookies, private files blocked, and no horizontal overflow.

`pnpm test:routing` exercises deterministic selection, immutable evidence,
alternate execution and deduplication, no-route behavior, actual receipt-derived
degradation/latency, capacity and health changes after quoting, accepted timeout
recovery without provider substitution, known acceptance under outage, stale
observations, merchant/actor isolation, scoped idempotent health updates, and
binding changes. These cases also run in `pnpm check`.

`pnpm smoke:phase7` uses the real HTTP API and typed SDK for an unavailable-primary
selection, alternate execution, and an accepted primary timeout followed by an
outage hold and restoration. It checks one reservation and parent receipt per
intent, preserved accepted-step references, and financial invariants. Evidence
and credentials remain in separate private `.sandbox/phase7-*.json` files.

`pnpm test:browser:network` adds mobile outage/alternate execution and a two-tab test where
health changes after a frozen quote. `pnpm preview:check` verifies the temporary
HTTPS phone preview, scoped outage controls, alternate routing with timeout
recovery, final capacity consumption, secure cookies, no credential browser
storage, private-file blocking, and no horizontal overflow.

## External gates

The Phase 7 local simulator foundation is implemented. Its original real-routing
exit criterion remains pending: real approved executable providers, fresh
provider health and liquidity feeds, partner FX, custody/legal/security assurance,
full provider cash reconciliation, and second-country validation. No live key or
payment is used. `external_validated` remains false. Phase 6's cross-border gate
also remains open; a second Nigerian simulator is not a second-country rail.

The network browser suite has a separate server fixture from baseline product
tests. Five rapid network workspaces plus baseline onboarding otherwise exceed
the public five-workspaces-per-minute limit. The production rate limit stays
unchanged; each suite runs against a fresh server.
