-- File attachments on homework items (scanned assignment sheets, reference
-- docs, etc). Stored as bytea in Postgres rather than on disk — this app's
-- files are small (individual homework attachments, not media libraries)
-- and keeping them in the DB means they're covered by the same volume/
-- backup as everything else, with no separate storage volume to manage.
CREATE TABLE homework_files (
  id SERIAL PRIMARY KEY,
  homework_item_id INT NOT NULL REFERENCES homework_items(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INT NOT NULL,
  data BYTEA NOT NULL,
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_homework_files_item ON homework_files (homework_item_id);
