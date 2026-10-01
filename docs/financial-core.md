# Financial core conventions

## Amounts and identities

Unsigned integer amounts are canonical decimal strings at IO boundaries and
`bigint` in arithmetic. The application accepts up to 24 digits. Never pass a
floating-point amount to the ledger. Money supports same-asset add/subtract/
compare; conversion is an explicit quote with integer rational math.

Sandbox quotes charge 50 basis points: fees round up in the source asset, and
delivery rounds down in the destination asset. The rates are fixed fixtures.
USDC and cross-border routes are explicitly simulated. Phase 3 separately
implements domestic Paystack NGN test-mode calls; no live-bank or Stellar
network settlement is activated.

## Ledger convention

Every journal balances debits and credits independently for each asset.
The sandbox uses debit-positive merchant custody asset subaccounts:

| Movement | Debit | Credit |
| --- | --- | --- |
| Fixture funding | Merchant available | System funding |
| Reservation | Merchant reserved | Merchant available |
| Release | Merchant available | Merchant reserved |
| Capture | System clearing for principal; system fees for fee | Merchant reserved for total |

This is an operational sandbox subledger. Production reporting must establish
the legal custody model and its asset/liability general-ledger mapping.
Cross-asset conversion cannot net an NGN debit against a USDC credit; each asset
needs its own balanced journals and linked quote evidence.

## Posting and locking

`postJournal(client, journal)` runs within the caller's transaction, so later
domain writes can commit with accounting. It locks a reference using a
transaction-scoped advisory lock, deduplicates identical contents, and locks
accounts in sorted order. Available/reserved accounts cannot become negative
through the ledger module.

The database independently checks balance at transaction commit. Posted journal
headers, entries, and account identities cannot be updated or deleted. Entries
can be inserted only in the transaction that creates their journal, preventing
later additions that would silently alter old accounting.

Reservations lock and deduplicate their reference, then move available money
into reserved funds and create a hold atomically. Concurrent captures/releases
lock the hold. A capture records its fee for consistent retries. Captured holds
cannot be released; released holds cannot be captured.

Corrections append a reversing journal linked to the original. Only one reversal
per original is allowed. Hold and local-rail journals use the payment lifecycle and cannot be
reversed through the generic correction function.

## Provider evidence and recovery

The fake connector requires an active matching gross reservation before accepting a
new instruction: payout principal plus the explicit fee equals the held amount.
Its instruction fingerprint covers the principal, fee, asset, hold,
beneficiary, and scenario. Retrying unchanged contents returns the same outcome;
changing contents returns a duplicate error. One reservation cannot back two
provider instructions.

The timeout scenario commits acceptance, then throws an ambiguous timeout.
Recovery queries status using the stable instruction ID before capture.
The process-termination test exits after acceptance and reconstructs the
connector in another process before querying status. No blind resend occurs.

Phase 1 links validated receipts, instruction state, hold transitions,
intent state, and terminal events atomically. Creation commits the reservation,
intent, creation event/deliveries, idempotent response, and outbox job together.
`reserveInTransaction`, `captureInTransaction`, and `releaseInTransaction` allow
the engine to compose accounting with domain writes. These low-level functions do
not themselves decide whether an external receipt is sufficient or whether an
operator is authorized to make a correction.

The simulator separately journals the destination asset against fixture
liquidity. It does not claim to execute the descriptive Stellar/FX route legs;
real multi-provider leg execution is planned for later phases.

If the quote expires before any possible submission, the worker releases the
reservation and fails the intent. If submission might have occurred, expiry
cannot release the funds or trigger a new send. Durable acceptance evidence is
still reconciled after expiry because external movement has already happened.

## Operational constraints

Use a restricted application database role before production; the local Docker
credentials are development credentials. Additive migrations run under an
advisory lock. Posted records are never rewritten by a migration rollback.
Integration tests add unique fixtures and do not truncate the ledger.

## Domestic test rail accounting

Paystack domestic payouts capture the existing source reservation. They do not
post a simulated destination-liquidity journal. Collections record gross, known
provider fee and net merchant credit in one balanced NGN journal; held incoming
credits use merchant reserved until an approved release. Verified payout returns
append a correcting journal for source principal plus Kora fee, while the
original captured hold remains captured. Provider fees are separately recorded
as sandbox operator expense and are not assumed refunded. See the
[Phase 3 guide](phase-3-paystack.md) for examples and statement limitations.

## Stellar Testnet staging

Phase 4 uses separate KUSD (7 decimals) and exact configured issuer/network
identity. USDC remains simulated. Treasury network fees are journaled in XLM
(7 decimals); XLM is operational accounting only. Verified deposits credit KUSD
exactly once, then fixture liquidity redemptions reserve/capture it and credit
NGN. See [the Stellar guide](phase-4-stellar.md) for recovery and partner gates.
