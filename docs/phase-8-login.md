# Phase 8: Login and persistent workspace access

Phase 8 adds an email-only login page at `/login`, Privy one-time-code verification,
durable account ownership, an Account & access screen, and explicit guest-workspace
saving. API keys remain server integration credentials; neither login nor guest
onboarding offers API-key sign-in. Guest sandbox creation remains available while
Privy is being configured.

## Configure Privy

Create a Kora app in the [Privy dashboard](https://dashboard.privy.io), enable Email
authentication, and register the exact localhost and public preview origins used
by Kora. Follow the official [React setup](https://docs.privy.io/basics/react/setup)
and [email login guide](https://docs.privy.io/authentication/user-authentication/login-methods/email).
Configure these variables in the private root `.env`:

```dotenv
PRIVY_APP_ID=<Kora app ID>
PRIVY_CLIENT_ID=<optional web client ID>
PRIVY_VERIFICATION_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

The public P-256 verification key comes from Privy's dashboard. It stays on the
server; only the public app/client IDs and readiness flag are sent to the browser.
No Privy app secret is needed for this authentication-only integration. Restart
the API after configuration or verification-key rotation. If the preview hostname
changes, update both the Privy allowed origin and Kora's exact console origin.

Missing or malformed configuration keeps email login disabled and explains the
guest sandbox option. A temporary configuration-request failure has a retry action.
No fake email code, development token bypass, or browser-supplied verification key
is accepted. Real email delivery and the configured Privy app must be validated
after setup; local cryptographic fixtures do not constitute provider validation.

## Login behavior

The SDK is loaded only when the email login page has valid server configuration.
The custom form sends an email code, accepts six digits, supports changing the
address and resending after a cooldown, and exposes recoverable errors. Privy's
headless captcha component is included. Automatic embedded wallet creation is off.
Login does not create or authorize a wallet, payment, custody signer, or operator.

After email verification, Kora exchanges the Privy access token for its own
24-hour HttpOnly, SameSite=Strict cookie and CSRF token. HTTPS origins receive
Secure cookies. Kora doesn't store an API key or access token in local/session
storage. Privy's SDK manages its temporary authentication storage; successful
exchange calls Privy logout to clear that provider login. SDK cleanup is best-effort
and never causes an already committed Kora login to be resubmitted. Failed
exchanges can be retried with a refreshed provider token.

First login creates a sandbox merchant with four journaled fixture balances and
an owner credential in one transaction. It starts without seeded demonstration
transactions; guest sandboxes retain the existing seven demo outcomes. Returning
login reuses the existing merchant and credential without renaming the workspace
or funding it again. Concurrent first logins and response retries resolve to the
same ownership record.

Guest administrators can choose Account & access → Save workspace with email.
The exchange requires their active full administrator cookie, matching CSRF token,
and explicit `link_current: true`. No merchant ID, owner role, email address, or
provider subject can be supplied as proof of access. Saving preserves balances and
history and issues a separate revocable owner credential. An already owned
workspace cannot be taken over, and an account already bound to another workspace
cannot silently move. The initial identity phase supports one owner and one
workspace per identity; Phase 9 adds team invitations and multi-workspace
membership. Ownership transfer remains future work.

## Authentication boundaries

The server verifies ES256 signatures with the configured public key, exact
`privy.io` issuer and Kora app audience, required subject/session/issued/expiry
claims, and one-hour token age. Access is bound to the verified Privy subject and
app ID, never to an unverified email or wallet field. The token exchange has a
per-IP limit of ten requests per minute and enforces allowed console origins.
Replacing an existing authenticated session requires its CSRF token.

Identity bindings and memberships have database guards. Composite foreign keys
bind identity sessions and credentials to their owned merchant. Disabled accounts,
revoked credentials, expired sessions, and app-ID changes prevent session access.
Revocation cannot be bypassed by minting a replacement credential on login. Owner
credentials have no enrolled operator ID; Phase 5's separate operator approval
requirements still apply. Logout deletes the saved session and clears its cookie.
Anonymous protected routes render the email login page.

The existing cookie-exchange endpoint used by scoped integration/operator fixtures
remains compatible; all public UI paths into API-key sign-in were removed.
Financial API bearer authentication and key management continue to serve server
integrations.

## Verification

`pnpm test:auth` uses locally generated ES256 keys and actual signed JWTs to verify
readiness, signature/algorithm/claims rejection, concurrent account creation,
funding rollback, explicit guest saving, CSRF/origin/rate limits, immutable ownership,
tenant isolation, revocation, disablement, cookie security, expiry, and logout.
These cases also run in `pnpm check`.

`pnpm test:browser:auth` uses a separate unconfigured provider fixture to check the
email-only mobile page, anonymous route protection, configuration retry, and guest
save/back/logout behavior. It does not send email. `pnpm preview:check` checks the
real public HTTPS login page for mobile overflow and absence of API-key sign-in,
then verifies the existing alternate network route and private-file protection.

The final local regression passed 208 distinct tests: 13 core/signer cases, 168
database/API/worker cases, and 27 browser cases across product, login, network,
rail, Stellar, and controls. The production build, generated-contract check,
frozen offline dependency installation, and production dependency audit passed.
These checks use cryptographic Privy token fixtures and do not send real email.

Privy's React SDK introduces transitive wallet dependencies even with wallets off.
Compatible overrides patch `ws` 8.x, legacy `uuid` 8/9, and `decode-uri-component`;
`pnpm audit --prod` must pass after installation. The SDK remains a separate lazy
chunk so the sandbox dashboard and unconfigured login do not load it.

Real provider health/liquidity, second-country rails, legal/custody assurance,
Paystack test validation and production readiness remain pending from earlier
phases. This identity phase does not close those financial gates.
