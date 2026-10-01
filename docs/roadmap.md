# Kora phased delivery

Each phase must meet its exit criteria before the following phase is called
complete. New capabilities use the same ledger, intent, connector, and
reconciliation model. No separate routing, treasury, or asset service is planned.

| Phase | Deliverable | Exit criteria | Status |
| --- | --- | --- | --- |
| 0 — Financial core | Workspace, money, schemas, ledger, reservations, fake provider, CI | Typecheck, money properties, journal invariants, concurrency, durable fake-provider recovery pass | Implemented; validation recorded below |
| 1 — Payment engine | Merchant/API-key auth, customer/instrument records, Payment Intents, idempotency middleware, transactional outbox, worker, receipts, signed webhook delivery | An authenticated fake transfer survives duplicate requests, callbacks, and worker termination with one external instruction; ledger and domain changes are atomic | Implemented; validation below |
| 2 — Sandbox product | Hosted flow, business/developer console, operations debugger, OpenAPI, TypeScript SDK, developer guides | An integrator completes a sandbox flow through API or UI; failures, unknowns, journals, and webhook replay are visible | Implemented; validation below |
| 3 — First local rail | Licensed Nigerian bank/PSP connector, name enquiry, collection/payout, statement reconciliation, compliance decisions | Provider sandbox flows reconcile; ambiguous timeouts and returns recover without duplicate sends | Implemented locally with Paystack test mode; external sandbox validation pending |
| 4 — Stellar settlement and assets | Exact issuer/network allowlist, Testnet connector, signer boundary, receipts, trustlines, sequence management, partner FX/liquidity | Local-to-Stellar and Stellar-to-local staging flows are fully journaled and reconciled | Testnet staging implemented and network-validated; partner FX/custody and Paystack test-leg gates pending |
| 5 — Production controls and pilot | KYB/KYC/screening, custody integration, security review, runbooks, backups/restores, operations approvals, capped activation | Required legal/partner/security controls are documented and validated; a capped merchant pilot has clean daily reconciliation | Local controls and rehearsal implemented; external assurance and full cash reconciliation pending |
| 6 — Cross-border network | Second African rail, persisted route plans, leg recovery, corridor capacity and participant registry | One local-to-Stellar-to-second-local corridor completes and reconciles through the same engine | Nigeria/NGN simulator foundation implemented; second-country rail and external settlement pending |
| 7 — Routing and expansion | Multiple executable providers, measured route selection, safe fallback, additional participants/corridors | Real route choices use health/liquidity data; ambiguous legs cannot trigger unsafe fallback | Nigerian simulator routing implemented; real-provider health/liquidity and expansion gates pending |
| 8 — Login and workspace access | Email login, verified ownership, persistent workspace access, explicit guest saving | Identity/CSRF/tenant/ownership checks pass; returning login preserves the same workspace | Local implementation; Privy configuration and real email validation pending |
| 9 — Team workspace access | Private single-use invites, scoped members, switching and revocation | Invites redeem once; member scope and session revocation hold across workspaces | Local implementation; real Privy email acceptance pending |

Mobile, Python SDK, agent interfaces, automatic hedging/netting, Kafka,
Kubernetes, and custom Soroban remain demand-driven later work.

## Phase 0 validation

Local validation: TypeScript passes; 9 core tests and 18 PostgreSQL integration
tests pass, including a process-termination fixture. The demonstration completes
with balanced journals and no negative merchant balances. GitHub Actions is
configured to repeat these checks; no remote CI result is claimed.

Tests exercise exact arithmetic above JavaScript's safe integer range, rounding,
serialization, same-asset enforcement, and 2,000 generated arithmetic/FX cases.
Database tests exercise immutable records, late-entry rejection, per-asset
balancing, rollback, duplicate references, concurrent holds, fee accounting,
reversals, provider deduplication, timeout status recovery, and termination after
provider acceptance.

Phase 0 provider recovery concerns the durable simulator. End-to-end API/outbox
worker recovery belongs to Phase 1. Real-provider guarantees must be verified
individually when their connectors are introduced.

## Phase 1 validation

The final suite includes 9 core tests and 51 PostgreSQL/API/worker tests (60
total). It covers hashed/scoped keys, tenant isolation, canonical idempotency,
concurrent duplicate requests, transactional rollback, quote expiry before and
after possible submission, compliance/limits, both asset directions, cancellation,
provider rejection, matched receipts, and immutable instruction/state guards.

Five separate worker-process termination checkpoints cover instruction commit,
before provider call, after provider acceptance, before settlement commit, and
after settlement commit but before job acknowledgement. Recovery produces one
provider movement, one receipt, and one capture journal per completed intent.

Webhook tests verify raw-body signatures, encrypted secrets/cache responses,
retry/replay, destination allowlisting, and redirect rejection. The standalone
`pnpm smoke:phase1` additionally checks real HTTP with separate API/worker
processes: one recovered timeout, one movement/receipt, and three verified events.

