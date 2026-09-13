-- Deleting a user must not be blocked by homework they once wrote/edited —
-- keep the homework, just drop the attribution (both columns are already
-- nullable). homework_completions.user_id is already ON DELETE CASCADE.
ALTER TABLE homework_items DROP CONSTRAINT homework_items_created_by_fkey;
ALTER TABLE homework_items
  ADD CONSTRAINT homework_items_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE homework_items DROP CONSTRAINT homework_items_updated_by_fkey;
ALTER TABLE homework_items
  ADD CONSTRAINT homework_items_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
