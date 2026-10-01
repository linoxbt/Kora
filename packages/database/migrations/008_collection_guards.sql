ALTER TABLE collections DROP CONSTRAINT collections_state_check;
ALTER TABLE collections ADD CONSTRAINT collections_state_check CHECK(state IN ('processing','pending','succeeded','failed','unknown','held'));
CREATE FUNCTION guarded_collection_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.id,NEW.merchant_id,NEW.customer_id,NEW.provider_reference,NEW.amount_minor,NEW.input_sealed,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.merchant_id,OLD.customer_id,OLD.provider_reference,OLD.amount_minor,OLD.input_sealed,OLD.created_at)
 THEN RAISE EXCEPTION 'Collection financial instruction is immutable'; END IF;
 IF OLD.provider_id IS NOT NULL AND (NEW.provider_id,NEW.fee_minor,NEW.credited_minor) IS DISTINCT FROM (OLD.provider_id,OLD.fee_minor,OLD.credited_minor)
 THEN RAISE EXCEPTION 'Settled collection evidence is immutable'; END IF;
 IF NEW.state<>OLD.state AND NOT (
   (OLD.state IN ('processing','pending','unknown') AND NEW.state IN ('pending','unknown','succeeded','failed','held')) OR
   (OLD.state='held' AND NEW.state='succeeded')
 ) THEN RAISE EXCEPTION 'Invalid collection state transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guarded_collection_update BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION guarded_collection_update();
