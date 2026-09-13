-- Admin-gated per-user permission: personal plans are private notes/tasks
-- tied to a date, visible only to the account that wrote them (not even an
-- admin can read another user's plan text) — off by default, an admin
-- switches it on for whichever accounts should have it.
ALTER TABLE users ADD COLUMN can_create_plans BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE personal_plans (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_personal_plans_user_date ON personal_plans (user_id, plan_date);