OpenAPI generation, SDK packaging, dashboard, and operations UI were delivered in Phase 2.
Return/reversal provider workflows belong to the real-rail phase; the Phase 1
API exposes only success, timeout, and insufficient-float simulator scenarios.

## Phase 2 validation

Local checks pass: 9 core tests, 60 PostgreSQL/API/worker/product tests and 9
Playwright browser tests, for 78 distinct tests. Additional targeted reruns cover
the final product aggregation changes. TypeScript, frozen dependency installation,
generated-contract drift detection, SDK ESM/declaration packaging and dashboard
production bundling pass. The built SDK client and Node webhook exports were
also loaded directly. CI is configured to repeat these checks; no remote CI
result is claimed.

Product tests cover cookie exchange, strict origin/CSRF checks including malformed
tokens, logout, revoked sessions, tenant isolation, scope escalation prevention,
hashed/encrypted secrets, key pagination, redacted request logs, actual seeded
payment outcomes, one-movement status recovery, journal balance, OpenAPI coverage
and typed SDK requests above JavaScript's safe integer range.

Browser tests cover public docs, sandbox onboarding/sign-out, actual overview
balances, business transfers, expired-quote renewal, stable-key retry after a
lost submission response, hosted USDC conversion, unknown recovery with receipt
and journal inspection, key creation/revocation, webhook registration/replay,
request metadata, customer instruments and mobile navigation. Screenshots were
visually inspected on desktop and mobile.

The separate Phase 1 HTTP smoke remains green with one recovered provider
movement, one matched receipt, three verified webhook events and clean ledger
invariants. Browser and process-crash suites run sequentially because an active
worker can legitimately consume a crash fixture's pending job. Live-bank and
Stellar-network integration remain the later phase gates shown above.

## Phase 3 local validation

Local checks pass: 9 core tests, 90 PostgreSQL/API/worker/product/rail tests,
10 baseline browser tests and 3 configured local-rail browser tests — 112
distinct tests. The rail suite adds 30 cases covering name-enquiry encryption,
recipient identity, credential binding, tenant/scoped access, exact 64-bit IDs,
verified fees, immutable instructions, ambiguous submission recovery, held
collections, duplicate callbacks, late/pre-capture returns, snapshot mismatches
and privacy, fresh-request fencing and protected rail journals.

TypeScript, frozen dependency installation, contract drift checks, packaged SDK
and dashboard build pass. The separate-process Phase 3 HTTP smoke verifies one
payout POST after a worker kill following acceptance, one collection with
deduplicated signed callbacks, one late return, three matched statement rows
and clean ledger invariants. The Phase 1 HTTP smoke remains green. Browser
checks exercise account-name enquiry, bank payout settlement, collection
checkout/callback verification, snapshot reconciliation, reasoned compliance
controls, missing-key setup and desktop/mobile layouts. Screenshots were
visually inspected. CI repeats local checks; no remote CI result is claimed.

The real Paystack sandbox was not called: no test key was configured. Orion’s
deployed credential was found to be a live key. At the user’s request it is
retained only in private local `ORION_PAYSTACK_SECRET_KEY`, which the connector
does not read; no Orion deployment or Paystack live payment was changed.
`pnpm paystack:check` correctly reports that configuration gate. Phase 3's
external exit criteria remain pending provider sandbox validation and redacted
account-specific evidence, described in [the Paystack guide](phase-3-paystack.md).
Live activation and complete daily cash reconciliation remain later gates.


## Phase 4 validation

Phase 4's Stellar Testnet implementation uses the same Payment Intent engine,
reservations, immutable receipts, journal protections, tenant/scoped API and
webhook delivery system. KUSD is an isolated test asset with seven decimals and
an exact configured issuer. Production USDC/fiat backing is not claimed.

Local regression checks pass: 9 core tests and 107 integration tests, including
17 Stellar tests, plus 10 baseline browser tests, 3 local-rail browser tests and
2 Stellar browser tests: 131 distinct tests. Build, frozen dependencies, SDK
exports and generated contract checks pass. Desktop/mobile screenshots were
visually inspected. The Stellar suite covers ownership challenges, tenant/scopes,
exact network/issuer/amount identity, trustline authorization/capacity, immutable
signed envelopes, receipt matching, failed transactions, ambiguous acceptance,
expiry without replacement, issuer changes, treasury sequence serialization,
duplicate/concurrent deposit credits, fixture redemption and XLM fee journals.
A separate worker is killed after Testnet-harness acceptance; recovery confirms
the saved hash with one provider submission, receipt and capture journal.

An actual Stellar Testnet round trip passed: NGN fixture-backed KUSD delivery,
customer-to-treasury deposit, duplicate verification credited once and an
idempotent KUSD-to-NGN fixture redemption, with clean ledger invariants. Public
hashes and accounting identifiers are retained in private
`.sandbox/phase4-evidence.json`. `pnpm smoke:phase4` repeats this opt-in network
validation. CI exercises local fixtures without funding public-network accounts.

