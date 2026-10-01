-- Settlement identity and net/fee amounts enter together in the same journal
-- transaction. Unsettled collections cannot acquire partial financial evidence.
ALTER TABLE collections ADD CONSTRAINT collection_settlement_evidence CHECK (
  (state IN ('succeeded','held') AND provider_id IS NOT NULL AND fee_minor IS NOT NULL
    AND credited_minor IS NOT NULL AND fee_minor>=0 AND credited_minor>0
    AND credited_minor+fee_minor=amount_minor)
  OR
  (state NOT IN ('succeeded','held') AND provider_id IS NULL AND fee_minor IS NULL AND credited_minor IS NULL)
);
