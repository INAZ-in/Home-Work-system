-- Some individual homework items are graded as a "module" submission rather
-- than a regular per-lesson assignment. Marked per item (checkbox in the
-- homework editor), not per subject — a subject can freely mix both kinds.
ALTER TABLE homework_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'regular' CHECK (kind IN ('regular', 'modular'));
