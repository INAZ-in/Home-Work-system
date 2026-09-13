-- Name-only login is replaced by name+password. New installs never have
-- rows here yet, so a plain NOT NULL default is enough — no backfill needed.
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;
