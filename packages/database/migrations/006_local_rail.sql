ALTER TABLE quotes ADD COLUMN provider text NOT NULL DEFAULT 'kora-sandbox' CHECK(provider IN ('kora-sandbox','paystack-test'));
ALTER TABLE quotes DROP CONSTRAINT quote_assets;
ALTER TABLE quotes ADD CONSTRAINT quote_assets CHECK(
  source_asset IN ('NGN','KES','GHS','USDC') AND destination_asset IN ('NGN','KES','GHS','USDC') AND
  ((provider='kora-sandbox' AND source_asset<>destination_asset) OR
   (provider='paystack-test' AND source_asset='NGN' AND destination_asset='NGN'))
);
ALTER TABLE intents ADD COLUMN provider text NOT NULL DEFAULT 'kora-sandbox' CHECK(provider IN ('kora-sandbox','paystack-test'));
ALTER TABLE quotes ADD CONSTRAINT quote_provider_identity UNIQUE(id,merchant_id,provider);
ALTER TABLE intents ADD CONSTRAINT intent_quote_provider FOREIGN KEY(quote_id,merchant_id,provider) REFERENCES quotes(id,merchant_id,provider);
ALTER TABLE instructions ADD COLUMN provider text NOT NULL DEFAULT 'kora-sandbox' CHECK(provider IN ('kora-sandbox','paystack-test'));
ALTER TABLE intents ADD CONSTRAINT intent_provider_identity UNIQUE(id,provider);
ALTER TABLE instructions ADD CONSTRAINT instruction_intent_provider FOREIGN KEY(intent_id,provider) REFERENCES intents(id,provider);
ALTER TABLE instructions DROP CONSTRAINT instructions_state_check;
ALTER TABLE instructions ADD CONSTRAINT instructions_state_check CHECK(state IN ('created','submitting','unknown','confirmed','rejected','returned'));
ALTER TABLE attempts DROP CONSTRAINT attempts_state_check;
ALTER TABLE attempts ADD CONSTRAINT attempts_state_check CHECK(state IN ('processing','unknown','confirmed','rejected','returned'));
CREATE OR REPLACE FUNCTION guarded_intent_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (NEW.id,NEW.merchant_id,NEW.quote_id,NEW.type,NEW.source_asset,NEW.destination_asset,NEW.source_minor,NEW.destination_minor,NEW.fee_minor,NEW.beneficiary,NEW.reference,NEW.scenario,NEW.route,NEW.hold_id,NEW.customer_id,NEW.destination_instrument_id,NEW.provider,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.merchant_id,OLD.quote_id,OLD.type,OLD.source_asset,OLD.destination_asset,OLD.source_minor,OLD.destination_minor,OLD.fee_minor,OLD.beneficiary,OLD.reference,OLD.scenario,OLD.route,OLD.hold_id,OLD.customer_id,OLD.destination_instrument_id,OLD.provider,OLD.created_at)
  THEN RAISE EXCEPTION 'Intent financial instruction is immutable'; END IF;
  IF NEW.state<>OLD.state AND NOT (
    (OLD.state='processing' AND NEW.state IN ('unknown','succeeded','failed','canceled','returned')) OR
    (OLD.state='unknown' AND NEW.state IN ('succeeded','failed','returned')) OR
    (OLD.state='succeeded' AND NEW.state='returned')
  ) THEN RAISE EXCEPTION 'Invalid intent state transition'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION guarded_instruction_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (NEW.id,NEW.intent_id,NEW.provider_ref,NEW.request,NEW.created_at,NEW.provider)
     IS DISTINCT FROM (OLD.id,OLD.intent_id,OLD.provider_ref,OLD.request,OLD.created_at,OLD.provider)
  THEN RAISE EXCEPTION 'Provider instruction contents are immutable'; END IF;
  IF NEW.state<>OLD.state AND NOT (
    (OLD.state='created' AND NEW.state IN ('submitting','unknown','confirmed','rejected','returned')) OR
    (OLD.state='submitting' AND NEW.state IN ('unknown','confirmed','rejected','returned')) OR
    (OLD.state='unknown' AND NEW.state IN ('submitting','confirmed','rejected','returned')) OR
    (OLD.state='confirmed' AND NEW.state='returned')
  ) THEN RAISE EXCEPTION 'Invalid provider instruction transition'; END IF;
  RETURN NEW;
