ALTER TABLE sessions ADD COLUMN api_key_id text REFERENCES api_keys;
ALTER TABLE sessions ADD COLUMN csrf_token text;
CREATE INDEX session_expiry ON sessions(expires_at);
ALTER TABLE api_keys ALTER COLUMN scopes SET DEFAULT ARRAY['payments:read','payments:write','customers:read','customers:write','webhooks:read','webhooks:write'];
CREATE TABLE request_logs (
  id text PRIMARY KEY, merchant_id text NOT NULL REFERENCES merchants, api_key_id text NOT NULL REFERENCES api_keys,
  request_id text NOT NULL UNIQUE, method text NOT NULL, path text NOT NULL, status_code integer NOT NULL,
  duration_ms integer NOT NULL CHECK(duration_ms>=0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX request_log_merchant ON request_logs(merchant_id,created_at DESC,id DESC);
