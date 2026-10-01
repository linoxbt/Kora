ALTER TABLE fake_provider_movements ADD CONSTRAINT one_fake_instruction_per_hold UNIQUE(hold_id);
