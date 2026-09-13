/**
 * One-off bootstrap: imports the static schedule JSON into `semesters` +
 * `pairs` + `lesson_templates`. This is only a fallback for the very first
 * boot in case the live LKS API (see ../../services/bmstuSync.ts) is
 * unreachable — normally the nightly sync (or `POST /api/admin/sync-now`)
 * keeps the schedule current instead.
 *
 * Usage:
 *   npm run seed -- --start=2026-08-31 --semester="Осень 2026" [--parity=ch]
 *                    [--file=data/schedule.json] [--group-uuid=...] [--no-activate]
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isMonday } from "../../services/weekParity.js";
import { pool } from "../pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ScheduleFileLesson {
  day: number;
  pair: number;
  week: "both" | "ch" | "zn";
  name: string;
  type: string;
  teacher: string;
  room: string;
}

interface ScheduleFile {
  title: string;
  pairs: { num: number; start: string; end: string }[];
  lessons: ScheduleFileLesson[];
}

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) out[arg.slice(2)] = true;
    else out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const startDate = typeof args.start === "string" ? args.start : undefined;
  if (!startDate) {
    console.error("Missing --start=YYYY-MM-DD (semester's week-1 Monday)");
    process.exit(1);
  }
  if (!isMonday(startDate)) {
    console.error(`--start=${startDate} is not a Monday`);
    process.exit(1);
  }

  const semesterName = typeof args.semester === "string" ? args.semester : "Текущий семестр";
  const startWeekParity = args.parity === "zn" ? "zn" : "ch";
  const activate = args["no-activate"] !== true;
  const groupUuid = typeof args["group-uuid"] === "string" ? args["group-uuid"] : undefined;
  const file = typeof args.file === "string" ? resolve(args.file) : join(__dirname, "data/schedule.json");

  const data = JSON.parse(readFileSync(file, "utf-8")) as ScheduleFile;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let semesterId: number;
    const existing = await client.query<{ id: number }>("SELECT id FROM semesters WHERE name = $1", [semesterName]);
    if (existing.rows.length > 0) {
      semesterId = existing.rows[0].id;
      await client.query(
        `UPDATE semesters
         SET start_date = $1, start_week_parity = $2, bmstu_group_uuid = COALESCE($3, bmstu_group_uuid)
         WHERE id = $4`,
        [startDate, startWeekParity, groupUuid ?? null, semesterId],
      );
      console.log(`Semester "${semesterName}" already exists (id=${semesterId}) — updated start date/parity.`);
    } else {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO semesters (name, start_date, start_week_parity, bmstu_group_uuid)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [semesterName, startDate, startWeekParity, groupUuid ?? null],
      );
      semesterId = inserted.rows[0].id;
      console.log(`Created semester "${semesterName}" (id=${semesterId}).`);
    }

    if (activate) {
      await client.query("UPDATE semesters SET is_active = false WHERE is_active AND id != $1", [semesterId]);
      await client.query("UPDATE semesters SET is_active = true WHERE id = $1", [semesterId]);
    }

    for (const pair of data.pairs) {
      await client.query(
        `INSERT INTO pairs (pair_num, start_time, end_time)
         VALUES ($1, $2, $3)
         ON CONFLICT (pair_num) DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time`,
        [pair.num, pair.start, pair.end],
      );
    }

    let count = 0;
    for (const lesson of data.lessons) {
      await client.query(
        `INSERT INTO lesson_templates
           (semester_id, day_of_week, pair_num, week_parity, subject_name, lesson_type, teacher, room, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT (semester_id, day_of_week, pair_num, week_parity, subject_name)
         DO UPDATE SET lesson_type = EXCLUDED.lesson_type, teacher = EXCLUDED.teacher,
                        room = EXCLUDED.room, is_active = true`,
        [semesterId, lesson.day, lesson.pair, lesson.week, lesson.name, lesson.type ?? "", lesson.teacher ?? "", lesson.room ?? ""],
      );
      count++;
    }

    await client.query("COMMIT");
    console.log(`Seeded ${count} lesson template rows for semester "${semesterName}".`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
