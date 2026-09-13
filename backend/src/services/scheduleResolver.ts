import { pool } from "../db/pool.js";
import type { ScheduleOccurrence } from "../types/schedule.js";
import { subgroupKey, subgroupLabel, type UserSubgroups } from "./subgroup.js";
import { dateRangeISO, dayOfWeekMonday1, resolveWeekParity, type WeekParity } from "./weekParity.js";

export interface ActiveSemester {
  id: number;
  name: string;
  startDate: string;
  startWeekParity: WeekParity;
  bmstuGroupUuid: string | null;
}

export async function getActiveSemester(): Promise<ActiveSemester | null> {
  const { rows } = await pool.query<{
    id: number;
    name: string;
    start_date: string;
    start_week_parity: WeekParity;
    bmstu_group_uuid: string | null;
  }>("SELECT id, name, start_date, start_week_parity, bmstu_group_uuid FROM semesters WHERE is_active LIMIT 1");
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    startWeekParity: row.start_week_parity,
    bmstuGroupUuid: row.bmstu_group_uuid,
  };
}

interface LessonTemplateRow {
  id: number;
  day_of_week: number;
  pair_num: number;
  week_parity: "both" | WeekParity;
  subject_name: string;
  lesson_type: string;
  teacher: string;
  room: string;
}

interface HomeworkRow {
  lesson_template_id: number;
  occurrence_date: string;
  homework_id: number;
  comment: string;
  due_date: string | null;
  updated_at: string;
  updated_by_name: string | null;
  done: boolean;
  subgroup: string;
}

export async function resolveSchedule(
  fromIso: string,
  toIso: string,
  user: UserSubgroups & { id: number },
  semester?: ActiveSemester | null,
): Promise<ScheduleOccurrence[]> {
  const activeSemester = semester === undefined ? await getActiveSemester() : semester;
  if (!activeSemester) return [];

  const pairsRes = await pool.query<{ pair_num: number; start_time: string; end_time: string }>(
    "SELECT pair_num, start_time, end_time FROM pairs ORDER BY pair_num",
  );
  const pairsByNum = new Map(
    pairsRes.rows.map((p) => [
      p.pair_num,
      { num: p.pair_num, start: p.start_time.slice(0, 5), end: p.end_time.slice(0, 5) },
    ]),
  );

  const templatesRes = await pool.query<LessonTemplateRow>(
    `SELECT id, day_of_week, pair_num, week_parity, subject_name, lesson_type, teacher, room
     FROM lesson_templates
     WHERE semester_id = $1 AND is_active
     ORDER BY day_of_week, pair_num`,
    [activeSemester.id],
  );
  const templates = templatesRes.rows;
  const templateIds = templates.map((t) => t.id);

  const homeworkMap = new Map<string, HomeworkRow>();
  if (templateIds.length > 0) {
    const hwRes = await pool.query<HomeworkRow>(
      `SELECT hi.lesson_template_id, hi.occurrence_date::text AS occurrence_date, hi.id AS homework_id,
              hi.comment, hi.due_date::text AS due_date, hi.updated_at, u.name AS updated_by_name,
              hi.subgroup, COALESCE(hc.done, false) AS done
       FROM homework_items hi
       LEFT JOIN users u ON u.id = hi.updated_by
       LEFT JOIN homework_completions hc ON hc.homework_item_id = hi.id AND hc.user_id = $1
       WHERE hi.occurrence_date BETWEEN $2 AND $3 AND hi.lesson_template_id = ANY($4::int[])`,
      [user.id, fromIso, toIso, templateIds],
    );
    for (const row of hwRes.rows) {
      homeworkMap.set(`${row.lesson_template_id}|${row.occurrence_date}|${row.subgroup}`, row);
    }
  }

  const occurrences: ScheduleOccurrence[] = [];
  for (const dateIso of dateRangeISO(fromIso, toIso)) {
    const dow = dayOfWeekMonday1(dateIso);
    if (dow > 6) continue; // no Sunday lessons in this schedule
    const parity = resolveWeekParity(dateIso, activeSemester.startDate, activeSemester.startWeekParity);
    for (const t of templates) {
      if (t.day_of_week !== dow) continue;
      if (t.week_parity !== "both" && t.week_parity !== parity) continue;
      const hw = homeworkMap.get(`${t.id}|${dateIso}|${subgroupKey(t.subject_name, t.lesson_type, user)}`);
      occurrences.push({
        date: dateIso,
        lessonTemplateId: t.id,
        pair: pairsByNum.get(t.pair_num) ?? { num: t.pair_num, start: "", end: "" },
        subject: t.subject_name,
        type: t.lesson_type,
        teacher: t.teacher,
        room: t.room,
        homework: hw
          ? {
              id: hw.homework_id,
              comment: hw.comment,
              dueDate: hw.due_date,
              updatedAt: hw.updated_at,
              updatedBy: hw.updated_by_name,
            }
          : null,
        done: hw ? hw.done : false,
        subgroupLabel: subgroupLabel(t.subject_name, t.lesson_type, user),
      });
    }
  }

  occurrences.sort((a, b) => (a.date === b.date ? a.pair.num - b.pair.num : a.date.localeCompare(b.date)));
  return occurrences;
}
