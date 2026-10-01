ALTER TABLE ledger_accounts DROP CONSTRAINT ledger_accounts_asset_check;
ALTER TABLE ledger_accounts ADD CONSTRAINT ledger_accounts_asset_check CHECK(asset IN ('NGN','KES','GHS','USDC','KUSD','XLM'));
INSERT INTO ledger_accounts(id,asset,purpose) VALUES('sys:XLM:provider_fees','XLM','provider_fees'),('sys:XLM:funding','XLM','funding');
CREATE UNIQUE INDEX stellar_address_binding ON stellar_accounts(address,binding);
