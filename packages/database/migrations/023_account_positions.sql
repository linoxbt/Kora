-- Add account ownership and canonical asset positions without rewriting posted journals.
CREATE TABLE asset_positions (
  id text PRIMARY KEY,
  asset_code text NOT NULL,
  network text NOT NULL,
  issuer text NOT NULL,
  token_address text,
  form text NOT NULL CHECK(form IN ('fiat','simulated','issued','native')),
  decimals smallint NOT NULL CHECK(decimals BETWEEN 0 AND 18),
  environment text NOT NULL CHECK(environment IN ('sandbox','staging','production')),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT(asset_code,network,issuer,token_address,form)
);
INSERT INTO asset_positions(id,asset_code,network,issuer,form,decimals,environment,enabled) VALUES
  ('pos_ngn_fiat','NGN','fiat-ng','sovereign','fiat',2,'sandbox',true),
  ('pos_kes_fiat','KES','fiat-ke','sovereign','fiat',2,'sandbox',false),
  ('pos_ghs_fiat','GHS','fiat-gh','sovereign','fiat',2,'sandbox',false),
  ('pos_usdc_sim','USDC','sandbox','kora-simulated','simulated',6,'sandbox',false),
  ('pos_kusd_test','KUSD','stellar-testnet','configured-kora-test-issuer','issued',7,'sandbox',false),
  ('pos_xlm_test','XLM','stellar-testnet','native','native',7,'sandbox',false);

CREATE TABLE organizations (
  id text PRIMARY KEY,
  legacy_merchant_id text UNIQUE REFERENCES merchants,
  name text NOT NULL,
  jurisdiction text,
  kyb_state text NOT NULL DEFAULT 'not_started'
    CHECK(kyb_state IN ('not_started','pending','sandbox_approved','verified','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE kora_accounts (
  id text PRIMARY KEY,
  owner_type text NOT NULL CHECK(owner_type IN ('personal','business')),
  organization_id text UNIQUE REFERENCES organizations,
  residence_country text,
  display_currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','restricted','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((owner_type='business')=(organization_id IS NOT NULL))
);
INSERT INTO organizations(id,legacy_merchant_id,name)
SELECT 'org_'||md5(m.id),m.id,m.name FROM merchants m;
INSERT INTO kora_accounts(id,owner_type,organization_id)
SELECT 'acct_'||md5(o.legacy_merchant_id),'business',o.id FROM organizations o;

ALTER TABLE ledger_accounts ADD COLUMN owner_account_id text REFERENCES kora_accounts;
ALTER TABLE ledger_accounts ADD COLUMN asset_position_id text REFERENCES asset_positions;
ALTER TABLE ledger_accounts DISABLE TRIGGER immutable_accounts;
UPDATE ledger_accounts l SET
  owner_account_id=(SELECT a.id FROM kora_accounts a JOIN organizations o ON o.id=a.organization_id
                    WHERE o.legacy_merchant_id=l.merchant_id),
  asset_position_id=CASE l.asset
    WHEN 'NGN' THEN 'pos_ngn_fiat'
    WHEN 'KES' THEN 'pos_kes_fiat'
    WHEN 'GHS' THEN 'pos_ghs_fiat'
    WHEN 'USDC' THEN 'pos_usdc_sim'
    WHEN 'KUSD' THEN 'pos_kusd_test'
    WHEN 'XLM' THEN 'pos_xlm_test'
  END;
ALTER TABLE ledger_accounts ENABLE TRIGGER immutable_accounts;
ALTER TABLE ledger_accounts ALTER COLUMN asset_position_id SET NOT NULL;
ALTER TABLE ledger_accounts DROP CONSTRAINT ledger_accounts_merchant_id_asset_purpose_key;
ALTER TABLE ledger_accounts DROP CONSTRAINT ledger_accounts_purpose_check;
ALTER TABLE ledger_accounts ADD CONSTRAINT ledger_accounts_purpose_check
  CHECK(purpose IN ('available','pending','reserved','clearing','fees','funding',
                    'provider_fees','network_settled','network_in_transit'));
CREATE UNIQUE INDEX ledger_owner_position_purpose
  ON ledger_accounts(owner_account_id,asset_position_id,purpose)
  WHERE owner_account_id IS NOT NULL;
CREATE UNIQUE INDEX ledger_system_position_purpose
  ON ledger_accounts(asset_position_id,purpose)
  WHERE owner_account_id IS NULL AND merchant_id IS NULL;

CREATE OR REPLACE FUNCTION check_balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target text; BEGIN
  IF TG_TABLE_NAME = 'journals' THEN target := NEW.id; ELSE target := NEW.journal_id; END IF;
  IF NOT EXISTS (SELECT 1 FROM ledger_entries WHERE journal_id=target) THEN
    RAISE EXCEPTION 'Journal has no entries';
  END IF;
  IF EXISTS (
    SELECT a.asset_position_id FROM ledger_entries e JOIN ledger_accounts a ON a.id=e.account_id
    WHERE e.journal_id=target GROUP BY a.asset_position_id
    HAVING SUM(CASE WHEN e.side='debit' THEN e.amount ELSE -e.amount END)<>0
  ) THEN RAISE EXCEPTION 'Journal is unbalanced'; END IF;
  RETURN NULL;
END $$;
