-- Measure actual receipt insertion time, including acceptance work within the transaction.
-- Existing immutable receipt timestamps are preserved.
ALTER TABLE network_movements ALTER COLUMN created_at SET DEFAULT clock_timestamp();
