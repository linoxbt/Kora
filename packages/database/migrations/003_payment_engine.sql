ALTER TABLE merchants ADD COLUMN enabled boolean NOT NULL DEFAULT true;
ALTER TABLE merchants ADD COLUMN max_source_minor numeric(30,0) NOT NULL DEFAULT 1000000000000 CHECK(max_source_minor>0);
ALTER TABLE api_keys ADD COLUMN scopes text[] NOT NULL DEFAULT ARRAY['payments:read','payments:write','customers:read','customers:write','webhooks:read','webhooks:write'];
CREATE TABLE customers (
  id text PRIMARY KEY, merchant_id text NOT NULL REFERENCES merchants, name text NOT NULL,
  verification_state text NOT NULL DEFAULT 'sandbox_verified' CHECK(verification_state IN ('sandbox_verified','held')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,merchant_id)
);
CREATE TABLE instruments (
  id text PRIMARY KEY, merchant_id text NOT NULL REFERENCES merchants, customer_id text NOT NULL,
  type text NOT NULL CHECK(type IN ('bank_account','mobile_money','stellar_account')),
  asset text NOT NULL CHECK(asset IN ('NGN','KES','GHS','USDC')), label text NOT NULL,
  sandbox_identifier text NOT NULL, verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,merchant_id),
  FOREIGN KEY(customer_id,merchant_id) REFERENCES customers(id,merchant_id)
);
ALTER TABLE quotes ADD CONSTRAINT quote_merchant_unique UNIQUE(id,merchant_id);
ALTER TABLE quotes ADD CONSTRAINT quote_assets CHECK(source_asset IN ('NGN','KES','GHS','USDC') AND destination_asset IN ('NGN','KES','GHS','USDC') AND source_asset<>destination_asset);
ALTER TABLE holds ADD CONSTRAINT hold_merchant_unique UNIQUE(id,merchant_id);
ALTER TABLE intents ADD COLUMN hold_id text UNIQUE;
ALTER TABLE intents ADD COLUMN customer_id text;
ALTER TABLE intents ADD COLUMN destination_instrument_id text;
ALTER TABLE intents ADD COLUMN compliance_state text NOT NULL DEFAULT 'sandbox_allowed' CHECK(compliance_state IN ('sandbox_allowed','held'));
ALTER TABLE intents ADD CONSTRAINT intent_merchant_unique UNIQUE(id,merchant_id);
ALTER TABLE intents ADD CONSTRAINT intent_hold_ownership FOREIGN KEY(hold_id,merchant_id) REFERENCES holds(id,merchant_id);
ALTER TABLE intents ADD CONSTRAINT intent_quote_ownership FOREIGN KEY(quote_id,merchant_id) REFERENCES quotes(id,merchant_id);
ALTER TABLE intents ADD CONSTRAINT intent_customer_ownership FOREIGN KEY(customer_id,merchant_id) REFERENCES customers(id,merchant_id);
ALTER TABLE intents ADD CONSTRAINT intent_instrument_ownership FOREIGN KEY(destination_instrument_id,merchant_id) REFERENCES instruments(id,merchant_id);
ALTER TABLE instructions DROP CONSTRAINT instructions_state_check;
ALTER TABLE instructions ADD CONSTRAINT instructions_state_check CHECK(state IN ('created','submitting','unknown','confirmed','rejected'));
ALTER TABLE instructions ADD COLUMN request jsonb;
ALTER TABLE instructions ADD COLUMN started_at timestamptz;
CREATE TABLE attempts (
  id text PRIMARY KEY, instruction_id text NOT NULL REFERENCES instructions,
  state text NOT NULL CHECK(state IN ('processing','unknown','confirmed','rejected')),
  error_code text, started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
ALTER TABLE fake_provider_movements ADD COLUMN evidence jsonb;
ALTER TABLE outbox ADD COLUMN locked_by text;
ALTER TABLE outbox ADD COLUMN locked_until timestamptz;
ALTER TABLE outbox ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE outbox ADD COLUMN last_error text;
CREATE INDEX outbox_pending ON outbox(available_at,id) WHERE processed_at IS NULL;
CREATE INDEX events_merchant_created ON events(merchant_id,created_at DESC,id DESC);
CREATE INDEX customer_merchant_created ON customers(merchant_id,created_at DESC,id DESC);
ALTER TABLE webhook_deliveries ADD COLUMN locked_by text;
ALTER TABLE webhook_deliveries ADD COLUMN locked_until timestamptz;
ALTER TABLE webhook_deliveries ADD CONSTRAINT delivery_state CHECK(state IN ('pending','delivered','failed'));
CREATE INDEX webhook_deliveries_pending ON webhook_deliveries(next_attempt_at,id) WHERE state='pending';
CREATE TRIGGER immutable_receipts BEFORE UPDATE OR DELETE ON receipts FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON intent_history FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE TRIGGER immutable_quotes BEFORE UPDATE OR DELETE ON quotes FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE FUNCTION guarded_intent_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (NEW.merchant_id,NEW.quote_id,NEW.type,NEW.source_asset,NEW.destination_asset,NEW.source_minor,NEW.destination_minor,NEW.fee_minor,NEW.beneficiary,NEW.reference,NEW.scenario,NEW.route,NEW.hold_id,NEW.customer_id,NEW.destination_instrument_id)
     IS DISTINCT FROM (OLD.merchant_id,OLD.quote_id,OLD.type,OLD.source_asset,OLD.destination_asset,OLD.source_minor,OLD.destination_minor,OLD.fee_minor,OLD.beneficiary,OLD.reference,OLD.scenario,OLD.route,OLD.hold_id,OLD.customer_id,OLD.destination_instrument_id)
  THEN RAISE EXCEPTION 'Intent financial instruction is immutable'; END IF;
  IF NEW.state<>OLD.state AND NOT (
    (OLD.state='processing' AND NEW.state IN ('unknown','succeeded','failed','canceled')) OR
    (OLD.state='unknown' AND NEW.state IN ('succeeded','failed')) OR
    (OLD.state='succeeded' AND NEW.state='returned')
  ) THEN RAISE EXCEPTION 'Invalid intent state transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guarded_intent_update BEFORE UPDATE ON intents FOR EACH ROW EXECUTE FUNCTION guarded_intent_update();
