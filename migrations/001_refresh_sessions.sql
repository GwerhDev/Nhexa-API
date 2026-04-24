CREATE TABLE IF NOT EXISTS accounts.refresh_sessions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  user_role  text        NOT NULL DEFAULT 'user',
  token_hash text        NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  user_agent text        NULL,
  ip         text        NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id    ON accounts.refresh_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_token_hash ON accounts.refresh_sessions(token_hash);
