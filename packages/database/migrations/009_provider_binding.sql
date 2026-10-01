-- Keep old test fixtures unbound. Never infer a provider account for a payment
-- already created. New writes explicitly persist a non-secret key fingerprint.
ALTER TABLE bank_resolutions ADD COLUMN provider_binding text;
ALTER TABLE bank_accounts ADD COLUMN provider_binding text;
ALTER TABLE collections ADD COLUMN provider_binding text;
ALTER TABLE statement_runs ADD COLUMN provider_binding text;
CREATE OR REPLACE FUNCTION guarded_collection_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (NEW.id,NEW.merchant_id,NEW.customer_id,NEW.provider_reference,NEW.amount_minor,NEW.input_sealed,NEW.created_at,NEW.provider_binding)
     IS DISTINCT FROM (OLD.id,OLD.merchant_id,OLD.customer_id,OLD.provider_reference,OLD.amount_minor,OLD.input_sealed,OLD.created_at,OLD.provider_binding)
  THEN RAISE EXCEPTION 'Collection instruction is immutable'; END IF;
  IF OLD.state IN ('succeeded','held') AND (NEW.fee_minor,NEW.credited_minor,NEW.provider_id) IS DISTINCT FROM (OLD.fee_minor,OLD.credited_minor,OLD.provider_id)
  THEN RAISE EXCEPTION 'Collection settlement evidence is immutable'; END IF;
  IF NEW.state<>OLD.state AND NOT (
    (OLD.state IN ('processing','pending','unknown') AND NEW.state IN ('pending','unknown','succeeded','failed','held')) OR
    (OLD.state='held' AND NEW.state='succeeded')
  ) THEN RAISE EXCEPTION 'Invalid collection state transition'; END IF;
  RETURN NEW;
END $$;
