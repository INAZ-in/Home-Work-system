-- Registration now asks two elective-track questions (foreign language
-- track, descriptive-geometry group) so homework for subjects the group
-- splits into parallel sessions can be tracked per subgroup instead of
-- shared by everyone. Nullable: existing accounts haven't answered yet and
-- fall back to the shared ('') bucket until they do (see settings/admin).
ALTER TABLE users ADD COLUMN language_group TEXT CHECK (language_group IN ('en_strong', 'en_weak', 'de', 'es'));
ALTER TABLE users ADD COLUMN geometry_group SMALLINT CHECK (geometry_group IN (1, 2));

-- homework_items now carries which elective subgroup it belongs to ('' for
-- subjects the whole group shares). Empty string, not NULL, so the unique
-- constraint below actually enforces "one item per lesson slot per
-- subgroup" — Postgres treats NULLs as distinct from each other in unique
-- indexes, which would let duplicate shared-subject rows slip in.
ALTER TABLE homework_items ADD COLUMN subgroup TEXT NOT NULL DEFAULT '';
ALTER TABLE homework_items DROP CONSTRAINT homework_items_lesson_template_id_occurrence_date_key;
ALTER TABLE homework_items
  ADD CONSTRAINT homework_items_lesson_template_id_occurrence_date_subgroup_key
  UNIQUE (lesson_template_id, occurrence_date, subgroup);
