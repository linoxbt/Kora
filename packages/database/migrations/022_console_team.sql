ALTER TABLE sessions DROP CONSTRAINT console_session_membership;
ALTER TABLE console_memberships DROP CONSTRAINT console_memberships_pkey;
ALTER TABLE console_memberships DROP CONSTRAINT console_memberships_merchant_id_key;
ALTER TABLE console_memberships DROP CONSTRAINT console_memberships_role_check;
ALTER TABLE console_memberships ADD COLUMN id text NOT NULL DEFAULT ('member_' || replace(gen_random_uuid()::text,'-',''));
ALTER TABLE console_memberships ADD COLUMN revoked_at timestamptz;
ALTER TABLE console_memberships ADD PRIMARY KEY(id);
ALTER TABLE console_memberships ADD CONSTRAINT console_membership_role CHECK(role IN ('owner','viewer','editor'));
CREATE UNIQUE INDEX console_active_member ON console_memberships(identity_id,merchant_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX console_active_owner ON console_memberships(merchant_id) WHERE role='owner' AND revoked_at IS NULL;
ALTER TABLE sessions ADD CONSTRAINT console_session_membership FOREIGN KEY(identity_id,merchant_id,api_key_id)
  REFERENCES console_memberships(identity_id,merchant_id,api_key_id);
DROP TRIGGER immutable_console_memberships ON console_memberships;
CREATE FUNCTION guard_console_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Console membership bindings are immutable'; END IF;
  IF (NEW.id,NEW.identity_id,NEW.merchant_id,NEW.api_key_id,NEW.role,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.identity_id,OLD.merchant_id,OLD.api_key_id,OLD.role,OLD.created_at)
     OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'Console membership bindings are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_console_membership BEFORE UPDATE OR DELETE ON console_memberships
  FOR EACH ROW EXECUTE FUNCTION guard_console_membership();
CREATE TABLE console_invitations (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES merchants,
  token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  role text NOT NULL CHECK(role IN ('viewer','editor')),
  created_by_identity_id text NOT NULL REFERENCES console_identities,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_by_identity_id text REFERENCES console_identities,
  claimed_at timestamptz,
  revoked_at timestamptz,
  CHECK((claimed_by_identity_id IS NULL)=(claimed_at IS NULL))
);
CREATE INDEX console_invitations_merchant ON console_invitations(merchant_id,created_at DESC);
