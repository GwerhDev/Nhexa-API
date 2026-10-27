-- The apps a user connected (their OAuth consents), as accounts lists them. Idempotent: running
-- it again changes nothing. Apply it in the Supabase SQL editor (dev and prod), after
-- 2026-10-26-oauth.sql.

-- What the user saw when they approved the app, kept with their consent: an app identified by
-- its metadata document's URL is listed without fetching it, and as it was approved.
ALTER TABLE accounts.oauth_consents ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE accounts.oauth_consents ADD COLUMN IF NOT EXISTS client_logo_uri TEXT;
-- When the app last got a token or reached StreamBy for the user.
ALTER TABLE accounts.oauth_consents ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Revoking an app ends its refresh tokens for the user: found by both.
CREATE INDEX IF NOT EXISTS oauth_tokens_user_client_idx ON accounts.oauth_tokens (user_id, client_id);
