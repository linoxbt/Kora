CREATE FUNCTION guard_console_identity_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW.provider,NEW.app_id,NEW.subject,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.provider,OLD.app_id,OLD.subject,OLD.created_at) THEN
    RAISE EXCEPTION 'Console identity bindings are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER console_identity_binding BEFORE UPDATE ON console_identities
  FOR EACH ROW EXECUTE FUNCTION guard_console_identity_binding();
