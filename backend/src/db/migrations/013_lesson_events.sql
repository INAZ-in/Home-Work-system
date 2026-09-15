-- Admin-set marker on one specific lesson occurrence (e.g. "КР" on Monday's
-- Матан) — surfaced schedule-wide by the "Предстоящие мероприятия" block.
-- One marker per occurrence, not split by subgroup like homework_items
-- (these apply to the whole lesson slot), so it's a plain upsert on the
-- (lesson_template_id, occurrence_date) pair.
CREATE TABLE lesson_events (
  lesson_template_id INT NOT NULL REFERENCES lesson_templates(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('rk', 'kr', 'module_end', 'rabotka')),
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_template_id, occurrence_date)
);
