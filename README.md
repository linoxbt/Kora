# Microsendr

Microsendr Personal lets people use the network. Microsendr Business lets companies build
on the network. The shared ledger and settlement foundation power both modes.
The current deployment is a sandbox with simulated funds and providers.

The [v2 foundation](docs/v2-foundation.md) adds separate Personal and Business
Personal and Business identities, explicit KYC/KYB sandbox fixtures, canonical asset
positions, NGN Personal transfers, SteelBlue and cream design, and focused account navigation.
Real-money capabilities remain staged behind partner and control gates.

Microsendr is being built in tested phases. **Phases 0–2 implement the sandbox
financial core, payment engine, and product.** The dashboard and hosted flow
use the authenticated HTTP API and durable worker. **Phase 3 adds Paystack
test-mode NGN collections and bank payouts**, locally validated with a provider
harness. External provider sandbox validation is pending a test key. Funds and
identity checks remain sandbox-only. **Phase 4 adds actual Stellar Testnet KUSD
settlement, wallet ownership/trustline verification, deposits and fixture
redemptions.** Production custody and partner FX remain pending. **Phase 5 adds enrolled
operator approvals, capped staging, emergency pause, immutable review/audit
records, daily ledger controls, a remote Testnet signer bridge, and encrypted
backup/restore drills.** Live activation remains unavailable.

## Current capabilities

- Exact bigint money arithmetic and explicit asset scales.
- Immutable double-entry journals, balanced per asset.
- Idempotent posting, reservations, captures, releases, and correcting journals.
- Concurrent reservation controls that prevent overspending.
- PostgreSQL migrations and database-level journal protections.
- A durable fake provider with idempotent instructions and status recovery.
- Property tests, database integration tests, and process-termination recovery.
- Hashed, scoped API keys and merchant isolation.
- Customer/instrument records, quotes, transfers, asset purchases/redemptions.
- Atomic intent/reservation/outbox creation and matched-receipt settlement.
- Leased worker jobs, persisted instructions, cancellation, and status recovery.
- Signed webhooks with encrypted secrets, retries, delivery logs, and replay.
- Responsive business dashboard, hosted conversion flow and customer console.
- Developer key management, redacted request logs and webhook replay controls.
- Operations debugger with holds, attempts, receipts and per-asset journals.
- HttpOnly console sessions, CSRF checks and isolated prefunded workspaces.
- Privy email sign-in for Personal and Business; signed identity verification,
  persistent sessions, and separate sandbox KYC/KYB gates.
- Generated OpenAPI, interactive reference and packaged TypeScript SDK.

- Paystack test-mode name enquiry, verified NGN recipients, collections and payouts.
- Durable provider callback inbox, late returns and credential binding protections.
- Explicit collection fees, compliance-held credits and scoped snapshot reconciliation.

- Actual Stellar Testnet settlement with exact issuer/network binding and durable signed XDR.
- Verified wallet ownership, trustlines, sequence recovery, deposits and fixture redemptions.
- Matched on-chain receipts and native XLM treasury fee journals.

- Enrolled operator approval separation, gross transaction/UTC daily caps and emergency pause.
- Review evidence, immutable audit, daily ledger reports and a Pilot controls console.
- Optional remote Testnet custody bridge and encrypted isolated restoration checks.

See [Phase 5 controls](docs/phase-5-controls.md), [operations procedures](docs/operations-runbook.md),
and [the local security review](docs/security-review.md).

## Run locally

Requires Node.js 22+, pnpm 10, and Docker with Compose.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm sandbox:init
docker compose up -d --wait
pnpm db:migrate
pnpm build
pnpm start
```

In a second terminal, run `pnpm worker`. Open `http://127.0.0.1:4310` and choose
**Developer Sandbox → Start sandbox**. This creates an isolated workspace
with journaled fixture balances and seven actual simulated payment outcomes.
The guest workspace endpoint accepts only configured console origins and is
rate limited; it cannot fund an existing merchant or issue browser-visible keys.

For server integrations, create a scoped key in Developers, or run
`pnpm sandbox:create --output .sandbox/credentials.json`. Use
`Authorization: Bearer <api_key>` for API calls and
`Idempotency-Key` for mutations. Keep credentials private.

`pnpm dev` starts API/worker watch mode and Vite at `http://127.0.0.1:5176`.
`pnpm dev:api` and `pnpm dev:worker` run individually. To execute just one cycle,
use `pnpm worker --once`. Optional `--intent int_...` and `--merchant mcht_...`
filters restrict intent processing and webhook delivery, respectively. With
`--intent`, generic local-rail jobs are skipped. Without that filter, the worker
also processes collections, provider callbacks and statements when configured.

