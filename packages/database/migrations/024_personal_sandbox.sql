-- Personal identities are separate from Business console identities and API keys.
CREATE TABLE personal_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  email_verified_at timestamptz NOT NULL,
  residence_country text,
  nationality text,
  display_currency text NOT NULL DEFAULT 'NGN',
  kyc_state text NOT NULL DEFAULT 'not_started'
    CHECK (kyc_state IN ('not_started','pending','sandbox_approved','verified','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE kora_accounts ADD COLUMN personal_user_id text UNIQUE REFERENCES personal_users;
ALTER TABLE kora_accounts DROP CONSTRAINT kora_accounts_check;
ALTER TABLE kora_accounts ADD CONSTRAINT kora_accounts_owner_check
  CHECK ((owner_type='business' AND organization_id IS NOT NULL AND personal_user_id IS NULL)
      OR (owner_type='personal' AND organization_id IS NULL AND personal_user_id IS NOT NULL));

CREATE TABLE personal_email_challenges (
  id text PRIMARY KEY,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX personal_email_challenges_lookup ON personal_email_challenges(email,created_at DESC);
CREATE TABLE personal_sessions (
  token_hash text PRIMARY KEY,
  personal_user_id text NOT NULL REFERENCES personal_users,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX personal_sessions_user ON personal_sessions(personal_user_id);
CREATE TABLE personal_transfers (
  id text PRIMARY KEY,
  sender_account_id text NOT NULL REFERENCES kora_accounts,
  receiver_account_id text NOT NULL REFERENCES kora_accounts,
  amount_minor numeric(30,0) NOT NULL CHECK(amount_minor>0),
  asset_position_id text NOT NULL REFERENCES asset_positions,
  journal_id text NOT NULL UNIQUE REFERENCES journals,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sender_account_id,idempotency_key),
  CHECK(sender_account_id<>receiver_account_id)
);
CREATE TABLE personal_sandbox_funding (
  personal_user_id text PRIMARY KEY REFERENCES personal_users,
  journal_id text NOT NULL UNIQUE REFERENCES journals,
  created_at timestamptz NOT NULL DEFAULT now()
);
