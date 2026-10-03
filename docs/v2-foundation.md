# Kora v2 foundation

This is the first staged slice of the Kora Personal, Business and Network target
architecture. It remains a sandbox. No production custody, exchange or
cross-border corridor is enabled.

## Implemented

- Canonical asset positions distinguish currency, network, issuer, form and
  decimals. The ledger validates each posted journal by position, so equal
  tickers on different networks cannot silently offset each other.
- Personal and Business have separate email-code identity realms and HttpOnly
  sessions. Codes expire after ten minutes, are single use, have a five-attempt
  limit, and are stored as keyed hashes. Same-origin and CSRF checks protect
  state-changing requests. Email login is disabled unless SMTP and an auth
  secret are configured.
- A Personal user can create a sandbox account, explicitly enable the Nigerian
  sandbox verification fixture, add one simulated NGN balance, and send NGN to
  another eligible Personal account. Transfers post one atomic, idempotent
  double-entry journal and appear in both activity feeds.
- A Business email account starts with no funds and with KYB incomplete. Its
  owner can explicitly enable a sandbox KYB fixture, which funds a simulated NGN
  balance once. The public sandbox API blocks Business writes until approval.
  The existing route, rail, Stellar Testnet and operations tools remain in the
  Developer Sandbox under Business Developers.
- The web app uses dark theme by default with a light toggle, removes the dot
  from the Kora wordmark, and groups main Business navigation into Overview,
  Payments, Balances, Developers and Settings. Personal has Home, Send,
  Activity and Profile.

## Local setup

Apply migrations with `pnpm db:migrate`. Set `KORA_AUTH_SECRET`, `SMTP_HOST`,
`SMTP_PORT` and `SMTP_FROM` in the ignored `.env`; optionally set `SMTP_USER`
and `SMTP_PASS`. A local SMTP capture service can supply the host/port for
development. Start `pnpm dev:api` and `pnpm dev:web` and open `/personal/login`
or `/business/login`.

`pnpm check` covers the existing ledger, provider and API suite. The Personal
and Business email tests run as part of `pnpm test:integration`. For layout
checks, run `node scripts/check-v2-layout.mjs` against local servers. The
signed-in layout check creates isolated test identities with an injected local
code sender: `node --import tsx scripts/check-v2-signed-in.mjs`.

## Next complete slices

The Personal destination-first flow currently supports eligible Kora email
recipients and NGN ledger transfers. Bank/mobile-money beneficiaries, external
wallets, executable conversion quotes, actual KYC/KYB providers, fiat provider
finality, custody, and independent production reconciliation remain staged work.
Each capability needs its adapter, state machine, reconciliation and controls
before enabling real funds. A country launch also requires documented partner
and legal responsibility.
