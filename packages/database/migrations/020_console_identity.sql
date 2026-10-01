CREATE TABLE console_identities (
  id text PRIMARY KEY,
  provider text NOT NULL CHECK(provider='privy'),
  app_id text NOT NULL CHECK(length(app_id) BETWEEN 1 AND 120),
  subject text NOT NULL CHECK(subject LIKE 'did:privy:%' AND length(subject) BETWEEN 11 AND 200),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,app_id,subject)
);
CREATE TABLE console_memberships (
  identity_id text PRIMARY KEY REFERENCES console_identities,
  merchant_id text NOT NULL UNIQUE REFERENCES merchants,
  api_key_id text NOT NULL,
  role text NOT NULL DEFAULT 'owner' CHECK(role='owner'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(api_key_id,merchant_id) REFERENCES api_keys(id,merchant_id),
  UNIQUE(identity_id,merchant_id,api_key_id)
);
CREATE TRIGGER immutable_console_memberships BEFORE UPDATE OR DELETE ON console_memberships
  FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
ALTER TABLE sessions ADD COLUMN identity_id text REFERENCES console_identities;
ALTER TABLE sessions ADD COLUMN auth_method text NOT NULL DEFAULT 'api_key'
  CHECK(auth_method IN ('privy','api_key','sandbox'));
ALTER TABLE sessions ADD CONSTRAINT console_session_identity_method
  CHECK((auth_method='privy')=(identity_id IS NOT NULL));
ALTER TABLE sessions ADD CONSTRAINT console_session_membership
  FOREIGN KEY(identity_id,merchant_id,api_key_id)
  REFERENCES console_memberships(identity_id,merchant_id,api_key_id);
CREATE INDEX sessions_identity ON sessions(identity_id) WHERE identity_id IS NOT NULL;
