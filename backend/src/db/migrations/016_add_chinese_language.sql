-- Add Chinese as a foreign-language track option alongside the existing
-- English/German/Spanish choices (see migration 005). Existing rows are
-- untouched — this only widens the allowed values on `language_group`, it
-- doesn't rename or remove any of them, so nobody's saved answer changes.
-- The constraint is looked up dynamically instead of by its default-generated
-- name, since that name isn't guaranteed across Postgres versions/history.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass
    AND pg_get_constraintdef(oid) LIKE '%language_group%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE users ADD CONSTRAINT users_language_group_check
  CHECK (language_group IN ('en_strong', 'en_weak', 'de', 'es', 'zh'));