The console, OpenAPI and SDK include wallet verification, purchases, deposits,
redemptions, saved transaction hashes/sequences and financial evidence. Partner
FX/liquidity, production custody and an approved production issuer remain open.
Paystack test-mode validation and both external local legs still require an
actual test key. Phase 4's full partner exit criteria are therefore pending;
see [the Stellar guide](phase-4-stellar.md).


## Phase 5 local implementation and validation

Phase 5 adds enrolled operator identities with immutable key/merchant bindings,
independent policy approval, expiring immutable staging reviews, concurrent gross
source transaction/UTC daily caps, and an emergency pause coordinated with
provider dispatch. Accepted payments, verified incoming collections/deposits,
and authoritative status recovery remain available while paused. Live readiness
is fixed false. The console, ten OpenAPI/SDK operations, and append-only audit
and daily ledger/receipt reports make these controls reviewable.

The optional HTTPS Testnet custody bridge binds the signature to the approved
transaction hash and checks treasury signature, issuer, network, single-payment
policy, expiry, fee ceiling, and response size. Remote failures never fall back
to a local treasury key. It is fixture-tested; no external custodian was selected
or validated. Operator enrollment is platform managed and requires approved
human-identity assurance before a real pilot.

Local regression validation passes: 13 core/signer tests and 121 integration
tests, including 12 new controls cases and two additional collection-pause cases.
There are 17 browser tests across the baseline product, Paystack harness, Stellar
harness, and desktop/mobile controls console: 151 distinct tests in total.
Targeted reruns verify the final UTC calendar-date fix and collection credit
assertion. Build, generated contract checks, SDK exports and frozen installation
pass. Screenshots were visually inspected. Browser fixture commands now replace
the shell process so graceful termination reaches the server and its worker.

The capped HTTP/SDK rehearsal passed with two fixture operator identities,
blocked self approval, one idempotent payment, one recovered provider movement,
one receipt and one usage entry, followed by clean ledger controls and an
independently approved resume. External review evidence in that rehearsal is
explicitly simulated. Private proof is in `.sandbox/phase5-evidence.json`.
Phase 1 and Phase 3 separate-process HTTP recovery smokes remain green.

The final encrypted backup drill restored 46 tables and 48,282 rows with
identical snapshot row checksums into an isolated database. Restored journal
immutability, late-entry rejection, balancing, nonnegative merchant balances
and absence of empty journals passed. No restored worker was started. Private
archive/proof files are under `.sandbox/backups/`; this local drill does not
validate offsite retention, PITR or production recovery objectives.

The dependency review found static-server advisories in the app and API-docs
dependency paths. Patched versions were installed and the production registry
audit returned zero advisories across 158 dependencies. This is a local review,
not an independent security assessment. CI is configured to repeat checks,
the capped rehearsal, restore drill and browser tests; no remote CI result is
claimed.

Full daily provider cash/FX liability reconciliation, verified Paystack test-mode
flows, approved production custody, independent security assurance, real KYB/KYC
and screening, approved identity enrollment, partner/legal approvals and offsite
recovery remain open. Full Phase 5 production/pilot exit criteria are therefore
pending. See [the Phase 5 guide](phase-5-controls.md), [operations runbook](operations-runbook.md),
and [security review](security-review.md).

## Phase 6 Nigeria-first foundation

The selected Nigeria/NGN sandbox now has frozen three-step plans, participant
bindings, atomic corridor-budget admission, saved leg receipts and stage journals,
and recovery through the existing intent engine. Accepted settlement timeouts and
process crashes resume remaining legs without duplication; a rejected destination
retains funds and raises reconciliation. Kenya remains a disabled template.
The console and typed SDK expose the route and recovery evidence. This domestic
simulator delivery does not meet the original cross-border exit criterion. See
[Phase 6 network](phase-6-network.md) for behavior and outstanding external gates.

## Phase 7 Nigerian routing foundation

Two executable Nigerian simulator payout participants now share the existing
source/settlement engine. Automatic selection uses current corridor budgets,
merchant-scoped health, recent acceptance/rejection receipts and measured
simulator latency. Quotes freeze the full selection evidence. Admission rechecks
conditions atomically; accepted routes retain their original providers and holds
during an outage. Health controls are scoped, append-only and binding-specific.
Real-provider routing and the cross-border exit remain unvalidated. See
[the Phase 7 routing guide](phase-7-routing.md).

## Phase 8 login and workspace access

The public login page now uses Privy email codes. Verified identity bindings,
atomic first-workspace provisioning, returning-account access, explicit guest
workspace saving, secure cookies, and an Account & access screen are implemented.
API-key sign-in is removed from the public UI. Local signed-token fixtures validate
the ownership and authentication boundary; the user's Privy app configuration and
real email delivery remain pending. See [the Phase 8 guide](phase-8-login.md).

## Phase 9 team workspace access

An owner can invite Viewers or Payments editors with private one-use links, view
members, revoke pending links or active members, and switch among their own
workspaces. Existing Privy identities can join a second workspace. Invitation
redemption and session creation are transactional; role scopes prevent team access
from granting key management or operator approval. Local signed-token fixtures
validate the boundary. See [the Phase 9 guide](phase-9-team.md).
