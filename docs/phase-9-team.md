# Phase 9: Team workspace access

Phase 9 adds private, single-use invitations for verified Privy accounts. An owner
opens **Account & access**, chooses Viewer or Payments editor, creates an invitation,
and copies its link. The link expires after seven days. Kora stores only its SHA-256
hash, returns the raw token once, and does not send email. Anyone holding the link
can accept it after a verified Privy login; it is not bound to an email address.
Share it privately and revoke an unused link if it was exposed.

Viewer access includes read-only payments, customers, and operations. Payments
editor adds payment and customer writes. Neither role can manage API keys,
webhooks, operations writes, team access, or Phase 5 operator approvals. Owner
access retains the existing scopes. Every member has a distinct scoped credential
and session. The account page lists members and outstanding invitations without
returning link tokens. Revoking a member also revokes their credential, which
invalidates existing sessions. Historical membership and financial records stay
intact. Revoked members can be invited again with a new link and credential.

Invite redemption is part of the Privy token exchange and happens in one database
transaction with credential creation and session issuance. It locks the invitation
row, so concurrent uses admit only one account. A person with an existing Kora
account can join another workspace; **Your workspaces** switches between owned and
invited workspaces, rotating the session. Regular login defaults to the owned
workspace when one exists. Workspace selection is checked against active
memberships. Invitation and membership mutations require an owner identity, an
allowed console origin, and CSRF. API keys remain server integration credentials;
they cannot create team invitations.

The invitation URL uses a fragment (`/login#invite=...`). The login page consumes
the token and removes the fragment from the visible URL. It must still be treated
as a bearer secret when shared or copied. This phase has no email delivery or
ownership transfer. Account labels show internal member IDs because Kora does not
use an unverified email field from the Privy token as an identity binding.

Run `pnpm db:migrate`, `pnpm check`, and `pnpm test:browser:auth`. The auth suite
uses locally signed ES256 tokens to verify one-use redemption, concurrent use,
revoked links, access scopes, CSRF, workspace switching, and immediate session
revocation. Real email invitation acceptance remains pending Privy configuration
and provider validation from Phase 8. All balances and rails remain sandbox-only.