`netlify.toml` publishes the frontend and proxies `/console`, `/v1`, and API
reference requests to the separately hosted sandbox API. The public backend
runs the API, worker, and PostgreSQL with `compose.public.yaml`; it keeps the
database on a persistent Docker volume and exposes only the API behind HTTPS.
See [public deployment](docs/public-deployment.md) for the required environment,
proxy, update, and health checks.

`pnpm smoke:phase1` starts temporary separate API/worker processes and a local
webhook receiver, verifies HTTP authentication, duplicate-request handling,
timeout recovery, one provider movement/receipt, and signed delivery, then closes
those processes. `pnpm demo` remains the Phase 0 library demonstration.

The database listens on `127.0.0.1:55432`. The demo creates a fresh sandbox
merchant, journals fixture funding, reserves money, simulates a lost payout
acknowledgement, queries the durable provider status, and captures the reservation
with an explicit fee. Each run leaves its evidence in PostgreSQL.

`pnpm test` runs arithmetic/property tests without PostgreSQL.
`pnpm test:integration` requires the migrated database and adds uniquely named
test fixtures. `pnpm check` runs TypeScript, core and integration checks.
`pnpm build` generates the contract/types, validates TypeScript, packages the
SDK and builds the dashboard. `pnpm contract:check` detects generated-file drift.

Install Chromium with `pnpm exec playwright install chromium`, then run
`pnpm test:browser`. It starts temporary API/worker processes on port 4310 and
checks business/hosted flows, recovery, developer controls and mobile layout.
Run `pnpm test:browser:rail` for configured local-rail browser flows against the
local harness. `pnpm smoke:phase3` checks real HTTP and separate worker crash
recovery. `pnpm paystack:check` performs a read-only check with your test key.
Run integration, smoke and browser suites sequentially with standalone workers
stopped, since crash fixtures deliberately pause jobs before acknowledgement.

## Repository

```text
packages/core/          Money, sandbox assets/quotes, lifecycle/signature helpers
packages/database/      PostgreSQL connections and versioned SQL migrations
packages/ledger/        Journals, holds, reversals, balances, invariant report
packages/provider-sdk/  Provider contract and error taxonomy
packages/payments/      Auth, idempotency, intents, settlement, encrypted webhooks
connectors/fake/        Durable provider simulator
connectors/paystack/    Test-only NGN provider client and payout connector
packages/rails/        Bank enquiries, collections, callbacks, returns, statements
services/api/           Authenticated Fastify API
services/worker/        Outbox execution and webhook delivery
apps/web/              React dashboard, hosted flow and developer guide
packages/contracts/    Shared request schemas and public response contract
specs/openapi/         Generated OpenAPI JSON
sdks/typescript/       Browser-safe client and separate Node webhook helpers
scripts/               Provisioning, demos, contract generation and test servers
tests/                 Property, database/API/worker and Playwright tests
docs/                  Decisions, financial conventions, phased delivery
```

The original PDFs are archived in `docs/reference/`. Their historical contents
remain unchanged. The current product name and scope are **Kora**; new work
follows the network model described in [the decisions](docs/decisions.md).

See [the roadmap](docs/roadmap.md) for phase boundaries and completion criteria,
and [the accounting conventions](docs/financial-core.md) before extending the
ledger.

The [Phase 1 API guide](docs/phase-1-api.md) provides request examples, endpoint
details, lifecycle behavior, and webhook setup.

See the [Phase 2 product guide](docs/phase-2-product.md) for console flows,
session behavior and simulator scenarios, and the [SDK quickstart](sdks/typescript/README.md).

See the [Phase 3 Paystack guide](docs/phase-3-paystack.md) for local-rail setup,
API additions, provider references, accounting policies and the sandbox exit gate.
Provider secrets belong in `.env`; live keys are rejected.

See the [Phase 4 Stellar guide](docs/phase-4-stellar.md) for setup, APIs, signing,
recovery, actual Testnet validation and remaining partner gates.

Phase 6 adds the selected [Nigeria/NGN sandbox network](docs/phase-6-network.md):
three saved simulated steps, shared corridor budget, receipt-based recovery, and
a mobile route timeline. The second-country corridor remains disabled.

Phase 7 adds [automatic Nigerian sandbox routing](docs/phase-7-routing.md),
with two payout participants, receipt-based health/latency signals, scoped outage
rehearsals, frozen selection evidence, and recovery on the originally chosen rail.

Phase 8 adds [email login and persistent workspace access](docs/phase-8-login.md),
with Privy verification, atomic account provisioning, and explicit guest saving.
Open `/login` to sign in. Email becomes available after Privy app/public-key setup;
API-key sign-in is removed from login and onboarding.

Phase 9 adds [team workspace access](docs/phase-9-team.md): one-use private
invitations, Viewer and Payments editor roles, workspace switching, and immediate
member revocation. Real email acceptance still requires Privy configuration.