END $$;
ALTER TABLE ledger_accounts DROP CONSTRAINT ledger_accounts_purpose_check;
ALTER TABLE ledger_accounts ADD CONSTRAINT ledger_accounts_purpose_check CHECK(purpose IN ('available','reserved','clearing','fees','funding','provider_fees'));
INSERT INTO ledger_accounts(id,asset,purpose) VALUES('sys:NGN:provider_fees','NGN','provider_fees');
CREATE TABLE bank_resolutions (
 id text PRIMARY KEY,merchant_id text NOT NULL REFERENCES merchants,bank_code text NOT NULL,account_last4 text NOT NULL,
 account_name text NOT NULL,account_sealed text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day',UNIQUE(id,merchant_id)
);
CREATE TRIGGER immutable_bank_resolutions BEFORE UPDATE OR DELETE ON bank_resolutions FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE TABLE bank_accounts (
 instrument_id text PRIMARY KEY,merchant_id text NOT NULL,customer_id text NOT NULL,resolution_id text NOT NULL,
 recipient_code text NOT NULL,bank_code text NOT NULL,account_last4 text NOT NULL,account_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(instrument_id,customer_id,merchant_id) REFERENCES instruments(id,customer_id,merchant_id),
 FOREIGN KEY(resolution_id,merchant_id) REFERENCES bank_resolutions(id,merchant_id),UNIQUE(merchant_id,customer_id,recipient_code)
);
CREATE TRIGGER immutable_bank_accounts BEFORE UPDATE OR DELETE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE TABLE compliance_decisions (
 id text PRIMARY KEY,merchant_id text NOT NULL REFERENCES merchants,customer_id text NOT NULL,
 decision text NOT NULL CHECK(decision IN ('allow','hold')),reason text NOT NULL,
 evidence jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(customer_id,merchant_id) REFERENCES customers(id,merchant_id)
);
CREATE TRIGGER immutable_compliance_decisions BEFORE UPDATE OR DELETE ON compliance_decisions FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE TABLE collections (
 id text PRIMARY KEY,merchant_id text NOT NULL REFERENCES merchants,customer_id text NOT NULL,provider_reference text NOT NULL UNIQUE,
 amount_minor numeric(30,0) NOT NULL CHECK(amount_minor>0),fee_minor numeric(30,0),credited_minor numeric(30,0),
 state text NOT NULL DEFAULT 'processing' CHECK(state IN ('processing','pending','succeeded','failed','unknown')),
 input_sealed text NOT NULL,checkout_sealed text,provider_id text UNIQUE,last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(customer_id,merchant_id) REFERENCES customers(id,merchant_id)
);
CREATE TABLE rail_receipts (
 id text PRIMARY KEY,merchant_id text NOT NULL REFERENCES merchants,resource_id text NOT NULL,provider_reference text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('collection','return','payout_fee')),provider_id text,payload jsonb NOT NULL,
 journal_id text REFERENCES journals,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(resource_id,kind)
);
CREATE TRIGGER immutable_rail_receipts BEFORE UPDATE OR DELETE ON rail_receipts FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE TABLE provider_inbox (
 id text PRIMARY KEY,payload_hash text NOT NULL UNIQUE,event_type text NOT NULL,provider_reference text NOT NULL,
 payload_sealed text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_provider_inbox BEFORE UPDATE OR DELETE ON provider_inbox FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
ALTER TABLE outbox ALTER COLUMN intent_id DROP NOT NULL;
ALTER TABLE outbox ADD COLUMN resource_id text;
ALTER TABLE outbox ADD CONSTRAINT outbox_resource CHECK(intent_id IS NOT NULL OR resource_id IS NOT NULL);
CREATE UNIQUE INDEX outbox_resource_kind ON outbox(resource_id,kind) WHERE resource_id IS NOT NULL;
CREATE TABLE statement_runs (
 id text PRIMARY KEY,merchant_id text NOT NULL REFERENCES merchants,state text NOT NULL CHECK(state IN ('running','matched','review','failed')),
 matched integer NOT NULL DEFAULT 0,unmatched integer NOT NULL DEFAULT 0,scope text NOT NULL DEFAULT 'provider_ledger_snapshot',
 created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz
);
CREATE TABLE statement_items (
 id text PRIMARY KEY,run_id text NOT NULL REFERENCES statement_runs,provider_row_id text NOT NULL,
 resource_id text,difference_minor numeric(30,0) NOT NULL,expected_minor numeric(30,0),state text NOT NULL CHECK(state IN ('matched','mismatch','unmapped')),
 evidence jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(run_id,provider_row_id)
);
CREATE TRIGGER immutable_statement_items BEFORE UPDATE OR DELETE ON statement_items FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
