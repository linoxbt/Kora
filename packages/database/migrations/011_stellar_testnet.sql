ALTER TABLE ledger_accounts DROP CONSTRAINT ledger_accounts_asset_check;
ALTER TABLE ledger_accounts ADD CONSTRAINT ledger_accounts_asset_check CHECK(asset IN ('NGN','KES','GHS','USDC','KUSD'));
ALTER TABLE instruments DROP CONSTRAINT instruments_asset_check;
ALTER TABLE instruments ADD CONSTRAINT instruments_asset_check CHECK(asset IN ('NGN','KES','GHS','USDC','KUSD'));
ALTER TABLE quotes DROP CONSTRAINT quotes_provider_check;
ALTER TABLE intents DROP CONSTRAINT intents_provider_check;
ALTER TABLE instructions DROP CONSTRAINT instructions_provider_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_provider_check CHECK(provider IN ('kora-sandbox','paystack-test','stellar-testnet'));
ALTER TABLE intents ADD CONSTRAINT intents_provider_check CHECK(provider IN ('kora-sandbox','paystack-test','stellar-testnet'));
ALTER TABLE instructions ADD CONSTRAINT instructions_provider_check CHECK(provider IN ('kora-sandbox','paystack-test','stellar-testnet'));
ALTER TABLE quotes DROP CONSTRAINT quote_assets;
ALTER TABLE quotes ADD CONSTRAINT quote_assets CHECK(
 (provider='kora-sandbox' AND source_asset IN ('NGN','KES','GHS','USDC') AND destination_asset IN ('NGN','KES','GHS','USDC') AND source_asset<>destination_asset) OR
 (provider='paystack-test' AND source_asset='NGN' AND destination_asset='NGN') OR
 (provider='stellar-testnet' AND source_asset='NGN' AND destination_asset='KUSD')
);
INSERT INTO ledger_accounts(id,merchant_id,asset,purpose) SELECT m.id||':KUSD:'||p,m.id,'KUSD',p FROM merchants m CROSS JOIN unnest(ARRAY['available','reserved']) p ON CONFLICT DO NOTHING;
INSERT INTO ledger_accounts(id,asset,purpose) SELECT 'sys:KUSD:'||p,'KUSD',p FROM unnest(ARRAY['clearing','funding','fees']) p ON CONFLICT DO NOTHING;
CREATE TABLE stellar_accounts (
 instrument_id text PRIMARY KEY,merchant_id text NOT NULL,customer_id text NOT NULL,address text NOT NULL,
 issuer text NOT NULL,network text NOT NULL CHECK(network='testnet'),asset_code text NOT NULL CHECK(asset_code='KUSD'),binding text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(instrument_id,customer_id,merchant_id) REFERENCES instruments(id,customer_id,merchant_id),UNIQUE(merchant_id,customer_id,address,binding)
);
CREATE TRIGGER immutable_stellar_accounts BEFORE UPDATE OR DELETE ON stellar_accounts FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE TABLE stellar_transactions (
 instruction_id text PRIMARY KEY REFERENCES instructions,source_address text NOT NULL,sequence numeric(30,0) NOT NULL,
 transaction_hash text NOT NULL UNIQUE,signed_xdr text NOT NULL,binding text NOT NULL,expires_at bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(source_address,sequence)
);
CREATE TRIGGER immutable_stellar_transactions BEFORE UPDATE OR DELETE ON stellar_transactions FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE TABLE stellar_deposits (
 id text PRIMARY KEY,merchant_id text NOT NULL REFERENCES merchants,customer_id text NOT NULL,
 transaction_hash text NOT NULL UNIQUE,instrument_id text NOT NULL REFERENCES stellar_accounts,amount_minor numeric(30,0) NOT NULL CHECK(amount_minor>0),
 journal_id text NOT NULL REFERENCES journals,evidence jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(customer_id,merchant_id) REFERENCES customers(id,merchant_id)
);
CREATE TRIGGER immutable_stellar_deposits BEFORE UPDATE OR DELETE ON stellar_deposits FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
CREATE TABLE stellar_redemptions (
 id text PRIMARY KEY,merchant_id text NOT NULL REFERENCES merchants,hold_id text NOT NULL UNIQUE REFERENCES holds,source_minor numeric(30,0) NOT NULL,destination_minor numeric(30,0) NOT NULL,
 journal_id text NOT NULL REFERENCES journals,rate_basis text NOT NULL CHECK(rate_basis='fixture_1600_ngn_per_kusd'),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_stellar_redemptions BEFORE UPDATE OR DELETE ON stellar_redemptions FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
