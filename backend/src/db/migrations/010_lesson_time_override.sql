-- Some lessons (so far only ФКиС, held off-campus e.g. "Измайлово") run at a
-- time that doesn't match their nominal pair slot — LKS has no proper field
-- for this, so the real start time gets written into the subject text
-- instead (e.g. "ФКиС 09:25 Измайлово"). These columns let bmstuSync.ts
-- record a per-lesson time that overrides the shared `pairs` slot lookup in
-- scheduleResolver.ts. NULL (the common case) means "use the pair's slot".
ALTER TABLE lesson_templates ADD COLUMN start_time_override TIME;
ALTER TABLE lesson_templates ADD COLUMN end_time_override TIME;
