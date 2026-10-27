-- Nhexa's OAuth 2 authorization server: its clients, authorization codes, refresh tokens and
-- the consents users gave. Idempotent: running it again changes nothing.
-- Apply it in the Supabase SQL editor (dev and prod), in the `accounts` schema the API uses.

CREATE TABLE IF NOT EXISTS accounts.oauth_clients (
  client_id           TEXT PRIMARY KEY,
  -- sha256 of the secret, for confidential clients only (public ones have none).
  client_secret_hash  CHAR(64),
  type                TEXT NOT NULL CHECK (type IN ('public', 'confidential')),
  name                TEXT NOT NULL,
  logo_uri            TEXT,
  client_uri          TEXT,
  redirect_uris       TEXT[] NOT NULL,
  scopes              TEXT[] NOT NULL,
  -- 'manual': registered by Nhexa; 'dynamic': registered by itself (RFC 7591).
  registration        TEXT NOT NULL DEFAULT 'manual' CHECK (registration IN ('manual', 'dynamic')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts.oauth_codes (
  code_hash              CHAR(64) PRIMARY KEY,
  client_id              TEXT NOT NULL,
  user_id                TEXT NOT NULL,
  redirect_uri           TEXT NOT NULL,
  scopes                 TEXT[] NOT NULL,
  resource               TEXT NOT NULL,
  code_challenge         TEXT NOT NULL,
  code_challenge_method  TEXT NOT NULL CHECK (code_challenge_method = 'S256'),
  expires_at             TIMESTAMPTZ NOT NULL,
  used_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts.oauth_tokens (
  token_hash   CHAR(64) PRIMARY KEY,
  -- Every refresh token rotated from the same grant: reusing a rotated one revokes them all.
  family_id    TEXT NOT NULL,
  client_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  scopes       TEXT[] NOT NULL,
  resource     TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  rotated_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS oauth_tokens_family_idx ON accounts.oauth_tokens (family_id);
CREATE INDEX IF NOT EXISTS oauth_tokens_user_idx ON accounts.oauth_tokens (user_id);

CREATE TABLE IF NOT EXISTS accounts.oauth_consents (
  user_id     TEXT NOT NULL,
  client_id   TEXT NOT NULL,
  scopes      TEXT[] NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, client_id)
);

-- The API reaches them with Supabase's service role, as the other tables of `accounts`.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  accounts.oauth_clients, accounts.oauth_codes, accounts.oauth_tokens, accounts.oauth_consents
  TO service_role;

-- Secret material (hashes of codes, tokens and client secrets): only the API may read it.
-- Supabase grants new tables to `anon` and `authenticated` (the keys browsers hold, through
-- PostgREST), so those grants are taken back, and row level security is on with no policy, so
-- even a grant made later lets them see no row. The API's service role bypasses RLS.
-- Both statements can run again without changing anything.
REVOKE ALL ON
  accounts.oauth_clients, accounts.oauth_codes, accounts.oauth_tokens, accounts.oauth_consents
  FROM anon, authenticated;
ALTER TABLE accounts.oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts.oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts.oauth_consents ENABLE ROW LEVEL SECURITY;
