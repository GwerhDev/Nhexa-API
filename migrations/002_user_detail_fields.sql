ALTER TABLE accounts.users
  ALTER COLUMN "password"                  DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "firstName"     text        NULL,
  ADD COLUMN IF NOT EXISTS "lastName"      text        NULL,
  ADD COLUMN IF NOT EXISTS "birthDate"     date        NULL,
  ADD COLUMN IF NOT EXISTS "countryId"     text        NULL,
  ADD COLUMN IF NOT EXISTS "phone"         text        NULL,
  ADD COLUMN IF NOT EXISTS "phoneCode"     text        NULL,
  ADD COLUMN IF NOT EXISTS "passwordSetAt" timestamptz NULL;
