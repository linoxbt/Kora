CREATE FUNCTION guarded_hold_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (NEW.id,NEW.merchant_id,NEW.asset,NEW.amount,NEW.reference,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.merchant_id,OLD.asset,OLD.amount,OLD.reference,OLD.created_at)
  THEN RAISE EXCEPTION 'Hold financial instruction is immutable'; END IF;
  IF NEW.state<>OLD.state AND NOT(OLD.state='held' AND NEW.state IN ('captured','released'))
  THEN RAISE EXCEPTION 'Invalid hold state transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guarded_hold_update BEFORE UPDATE ON holds FOR EACH ROW EXECUTE FUNCTION guarded_hold_update();
CREATE FUNCTION guarded_instruction_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (NEW.id,NEW.intent_id,NEW.provider_ref,NEW.request,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.intent_id,OLD.provider_ref,OLD.request,OLD.created_at)
  THEN RAISE EXCEPTION 'Provider instruction contents are immutable'; END IF;
  IF NEW.state<>OLD.state AND NOT (
    (OLD.state='created' AND NEW.state IN ('submitting','unknown','confirmed','rejected')) OR
    (OLD.state='submitting' AND NEW.state IN ('unknown','confirmed','rejected')) OR
    (OLD.state='unknown' AND NEW.state IN ('submitting','confirmed','rejected'))
  ) THEN RAISE EXCEPTION 'Invalid provider instruction transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guarded_instruction_update BEFORE UPDATE ON instructions FOR EACH ROW EXECUTE FUNCTION guarded_instruction_update();
ALTER TABLE instruments ADD CONSTRAINT instrument_customer_identity UNIQUE(id,customer_id,merchant_id);
ALTER TABLE intents ADD CONSTRAINT intent_instrument_customer FOREIGN KEY(destination_instrument_id,customer_id,merchant_id) REFERENCES instruments(id,customer_id,merchant_id);
ALTER TABLE holds ADD CONSTRAINT hold_amount_identity UNIQUE(id,merchant_id,asset,amount);
ALTER TABLE intents ADD CONSTRAINT intent_hold_amount FOREIGN KEY(hold_id,merchant_id,source_asset,source_minor) REFERENCES holds(id,merchant_id,asset,amount);
