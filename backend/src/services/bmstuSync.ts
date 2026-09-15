/**
 * Live schedule sync against the public ЛКС (lks.bmstu.ru) API. This is a
 * TypeScript port of the fetch/parse logic in `bmstu_schedule.py` at the
 * repo root (no auth required — same endpoints it uses):
 *   GET {BASE}/structure                     -- faculty/department/group tree
 *   GET {BASE}/schedules/groups/{uuid}/public -- one group's schedule
 */
import { pool } from "../db/pool.js";
import { getActiveSemester } from "./scheduleResolver.js";

const BASE = "https://lks.bmstu.ru/lks-back/api/v1";

type WeekCode = "both" | "ch" | "zn";
type LessonType = "lecture" | "seminar" | "lab" | "generated" | "";
const KNOWN_LESSON_TYPES = new Set<LessonType>(["lecture", "seminar", "lab", "generated", ""]);

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "Homework-sync/1.0" } });
  if (!res.ok) {
    throw new Error(`LKS request failed: ${res.status} ${res.statusText} (${url})`);
  }
  const body = (await res.json()) as { data: T };
  return body.data;
}

// --- group lookup (used once, from the admin UI, to fill in bmstu_group_uuid) ---

interface StructureNode {
  abbr?: string;
  name?: string;
  uuid?: string;
  children?: StructureNode[];
}

export interface BmstuGroupMatch {
  name: string;
  uuid: string;
  path: string;
}

function flattenGroups(node: StructureNode, path: string[], out: BmstuGroupMatch[]): void {
  const children = node.children ?? [];
  const label = node.abbr || node.name || "";
  const newPath = label ? [...path, label] : path;

  if (node.uuid && children.length === 0) {
    out.push({ name: node.abbr || node.name || "", uuid: node.uuid, path: newPath.join(" / ") });
    return;
  }
  for (const child of children) flattenGroups(child, newPath, out);
}

export async function findBmstuGroups(query: string): Promise<BmstuGroupMatch[]> {
  const structure = await fetchJson<StructureNode>(`${BASE}/structure`);
  const all: BmstuGroupMatch[] = [];
  flattenGroups(structure, [], all);
  const q = query.trim().toLowerCase();
  return all.filter((g) => g.name && g.name.toLowerCase().includes(q));
}

// --- schedule fetch + normalization ---

interface RawTeacher {
  lastName?: string;
  firstName?: string;
  middleName?: string;
}

interface RawAudience {
  name?: string;
}

interface RawLesson {
  day: number;
  time: number;
  startTime?: string;
  endTime?: string;
  week?: string | null;
  discipline?: { shortName?: string; fullName?: string; abbr?: string; actType?: string };
  teachers?: RawTeacher[];
  audiences?: RawAudience[];
}

interface GroupScheduleResponse {
  title?: string;
  schedule: RawLesson[];
}

async function fetchGroupSchedule(groupUuid: string): Promise<GroupScheduleResponse> {
  return fetchJson<GroupScheduleResponse>(`${BASE}/schedules/groups/${groupUuid}/public`);
}

interface NormalizedLesson {
  day: number;
  pair: number;
  week: WeekCode;
  subject: string;
  type: LessonType;
  teacher: string;
  room: string;
  startTime?: string;
  endTime?: string;
  /** Overrides the shared pair-slot time (see migration 010) — set when the subject text carries its own real start time, e.g. ФКиС's "ФКиС 09:25 Измайлово". */
  startTimeOverride?: string;
  endTimeOverride?: string;
}

const LESSON_DURATION_MINUTES = 90;

/** "09:25" + 90 -> "10:55". Wraps at 24h, though that never comes up for a class start time. */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Matches e.g. "ФКиС 09:25 Измайлово" — for at least this one subject, LKS's
// own startTime/endTime fields carry the *nominal* pair-slot time rather
// than the real one, so the deviation only shows up as a remark in the
// subject text. Checked first, below, as it's more specific than the
// startTime-based fallback and doesn't depend on comparing against other
// lessons in the same pair.
const SUBJECT_TIME_OVERRIDE = /^ФКиС\s+(\d{1,2}:\d{2})\b/;

function extractTimeOverride(subject: string): { startTimeOverride: string; endTimeOverride: string } | null {
  const match = SUBJECT_TIME_OVERRIDE.exec(subject);
  if (!match) return null;
  const startTimeOverride = match[1].padStart(5, "0");
  return { startTimeOverride, endTimeOverride: addMinutes(startTimeOverride, LESSON_DURATION_MINUTES) };
}

/**
 * The most common {start,end} LKS reports for each pair number — used as
 * that pair's canonical slot time (see `pairs` table) instead of naively
 * trusting whichever lesson happened to come first in the API response,
 * which could pick an oddball lesson's time as "the" pair-3 time for
 * everyone. Robust as long as a real time deviation (like Введение в
 * специальность actually starting at 12:25 while every other pair-3 lesson
 * starts at 12:15) is the minority case for that pair, which it always is.
 */
