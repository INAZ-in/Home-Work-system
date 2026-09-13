-- Ships a ready-to-use admin account out of the box (name "admin",
-- password "admin123" — the app-wide 6-character password minimum rules
-- out plain "admin") so a fresh install doesn't require registering first
-- to get anything done. Hash below is bcrypt("admin123", cost 10) — bcrypt
-- hashes are self-contained (salt included), so a hard-coded one here
-- verifies the same as one generated at runtime via services/auth.ts.
-- ON CONFLICT is belt-and-suspenders: migrations already run at most once
-- (tracked in schema_migrations), but this keeps the migration itself safe
-- to reapply if that bookkeeping is ever bypassed.
INSERT INTO users (name, password_hash, is_admin)
VALUES ('admin', '$2a$10$4ywMbKsDDi2gnp1WNeLsW.H8W/0sxqf1FVeZTWqMDOvoNo4rLYuIq', true)
ON CONFLICT (name) DO NOTHING;
