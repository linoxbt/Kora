ALTER TABLE outbox ADD COLUMN priority smallint NOT NULL DEFAULT 1 CHECK(priority BETWEEN 0 AND 2);
-- Existing jobs form the background backlog; newly admitted payments default to priority 1.
UPDATE outbox SET priority=0;
CREATE INDEX outbox_priority_schedule ON outbox(priority DESC,available_at,id) WHERE kind='execute' AND processed_at IS NULL;
