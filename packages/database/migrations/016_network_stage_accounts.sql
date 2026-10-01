ALTER TABLE ledger_accounts DROP CONSTRAINT ledger_accounts_purpose_check;
ALTER TABLE ledger_accounts ADD CONSTRAINT ledger_accounts_purpose_check CHECK(purpose IN ('available','reserved','clearing','fees','funding','provider_fees','network_settled','network_in_transit'));
INSERT INTO ledger_accounts(id,asset,purpose)
SELECT 'sys:'||a||':'||p,a,p FROM unnest(ARRAY['NGN','KUSD','KES']) a CROSS JOIN unnest(ARRAY['network_settled','network_in_transit']) p ON CONFLICT DO NOTHING;
