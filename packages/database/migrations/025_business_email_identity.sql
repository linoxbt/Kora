-- Kora-managed Business login has a separate realm from Personal email login.
ALTER TABLE console_identities DROP CONSTRAINT console_identities_provider_check;
ALTER TABLE console_identities ADD CONSTRAINT console_identities_provider_check CHECK(provider IN ('privy','email'));
ALTER TABLE console_identities DROP CONSTRAINT console_identities_subject_check;
ALTER TABLE console_identities ADD CONSTRAINT console_identities_subject_check
  CHECK((provider='privy' AND subject LIKE 'did:privy:%' AND length(subject) BETWEEN 11 AND 200)
     OR (provider='email' AND subject LIKE 'email:%' AND length(subject) BETWEEN 7 AND 260));
ALTER TABLE sessions DROP CONSTRAINT sessions_auth_method_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_auth_method_check CHECK(auth_method IN ('privy','email','api_key','sandbox'));
ALTER TABLE sessions DROP CONSTRAINT console_session_identity_method;
ALTER TABLE sessions ADD CONSTRAINT console_session_identity_method
  CHECK((auth_method IN ('privy','email'))=(identity_id IS NOT NULL));
ALTER TABLE organizations ADD COLUMN kyb_required boolean NOT NULL DEFAULT false;
CREATE TABLE business_email_challenges (
  id text PRIMARY KEY,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_email_challenges_lookup ON business_email_challenges(email,created_at DESC);
