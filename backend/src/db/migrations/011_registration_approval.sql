-- Self-registration now needs sign-off from any admin before the account
-- can log in, so a signup can't grant itself full access unsupervised.
-- Existing accounts and admin-created ones (routes/admin.ts POST /users)
-- default to already approved via the column default — only the
-- self-registration endpoint ever inserts a row with approved = false
-- (except the very first account, which bootstraps as admin).
ALTER TABLE users ADD COLUMN approved BOOLEAN NOT NULL DEFAULT true;
