# Phase 5 — Controls and capped staging

Phase 5 implements enforceable controls and a repeatable local pilot rehearsal.
Kora still runs in sandbox mode. `live_ready` is always false: operator evidence
cannot enable production payments. Real Paystack test validation, partner FX,
production custody, independent security assurance, and legal/partner approval
remain external exit gates.

## Identities and approval

An enrolled operator has an immutable subject reference and merchant binding.
API keys are bound to that identity when created; the binding cannot be changed.
Two keys for the same operator cannot satisfy independent approval. The database
also enforces merchant ownership for evidence, requesting/reviewing operators,
and audit keys. Merchant API-key creation cannot enroll operators or add an
operator binding.

Platform administrators enroll operators locally:

```sh
pnpm operator:enroll <merchant-id> <verified-subject-reference> <display-name>
```

Credentials are written to an ignored `.sandbox/operators/<operator-id>.json`
file with mode 0600. The command prints the path and public ID, never the key.
These keys have only `operations:read` and `operations:write`. The console can
connect using an operator key and then uses the existing HttpOnly session and
CSRF protection. Database enrollment is a trusted platform action; this local
command does not verify SSO, MFA, employment, or that two subjects are two humans.
An approved identity provider and its enrollment/deactivation procedures must
be validated before a real pilot.

## Evidence and readiness

Seven merchant review kinds are supported: KYB, KYC, screening, custody,
security, legal, and partner. Each entry records the operator, reference,
reason, outcome, expiry, and staging mode. Entries are append-only; a new
review supersedes the previous entry of that kind. Reviews expire within a
year. Customer-specific KYC and screening are separate from merchant reviews.
Avoid personal data and credentials in reasons or references; keep sensitive
review documents in the approved evidence system.

Capped staging needs current `checked` merchant evidence for all seven kinds,
a clean daily control report created within the last 24 hours, and no current
unresolved intents, collections, reconciliation items, or statement reviews.
Customer payments and collection initiation additionally need current customer
KYC and screening evidence while staging is active. These are staging review
records, not integrations with a screening or KYC vendor and not legal approval.

A change request freezes the action, cap policy, reason, and current revision.
It expires after 24 hours. Another active enrolled operator approves or rejects
it with a reason. Approval requires current readiness and an active requester.
Stale requests cannot change a newer policy. Requests and their completed
reviews are immutable. Start applies from sandbox, cap changes from active
staging, and resume from paused state.

## Caps and pause

The approved policy lists allowed source assets and integer minor-unit limits
per transaction and UTC day. Cap checks, usage, reservations, and intent
creation share a database transaction. A merchant row lock serializes
concurrent admissions. Unsupported assets fail closed. KUSD redemptions consume
the KUSD source budget; XLM is a treasury fee asset and cannot have a pilot cap.

The budget counts **attempted gross outbound source amounts**, including Kora
fees, admitted while staging is active. Failed or canceled transactions do not
restore the day's budget. A cap change does not reset usage. Duplicate API
requests reuse their original idempotency key and consume budget once. Inbound
collection credits and verified deposits are financial evidence recovery, not
outbound spending. Collection creation and first initialization are paused by
the emergency control; their inbound credits do not consume this outbound cap.
Pre-staging work was admitted under sandbox policy and does not retroactively
consume the pilot budget. Approving staging requires its unresolved work to be
cleared first.

Any operations writer can pause immediately with a reason; emergency pause does
not wait for a second operator. Dispatch uses shared per-merchant advisory locks,
and pause takes the exclusive lock before recording the state. Acknowledged
pause therefore waits for in-flight dispatches and prevents a subsequent first
submission. It cannot undo a payment already submitted. Status checks, receipts,
verified deposits/collections, late returns, and known accepted settlements
continue. Holds stay reserved when a movement is ambiguous. Resume requires a
fresh independent approval and readiness checks.

## Daily reports

