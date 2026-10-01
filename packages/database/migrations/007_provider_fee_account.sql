-- Correct the unused system account ID in workspaces that applied the first
-- local-rail scaffold. No financial entries are changed or removed.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM ledger_accounts WHERE id='system:NGN:provider_fees') THEN
  IF EXISTS(SELECT 1 FROM ledger_entries WHERE account_id='system:NGN:provider_fees') THEN
   RAISE EXCEPTION 'Cannot rename a provider fee account with posted entries';
  END IF;
  ALTER TABLE ledger_accounts DISABLE TRIGGER immutable_accounts;
  UPDATE ledger_accounts SET id='sys:NGN:provider_fees' WHERE id='system:NGN:provider_fees';
  ALTER TABLE ledger_accounts ENABLE TRIGGER immutable_accounts;
 END IF;
END $$;
