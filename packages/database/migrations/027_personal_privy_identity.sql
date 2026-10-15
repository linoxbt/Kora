ALTER TABLE personal_users ADD COLUMN privy_app_id text;
ALTER TABLE personal_users ADD COLUMN privy_subject text;
ALTER TABLE personal_users ADD CONSTRAINT personal_privy_pair CHECK ((privy_app_id IS NULL) = (privy_subject IS NULL));
CREATE UNIQUE INDEX personal_privy_identity_unique ON personal_users(privy_app_id, privy_subject) WHERE privy_subject IS NOT NULL;
