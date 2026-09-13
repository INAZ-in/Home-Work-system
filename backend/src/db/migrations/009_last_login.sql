-- Tracks when a user last actually logged in (not every authenticated
-- request — that would mean a write on every page load for no real
-- benefit), so an admin can see who's actually using the app. NULL means
-- "registered but never logged in again" (registration itself counts as
-- the first login — see routes/auth.ts).
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
