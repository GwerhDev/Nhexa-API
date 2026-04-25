ALTER TABLE accounts.users
  ADD COLUMN IF NOT EXISTS "twoFactorSecret"  text     NULL,
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "backupCodes"      text[]   NULL;