Reports are immutable snapshots, scoped to `ledger_and_receipt_controls`.
They check per-asset journal balancing, empty journals, negative merchant
available/reserved balances, processing/unknown intents, missing receipts,
open reconciliation items, statement review, and unsettled collections.
Journal balance/empty checks cover the whole shared ledger; other work and
balances are merchant scoped. Reports expose counts, never other merchants'
identifiers. Date-selected balances close at the next UTC midnight; today's
period remains provisional. Unresolved-work checks describe the current
snapshot even when the chosen balance date is historical.

`provider_cash_complete` is always false. A clean report is not complete cash
reconciliation or evidence of fiat backing. Opening/closing provider cash,
independent bank statements, settlement timing, fees, reserves, FX liabilities,
and documented breaks still need an approved reconciliation integration.

## API, SDK and console

All control reads require `operations:read`, and writes require
`operations:write` plus an idempotency key. Evidence and policy requests/reviews
also require an active enrolled identity. The console provides Pilot controls
with Evidence, Approvals, Reports, and Audit tabs. Failed transport responses
retain the frozen original mutation and key for retry.

| Endpoint | Action |
| --- | --- |
| `GET /v1/controls` | Current state, policy revision, staging and external gates |
| `GET/POST /v1/controls/evidence` | Review history / append evidence |
| `GET/POST /v1/controls/approvals` | Requests / request a change |
| `POST /v1/controls/approvals/:id/review` | Independently approve or reject |
| `POST /v1/controls/pause` | Emergency pause |
| `GET/POST /v1/controls/reports` | Report history / run daily controls |
| `GET /v1/controls/audit` | Immutable control actions |

History endpoints return the latest 100 records. Full history remains in the
database; an archival/export workflow and pagination are later work. Version
0.5.0 OpenAPI and TypeScript SDK include all ten control operations.

## Remote custody boundary

Local Testnet signing remains the default. Optional remote signing accepts an
operator-configured HTTPS endpoint, with no redirect or local-key fallback:

```dotenv
STELLAR_SIGNER_MODE=remote
STELLAR_TESTNET_ISSUER=<approved-testnet-issuer>
STELLAR_TESTNET_TREASURY_PUBLIC_KEY=<treasury-public-address>
STELLAR_SIGNER_URL=https://<approved-custody-host>/<signing-path>
STELLAR_SIGNER_TOKEN=<private-provider-token>
```

The treasury secret is unnecessary in remote mode. The request includes a
version, Testnet designation, exact KUSD issuer, treasury public key, unsigned
XDR, and transaction hash. That hash is also the idempotency key. The response
must contain only `transaction_hash` and `signed_xdr`. The client checks exact
hash and treasury signature, single allowed payment, issuer/network, fee ceiling,
and short expiration. It bounds the response to 64 KiB and does not print the
token, envelope, or provider error body. Signer failure prevents submission.
The normal connector persists the verified signed envelope before Horizon POST
and recovers by its saved hash. Changing signer access cannot authorize a new
transaction in place of an ambiguous saved one.

The adapter is locally tested against an injected custody fixture. No custody
provider was selected, contacted, or validated. Endpoint configuration is trusted
platform configuration; production needs approved network egress, independent
custodian policy, authentication/key rotation, availability checks, and proof
of account ownership. No production network or production asset is enabled.

## Rehearsal and recovery

```sh
pnpm test:controls
pnpm smoke:phase5
pnpm test:browser:controls
pnpm backup:drill
```

The HTTP/SDK rehearsal creates two local fixture identities and explicitly
simulated review evidence. It exercises independent approval, an idempotent
capped payment, lost-response recovery during pause, a clean ledger report,
and independently approved resume. Proof lives in `.sandbox/phase5-evidence.json`;
credentials are separate and private. It does not attest real partner reviews.

Use [the operations runbook](operations-runbook.md) for incidents and restore
handling, and [the security review](security-review.md) for assurance boundaries.