function canonicalPairTimes(lessons: NormalizedLesson[]): Map<number, { start: string; end: string }> {
  const countsByPair = new Map<number, Map<string, number>>();
  for (const l of lessons) {
    if (!l.startTime || !l.endTime) continue;
    const counts = countsByPair.get(l.pair) ?? new Map<string, number>();
    const key = `${l.startTime}|${l.endTime}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    countsByPair.set(l.pair, counts);
  }
  const result = new Map<number, { start: string; end: string }>();
  for (const [pairNum, counts] of countsByPair) {
    let bestKey: string | null = null;
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }
    if (bestKey) {
      const [start, end] = bestKey.split("|");
      result.set(pairNum, { start, end });
    }
  }
  return result;
}

/**
 * Any lesson whose own LKS startTime/endTime don't match its pair's
 * canonical time (see canonicalPairTimes above) gets those exact times as
 * its override — the general form of the ФКиС text-parsing case above, but
 * driven by LKS's actual per-lesson time fields instead of a hand-maintained
 * regex, so a *new* subject that quietly starts at a different time (like
 * Введение в специальность really starting at 12:25, not pair 3's nominal
 * 12:15) is picked up automatically on the next sync.
 */
function applyStartTimeDeviations(lessons: NormalizedLesson[], canonical: Map<number, { start: string; end: string }>): void {
  for (const l of lessons) {
    if (l.startTimeOverride) continue; // text-based override already found
    if (!l.startTime || !l.endTime) continue;
    const pairCanonical = canonical.get(l.pair);
    if (!pairCanonical) continue;
    if (l.startTime !== pairCanonical.start || l.endTime !== pairCanonical.end) {
      l.startTimeOverride = l.startTime;
      l.endTimeOverride = l.endTime;
    }
  }
}

function normalizeLessonType(raw: string | undefined): LessonType {
  const value = (raw ?? "") as LessonType;
  if (KNOWN_LESSON_TYPES.has(value)) return value;
  console.warn(`[bmstuSync] Unknown lesson type "${raw}" from LKS API, storing as empty string`);
  return "";
}

function normalizeWeek(raw: string | null | undefined): WeekCode {
  if (raw === null || raw === undefined || raw === "all") return "both";
  if (raw === "ch" || raw === "zn") return raw;
  console.warn(`[bmstuSync] Unknown week code "${raw}" from LKS API, treating as "both"`);
  return "both";
}

function normalizeLesson(raw: RawLesson): NormalizedLesson {
  const disc = raw.discipline ?? {};
  const subject = disc.shortName || disc.fullName || disc.abbr || "?";
  const teachers = raw.teachers ?? [];
  const teacher = teachers
    .map((t) => `${t.lastName ?? ""} ${(t.firstName ?? "").slice(0, 1)}.${(t.middleName ?? "").slice(0, 1)}.`)
    .join(", ");
  const room = (raw.audiences ?? [])
    .map((a) => a.name)
    .filter((n): n is string => Boolean(n))
    .join(", ");

  return {
    day: raw.day,
    pair: raw.time,
    week: normalizeWeek(raw.week),
    subject,
    type: normalizeLessonType(disc.actType),
    teacher,
    room,
    startTime: raw.startTime,
    endTime: raw.endTime,
    ...extractTimeOverride(subject),
  };
}

function naturalKey(l: { day: number; pair: number; week: string; subject: string }): string {
  return `${l.day}|${l.pair}|${l.week}|${l.subject}`;
}

// --- diff + apply ---

export interface SyncChange {
  type: "added" | "updated" | "deactivated";
  day: number;
  pair: number;
  parity: string;
  subject: string;
  field?: string;
  old?: string;
  new?: string;
}

export interface SyncResult {
  status: "ok" | "error";
  addedCount: number;
  updatedCount: number;
  deactivatedCount: number;
  details: SyncChange[];
  error?: string;
}

interface DbTemplateRow {
  id: number;
  day_of_week: number;
  pair_num: number;
  week_parity: string;
  subject_name: string;
  lesson_type: string;
  teacher: string;
  room: string;
  start_time_override: string | null;
  end_time_override: string | null;
}

export async function runScheduleSync(): Promise<SyncResult> {
  const semester = await getActiveSemester();
  if (!semester) {
    console.warn("[bmstuSync] No active semester configured — skipping sync.");
    return {
      status: "error",
      addedCount: 0,
      updatedCount: 0,
      deactivatedCount: 0,
      details: [],
      error: "No active semester configured",
    };
  }

  const client = await pool.connect();
  try {
    if (!semester.bmstuGroupUuid) {
      throw new Error("Active semester has no bmstu_group_uuid configured");
    }

    const remote = await fetchGroupSchedule(semester.bmstuGroupUuid);
    const liveLessons = (remote.schedule ?? [])
      .filter((l) => l.day >= 1 && l.day <= 6)
      .map(normalizeLesson);

    const pairTimes = canonicalPairTimes(liveLessons);
    applyStartTimeDeviations(liveLessons, pairTimes);

    const dbTemplatesRes = await client.query<DbTemplateRow>(
      `SELECT id, day_of_week, pair_num, week_parity, subject_name, lesson_type, teacher, room,
              start_time_override::text AS start_time_override, end_time_override::text AS end_time_override
       FROM lesson_templates
       WHERE semester_id = $1 AND is_active`,
      [semester.id],
    );

    const dbByKey = new Map(
      dbTemplatesRes.rows.map((r) => [
        naturalKey({ day: r.day_of_week, pair: r.pair_num, week: r.week_parity, subject: r.subject_name }),
        r,
      ]),
    );
    const liveByKey = new Map(liveLessons.map((l) => [naturalKey(l), l]));

    const details: SyncChange[] = [];
    let addedCount = 0;
    let updatedCount = 0;
    let deactivatedCount = 0;

    await client.query("BEGIN");

    for (const [pairNum, times] of pairTimes) {
      await client.query(
        `INSERT INTO pairs (pair_num, start_time, end_time)
         VALUES ($1, $2, $3)
         ON CONFLICT (pair_num) DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time`,
        [pairNum, times.start, times.end],
      );
    }

    for (const [key, live] of liveByKey) {
      const existing = dbByKey.get(key);
      if (!existing) {
        await client.query(
          `INSERT INTO lesson_templates
             (semester_id, day_of_week, pair_num, week_parity, subject_name, lesson_type, teacher, room,
              start_time_override, end_time_override, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
           ON CONFLICT (semester_id, day_of_week, pair_num, week_parity, subject_name)
           DO UPDATE SET lesson_type = EXCLUDED.lesson_type, teacher = EXCLUDED.teacher,
                          room = EXCLUDED.room, start_time_override = EXCLUDED.start_time_override,
                          end_time_override = EXCLUDED.end_time_override, is_active = true`,
          [
            semester.id,
            live.day,
            live.pair,
            live.week,
            live.subject,
            live.type,
            live.teacher,
            live.room,
            live.startTimeOverride ?? null,
            live.endTimeOverride ?? null,
          ],
        );
        addedCount++;
        details.push({ type: "added", day: live.day, pair: live.pair, parity: live.week, subject: live.subject });
        continue;
      }

      const existingStartOverride = existing.start_time_override?.slice(0, 5) ?? null;
      const liveStartOverride = live.startTimeOverride ?? null;
      const liveEndOverride = live.endTimeOverride ?? null;

      const changedFields: { field: string; old: string; new: string }[] = [];
      if (existing.lesson_type !== live.type) changedFields.push({ field: "type", old: existing.lesson_type, new: live.type });
      if (existing.teacher !== live.teacher) changedFields.push({ field: "teacher", old: existing.teacher, new: live.teacher });
      if (existing.room !== live.room) changedFields.push({ field: "room", old: existing.room, new: live.room });
      if (existingStartOverride !== liveStartOverride) {
        changedFields.push({ field: "startTimeOverride", old: existingStartOverride ?? "", new: liveStartOverride ?? "" });
      }

      if (changedFields.length > 0) {
        await client.query(
          `UPDATE lesson_templates
           SET lesson_type = $1, teacher = $2, room = $3, start_time_override = $4, end_time_override = $5
           WHERE id = $6`,
          [live.type, live.teacher, live.room, liveStartOverride, liveEndOverride, existing.id],
        );
        updatedCount++;
        for (const f of changedFields) {
          details.push({
            type: "updated",
            day: live.day,
            pair: live.pair,
            parity: live.week,
            subject: live.subject,
            field: f.field,
            old: f.old,
            new: f.new,
          });
        }
      }
    }

    for (const [key, existing] of dbByKey) {
      if (!liveByKey.has(key)) {
        await client.query(`UPDATE lesson_templates SET is_active = false WHERE id = $1`, [existing.id]);
        deactivatedCount++;
        details.push({
          type: "deactivated",
          day: existing.day_of_week,
          pair: existing.pair_num,
          parity: existing.week_parity,
          subject: existing.subject_name,
        });
      }
    }

    await client.query(
      `INSERT INTO schedule_sync_runs (semester_id, status, added_count, updated_count, deactivated_count, details)
       VALUES ($1, 'ok', $2, $3, $4, $5)`,
      [semester.id, addedCount, updatedCount, deactivatedCount, JSON.stringify(details)],
    );

    await client.query("COMMIT");

    return { status: "ok", addedCount, updatedCount, deactivatedCount, details };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    console.error("[bmstuSync] Sync failed:", message);
    try {
      await client.query(`INSERT INTO schedule_sync_runs (semester_id, status, error) VALUES ($1, 'error', $2)`, [
        semester.id,
        message,
      ]);
    } catch (logErr) {
      console.error("[bmstuSync] Failed to log sync error:", logErr);
    }
    return { status: "error", addedCount: 0, updatedCount: 0, deactivatedCount: 0, details: [], error: message };
  } finally {
    client.release();
  }
}
