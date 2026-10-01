ALTER TABLE api_keys ADD CONSTRAINT api_key_identity_owner UNIQUE(id,merchant_id);
ALTER TABLE control_evidence ADD CONSTRAINT evidence_operator_owner FOREIGN KEY(operator_id,merchant_id) REFERENCES control_operators(id,merchant_id);
ALTER TABLE control_requests ADD CONSTRAINT requester_operator_owner FOREIGN KEY(requested_by,merchant_id) REFERENCES control_operators(id,merchant_id);
ALTER TABLE control_requests ADD CONSTRAINT reviewer_operator_owner FOREIGN KEY(reviewed_by,merchant_id) REFERENCES control_operators(id,merchant_id);
ALTER TABLE control_audit ADD CONSTRAINT audit_operator_owner FOREIGN KEY(operator_id,merchant_id) REFERENCES control_operators(id,merchant_id);
ALTER TABLE control_audit ADD CONSTRAINT audit_key_owner FOREIGN KEY(actor_key_id,merchant_id) REFERENCES api_keys(id,merchant_id);
ALTER TABLE control_requests ADD CONSTRAINT review_state_complete CHECK((state='pending' AND reviewed_by IS NULL AND review_reason IS NULL AND reviewed_at IS NULL) OR (state IN ('approved','rejected') AND reviewed_by IS NOT NULL AND review_reason IS NOT NULL AND reviewed_at IS NOT NULL));
CREATE FUNCTION guard_control_operator_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.id,NEW.merchant_id,NEW.external_subject,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.merchant_id,OLD.external_subject,OLD.created_at) THEN RAISE EXCEPTION 'Operator identity is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_control_operator_identity BEFORE UPDATE ON control_operators FOR EACH ROW EXECUTE FUNCTION guard_control_operator_identity();
