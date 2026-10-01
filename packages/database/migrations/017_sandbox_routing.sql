INSERT INTO network_participants VALUES('nigeria-payout-alternate','Nigeria alternate sandbox payout','NG','destination','NGN','sim:nigeria-alternate:v1',true,'sandbox',false);
INSERT INTO network_corridors VALUES('ng-ng-alternate','NGN','NGN','nigeria-sandbox','settlement-sandbox','nigeria-payout-alternate',true,100000000,'sandbox');
CREATE TABLE network_route_options(corridor_id text PRIMARY KEY REFERENCES network_corridors,family text NOT NULL CHECK(family='nigeria-ngn'),priority integer NOT NULL CHECK(priority>=0));
INSERT INTO network_route_options VALUES('ng-ng-sandbox','nigeria-ngn',10),('ng-ng-alternate','nigeria-ngn',20);
CREATE TABLE network_health_overrides(
 id text PRIMARY KEY,merchant_id text NOT NULL REFERENCES merchants,participant_id text NOT NULL REFERENCES network_participants,
 provider_binding text NOT NULL,status text NOT NULL CHECK(status IN ('healthy','degraded','unavailable')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 240),actor_key_id text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 CHECK(expires_at>observed_at AND expires_at<=observed_at+interval '5 minutes'),
 FOREIGN KEY(actor_key_id,merchant_id) REFERENCES api_keys(id,merchant_id)
);
CREATE INDEX network_health_latest ON network_health_overrides(merchant_id,participant_id,observed_at DESC,id DESC);
CREATE TRIGGER immutable_network_health BEFORE UPDATE OR DELETE ON network_health_overrides FOR EACH ROW EXECUTE FUNCTION immutable_financial_record();
