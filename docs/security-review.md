# Phase 5 security review

This is an implementation review and local automated validation, dated
2026-09-29. It is not an independent penetration test, compliance certification,
or production activation approval.

| Boundary | Implemented evidence | Remaining assurance |
| --- | --- | --- |
| Money and duplicate effects | Exact minor-unit strings; balanced immutable journals; transactional usage/holds/outbox; original provider reference/hash; receipt identity checks; process-crash tests | Real-provider guarantees and complete cash/FX liability reconciliation |
| Authorization | Hashed scoped tenant keys; HttpOnly sessions; origin/CSRF checks; platform-enrolled identities; immutable bindings; two identities for approval; operator-owner foreign keys | Approved SSO/MFA, independent human identity verification, privileged access governance |
| Admission and dispatch | Concurrent gross transaction/UTC day caps; reviewed customers in capped staging; shared dispatch/exclusive pause locking; unknown holds retained | Production limits and provider/custodian operational approval |
| Secrets | Private local configuration; encrypted responses, provider account data and hook secrets; redacted logs; encrypted backup archive; no remote-signer local fallback | External vault/key escrow, rotation, egress controls, incident ownership |
| Custody | Fixed Testnet/KUSD identity; local policy checks; remote HTTPS envelope/hash/signature checks and bounded response; saved envelope before POST | Approved custody provider/account, independent signing policies and availability proof |
| Evidence | Immutable reviews, reasons, expiries, policy revision fencing, audit events and daily reports | Independent evidence verification, approved legal/partner/compliance processes |
| Recovery | Exported snapshot backup; isolated restore; all-table checksums; restored journal/invariant protections; no restored worker startup | Offsite retention, WAL/PITR, measured recovery objectives and authorized cutover |
| Web delivery | Patched static serving/API docs; existing CSP, strict payload validation, rate limiting, authenticated cookie sessions | Independent app/network assessment and deployment hardening |

The production dependency audit initially found advisories affecting
`@fastify/static`, including the app's direct dependency and the API-docs
transitive dependency. Both paths were upgraded: `@fastify/static` 10.1.5 and
`@fastify/swagger-ui` 6.1.1. The static plugin's header callback was adapted to
its Fastify Reply interface so the CSP remains applied. `pnpm audit --prod`
subsequently reported zero advisories across 158 production dependencies.
This is the registry result at review time; it does not certify absence of
vulnerabilities. The maintainer's [path normalization advisory](https://github.com/fastify/fastify-static/security/advisories/GHSA-8pvw-jcv7-9cmj)
describes one of the patched issues. CI must keep the lockfile and repeat the
financial/browser checks; no remote CI execution is claimed here.

Review principles include server-side enforcement, binding approvals to frozen
transaction details, separation of requesting and reviewing identities, and
least privilege. The [OWASP Transaction Authorization guide](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
and [OWASP ASVS authorization requirements](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x17-V8-Authorization.md)
provide reference criteria. No complete ASVS conformance is claimed.

Production readiness stays false even if all local staging reviews are marked
checked. The local pilot rehearsal uses explicitly simulated external reviews.
The independent review, approved custody service, real Paystack test evidence,
partner/legal gates, offsite recovery, production monitoring, and complete daily
cash reconciliation remain required external work.
