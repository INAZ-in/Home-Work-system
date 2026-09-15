-- Subject-level file attachments (textbooks, reference materials) — unlike
-- homework_files these aren't tied to one lesson occurrence or subgroup;
-- they belong to the subject as a whole and are visible to everyone viewing
-- that subject's "Предметы" page, not just the uploader's own group.
CREATE TABLE subject_files (
  id SERIAL PRIMARY KEY,
  subject_name TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INT NOT NULL,
  data BYTEA NOT NULL,
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subject_files_subject ON subject_files (subject_name);
