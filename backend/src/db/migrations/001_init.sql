CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE semesters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  start_week_parity TEXT NOT NULL DEFAULT 'ch' CHECK (start_week_parity IN ('ch', 'zn')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  bmstu_group_uuid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_semester ON semesters (is_active) WHERE is_active;

CREATE TABLE pairs (
  pair_num SMALLINT PRIMARY KEY,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

CREATE TABLE lesson_templates (
  id SERIAL PRIMARY KEY,
  semester_id INT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  pair_num SMALLINT NOT NULL REFERENCES pairs(pair_num),
  week_parity TEXT NOT NULL CHECK (week_parity IN ('both', 'ch', 'zn')),
  subject_name TEXT NOT NULL,
  lesson_type TEXT NOT NULL DEFAULT '' CHECK (lesson_type IN ('lecture', 'seminar', 'lab', 'generated', '')),
  teacher TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (semester_id, day_of_week, pair_num, week_parity, subject_name)
);
CREATE INDEX idx_lesson_templates_semester ON lesson_templates (semester_id) WHERE is_active;

CREATE TABLE homework_items (
  id SERIAL PRIMARY KEY,
  lesson_template_id INT NOT NULL REFERENCES lesson_templates(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  due_date DATE,
  created_by INT REFERENCES users(id),
  updated_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_template_id, occurrence_date)
);
CREATE INDEX idx_homework_date ON homework_items (occurrence_date);

CREATE TABLE homework_completions (
  id SERIAL PRIMARY KEY,
  homework_item_id INT NOT NULL REFERENCES homework_items(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  done BOOLEAN NOT NULL DEFAULT true,
  completed_at TIMESTAMPTZ,
  UNIQUE (homework_item_id, user_id)
);
CREATE INDEX idx_completions_user ON homework_completions (user_id);

CREATE TABLE schedule_sync_runs (
  id SERIAL PRIMARY KEY,
  semester_id INT NOT NULL REFERENCES semesters(id),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  added_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  deactivated_count INT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '[]',
  error TEXT
);
CREATE INDEX idx_sync_runs_semester ON schedule_sync_runs (semester_id, run_at DESC);
