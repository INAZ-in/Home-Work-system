import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { filesByHomeworkId, getStorageUsage, MAX_TOTAL_STORAGE_BYTES, subjectFiles } from "../services/homeworkFiles.js";
import { getActiveSemester } from "../services/scheduleResolver.js";
import { subgroupKey, subgroupLabel } from "../services/subgroup.js";
import { addDaysISO, dayOfWeekMonday1, formatISODate, resolveWeekParity } from "../services/weekParity.js";
import type { LessonEventType, ScheduleOccurrence } from "../types/schedule.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const templateIdParam = z.coerce.number().int().positive();
const fileIdParam = z.coerce.number().int().positive();

const MAX_FILE_SIZE = 300 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

/**
 * Wraps multer's single-file middleware so a too-large/malformed upload
 * comes back as a normal 400 instead of falling through to the generic 500
 * handler, and repairs the uploaded filename's encoding.
 *
 * multipart/form-data has no way to declare a charset for the `filename`
 * field, so busboy (which multer uses) decodes it as Latin-1 — every
 * browser actually sends it as UTF-8, so a non-ASCII name (Cyrillic, etc.)
 * comes out as mojibake unless we redecode it here.
 */
function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "Файл слишком большой (максимум 300 МБ)"
          : "Не удалось загрузить файл";
      res.status(400).json({ error: message });
      return;
    }
    if (req.file) {
      req.file.originalname = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    }
    next();
  });
}

interface CandidateTemplate {
  id: number;
  day_of_week: number;
  week_parity: "both" | "ch" | "zn";
  pair_num: number;
  subject_name: string;
  lesson_type: string;
  teacher: string;
  room: string;
  start_time_override: string | null;
  end_time_override: string | null;
}

/** Earliest date strictly after `afterIso` that this specific template occurs, or null if none within 30 days (parity cycles every 14). */
function nextDateForTemplate(
  template: Pick<CandidateTemplate, "day_of_week" | "week_parity">,
  afterIso: string,
  semester: { startDate: string; startWeekParity: "ch" | "zn" },
): string | null {
  let cursor = addDaysISO(afterIso, 1);
  for (let i = 0; i < 30; i++) {
    if (dayOfWeekMonday1(cursor) === template.day_of_week) {
      const parity = resolveWeekParity(cursor, semester.startDate, semester.startWeekParity);
      if (template.week_parity === "both" || template.week_parity === parity) {
        return cursor;
      }
    }
    cursor = addDaysISO(cursor, 1);
  }
  return null;
}

/**
 * Finds the next occurrence of the same subject *and same lesson type* after
 * `afterIso`, so a student sitting in today's class can jump straight to
 * adding homework for it — without navigating the calendar forward.
 *
 * Deliberately NOT limited to the originating lesson_template: a subject can
 * have more than one weekly slot (e.g. a lecture every Monday plus an extra
 * lecture only on числитель Tuesdays) — those are separate `lesson_templates`
 * rows. We consider every active template with a matching subject+type in
 * the semester and return whichever produces the earliest date, so "next
 * lecture" finds the nearest lecture regardless of which slot it's in.
 */
router.get(
  "/occurrences/:templateId/next",
  asyncHandler(async (req, res) => {
    const templateId = templateIdParam.safeParse(req.params.templateId);
    const after = dateParam.safeParse(req.query.after ?? formatISODate(new Date()));
    if (!templateId.success || !after.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const originRes = await pool.query<{ semester_id: number; subject_name: string; lesson_type: string }>(
      "SELECT semester_id, subject_name, lesson_type FROM lesson_templates WHERE id = $1 AND is_active",
      [templateId.data],
    );
    const origin = originRes.rows[0];
    if (!origin) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    const semester = await getActiveSemester();
    if (!semester || semester.id !== origin.semester_id) {
      res.status(404).json({ error: "Lesson is not part of the active semester" });
      return;
    }

    const candidatesRes = await pool.query<CandidateTemplate>(
      `SELECT id, day_of_week, week_parity, pair_num, subject_name, lesson_type, teacher, room,
              start_time_override::text AS start_time_override, end_time_override::text AS end_time_override
       FROM lesson_templates
       WHERE semester_id = $1 AND is_active AND subject_name = $2 AND lesson_type = $3`,
      [origin.semester_id, origin.subject_name, origin.lesson_type],
    );

    let best: { template: CandidateTemplate; date: string } | null = null;
    for (const candidate of candidatesRes.rows) {
      const date = nextDateForTemplate(candidate, after.data, semester);
      if (date && (!best || date < best.date)) {
        best = { template: candidate, date };
      }
    }
    if (!best) {
      res.status(404).json({ error: "No upcoming occurrence found" });
      return;
    }
    const { template, date: nextDate } = best;

    const pairRes = await pool.query<{ start_time: string; end_time: string }>(
      "SELECT start_time, end_time FROM pairs WHERE pair_num = $1",
      [template.pair_num],
    );
    const pairRow = pairRes.rows[0];
    const nominalPair = {
      num: template.pair_num,
      start: pairRow?.start_time.slice(0, 5) ?? "",
      end: pairRow?.end_time.slice(0, 5) ?? "",
    };
    const pair =
      template.start_time_override && template.end_time_override
        ? { num: template.pair_num, start: template.start_time_override.slice(0, 5), end: template.end_time_override.slice(0, 5) }
        : nominalPair;

    const hwRes = await pool.query<{
      id: number;
      comment: string;
      due_date: string | null;
      updated_at: string;
      updated_by_name: string | null;
      done: boolean;
      kind: "regular" | "modular";
    }>(
      `SELECT hi.id, hi.comment, hi.due_date::text AS due_date, hi.updated_at, u.name AS updated_by_name,
              COALESCE(hc.done, false) AS done, hi.kind
       FROM homework_items hi
       LEFT JOIN users u ON u.id = hi.updated_by
       LEFT JOIN homework_completions hc ON hc.homework_item_id = hi.id AND hc.user_id = $1
       WHERE hi.lesson_template_id = $2 AND hi.occurrence_date = $3 AND hi.subgroup = $4`,
      [req.user!.id, template.id, nextDate, subgroupKey(template.subject_name, template.lesson_type, req.user!)],
    );
    const hw = hwRes.rows[0];
    const files = hw ? (await filesByHomeworkId([hw.id])).get(hw.id) ?? [] : [];

    const eventRes = await pool.query<{ event_type: LessonEventType }>(
      "SELECT event_type FROM lesson_events WHERE lesson_template_id = $1 AND occurrence_date = $2",
      [template.id, nextDate],
    );

    const occurrence: ScheduleOccurrence = {
      date: nextDate,
      lessonTemplateId: template.id,
      pair,
      nominalPair,
      subject: template.subject_name,
      type: template.lesson_type,
      teacher: template.teacher,
      room: template.room,
      homework: hw
        ? {
            id: hw.id,
            comment: hw.comment,
            dueDate: hw.due_date,
            updatedAt: hw.updated_at,
            updatedBy: hw.updated_by_name,
            files,
            kind: hw.kind,
          }
        : null,
      done: hw ? hw.done : false,
      subgroupLabel: subgroupLabel(template.subject_name, template.lesson_type, req.user!),
      event: eventRes.rows[0]?.event_type ?? null,
    };
    res.json(occurrence);
  }),
);

/** Which subgroup slice of `templateId`'s homework the given user edits — see services/subgroup. */
async function subgroupForTemplate(
  client: Pool | PoolClient,
  templateId: number,
  user: Parameters<typeof subgroupKey>[2],
): Promise<string> {
  const { rows } = await client.query<{ subject_name: string; lesson_type: string }>(
    "SELECT subject_name, lesson_type FROM lesson_templates WHERE id = $1",
    [templateId],
  );
  const row = rows[0];
  return subgroupKey(row?.subject_name ?? "", row?.lesson_type ?? "", user);
}

async function findOrCreateHomeworkItem(
  client: PoolClient,
  templateId: number,
  date: string,
  userId: number,
  subgroup: string,
): Promise<number> {
  const existing = await client.query<{ id: number }>(
    "SELECT id FROM homework_items WHERE lesson_template_id = $1 AND occurrence_date = $2 AND subgroup = $3",
    [templateId, date, subgroup],
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO homework_items (lesson_template_id, occurrence_date, subgroup, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $4)
     RETURNING id`,
    [templateId, date, subgroup, userId],
  );
  return inserted.rows[0].id;
}

const commentSchema = z.object({
  comment: z.string().max(5000),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  // Only meaningful for subjects flagged in modular_subjects (see
  // routes/schedule.ts) — omitted, it leaves the item's existing kind alone
  // (defaults to 'regular' for a brand-new item).
  kind: z.enum(["regular", "modular"]).optional(),
});

// A regular user may only ADD homework (the item doesn't exist yet, or
// exists with an empty comment — e.g. a file was uploaded but no
// description written). Once real text has been entered, further edits
// require a full admin, or a "group admin" (migration 014) within their own
// foreign-language/descriptive-geometry subgroup — same scoping rule as
// homework deletion and event marking below.
router.put(
  "/occurrences/:templateId/:date/comment",
  asyncHandler(async (req, res) => {
    const templateId = templateIdParam.safeParse(req.params.templateId);
    const date = dateParam.safeParse(req.params.date);
    const body = commentSchema.safeParse(req.body);
    if (!templateId.success || !date.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const subgroup = await subgroupForTemplate(client, templateId.data, req.user!);

      const existing = await client.query<{ comment: string }>(
        "SELECT comment FROM homework_items WHERE lesson_template_id = $1 AND occurrence_date = $2 AND subgroup = $3",
        [templateId.data, date.data, subgroup],
      );
      const alreadyEntered = (existing.rows[0]?.comment ?? "").trim() !== "";
      const canEdit = req.user!.isAdmin || (req.user!.groupAdmin && subgroup !== "");
      if (alreadyEntered && !canEdit) {
        await client.query("ROLLBACK");
        res.status(403).json({ error: "Редактировать уже внесённое дз может только администратор" });
        return;
      }

      const homeworkId = await findOrCreateHomeworkItem(client, templateId.data, date.data, req.user!.id, subgroup);
      const updated = await client.query(
        `UPDATE homework_items
         SET comment = $1, due_date = $2, updated_by = $3, updated_at = now(), kind = COALESCE($5, kind)
         WHERE id = $4
         RETURNING id, comment, due_date::text AS "dueDate", updated_at AS "updatedAt", kind`,
        [body.data.comment, body.data.dueDate ?? null, req.user!.id, homeworkId, body.data.kind ?? null],
      );
      await client.query("COMMIT");
      res.json({ ...updated.rows[0], updatedBy: req.user!.name });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }),
);

const doneSchema = z.object({ done: z.boolean() });

router.put(
  "/occurrences/:templateId/:date/done",
  asyncHandler(async (req, res) => {
    const templateId = templateIdParam.safeParse(req.params.templateId);
    const date = dateParam.safeParse(req.params.date);
    const body = doneSchema.safeParse(req.body);
    if (!templateId.success || !date.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const subgroup = await subgroupForTemplate(client, templateId.data, req.user!);
      const homeworkId = await findOrCreateHomeworkItem(client, templateId.data, date.data, req.user!.id, subgroup);
      await client.query(
        `INSERT INTO homework_completions (homework_item_id, user_id, done, completed_at)
         VALUES ($1, $2, $3, CASE WHEN $3 THEN now() ELSE NULL END)
         ON CONFLICT (homework_item_id, user_id)
         DO UPDATE SET done = EXCLUDED.done, completed_at = EXCLUDED.completed_at`,
        [homeworkId, req.user!.id, body.data.done],
      );
      await client.query("COMMIT");
      res.json({ ok: true, done: body.data.done });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }),
);

const EVENT_TYPES = ["rk", "kr", "module_end", "rabotka"] as const;
const eventSchema = z.object({ eventType: z.enum(EVENT_TYPES).nullable() });

// Marks (or clears) this specific occurrence as an upcoming event
// (РК/КР/Конец модуля/Работка) — surfaced in the "Предстоящие мероприятия"
// block. A full admin may mark any occurrence; a junior "group admin" (see
// migration 014) only on an occurrence in their own foreign-language/
// descriptive-geometry subgroup (subgroupForTemplate returns non-""),
// matching the same scoping rule as homework deletion below.
router.put(
  "/occurrences/:templateId/:date/event",
  asyncHandler(async (req, res) => {
    const templateId = templateIdParam.safeParse(req.params.templateId);
    const date = dateParam.safeParse(req.params.date);
    const body = eventSchema.safeParse(req.body);
    if (!templateId.success || !date.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const subgroup = await subgroupForTemplate(pool, templateId.data, req.user!);
    const canSetEvent = req.user!.isAdmin || (req.user!.groupAdmin && subgroup !== "");
    if (!canSetEvent) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    if (body.data.eventType === null) {
      await pool.query("DELETE FROM lesson_events WHERE lesson_template_id = $1 AND occurrence_date = $2", [
        templateId.data,
        date.data,
      ]);
      res.status(204).end();
      return;
    }

    await pool.query(
      `INSERT INTO lesson_events (lesson_template_id, occurrence_date, event_type, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lesson_template_id, occurrence_date)
       DO UPDATE SET event_type = EXCLUDED.event_type, created_by = EXCLUDED.created_by, updated_at = now()`,
      [templateId.data, date.data, body.data.eventType, req.user!.id],
    );
    res.status(204).end();
  }),
);

// Wipes the homework item entirely (comment + everyone's "done" state via
// the completions cascade) — regular users can only clear the comment text
// via the PUT above, not remove the row. A full admin may delete any
// occurrence; a junior "group admin" (see migration 014) may delete only
// within their own foreign-language/descriptive-geometry subgroup — i.e.
// subgroup is non-"" and matches the slice they themselves see, never the
// shared "" bucket other subgroups (or the whole class) rely on too.
router.delete(
  "/occurrences/:templateId/:date",
  asyncHandler(async (req, res) => {
    const templateId = templateIdParam.safeParse(req.params.templateId);
    const date = dateParam.safeParse(req.params.date);
    if (!templateId.success || !date.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const subgroup = await subgroupForTemplate(pool, templateId.data, req.user!);
    const canDelete = req.user!.isAdmin || (req.user!.groupAdmin && subgroup !== "");
    if (!canDelete) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    await pool.query("DELETE FROM homework_items WHERE lesson_template_id = $1 AND occurrence_date = $2 AND subgroup = $3", [
      templateId.data,
      date.data,
      subgroup,
    ]);
    res.status(204).end();
  }),
);

router.post(
  "/occurrences/:templateId/:date/files",
  uploadSingleFile,
  asyncHandler(async (req, res) => {
    const templateId = templateIdParam.safeParse(req.params.templateId);
    const date = dateParam.safeParse(req.params.date);
    if (!templateId.success || !date.success || !req.file) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const usage = await getStorageUsage();
      if (usage.usedBytes + req.file.size > MAX_TOTAL_STORAGE_BYTES) {
        await client.query("ROLLBACK");
        res.status(507).json({
          error: "Общий объём загруженных файлов достиг лимита (5 ГБ) — загрузка новых файлов отключена",
        });
        return;
      }

      const subgroup = await subgroupForTemplate(client, templateId.data, req.user!);
      const homeworkId = await findOrCreateHomeworkItem(client, templateId.data, date.data, req.user!.id, subgroup);
      const inserted = await client.query<{ id: number; uploaded_at: string }>(
        `INSERT INTO homework_files (homework_item_id, filename, content_type, size_bytes, data, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, uploaded_at`,
        [homeworkId, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, req.user!.id],
      );
      await client.query("COMMIT");
      res.status(201).json({
        id: inserted.rows[0].id,
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedAt: inserted.rows[0].uploaded_at,
        uploadedBy: req.user!.name,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }),
);

interface FileAccessInfo {
  subgroup: string;
  subjectName: string;
  lessonType: string;
}

/** Loads what's needed to check whether `req.user` may see/remove a given file — null if the file doesn't exist. */
async function fileAccessInfo(fileId: number): Promise<FileAccessInfo | null> {
  const { rows } = await pool.query<{ subgroup: string; subject_name: string; lesson_type: string }>(
    `SELECT hi.subgroup, lt.subject_name, lt.lesson_type
     FROM homework_files hf
     JOIN homework_items hi ON hi.id = hf.homework_item_id
     JOIN lesson_templates lt ON lt.id = hi.lesson_template_id
     WHERE hf.id = $1`,
    [fileId],
  );
  const row = rows[0];
  return row ? { subgroup: row.subgroup, subjectName: row.subject_name, lessonType: row.lesson_type } : null;
}

/** An admin can reach any file; everyone else only the subgroup slice they'd see in their own schedule. Mismatches 404 rather than 403 so a guessed id doesn't confirm a file exists in someone else's subgroup. */
function canAccessFile(info: FileAccessInfo, user: Parameters<typeof subgroupKey>[2] & { isAdmin: boolean }): boolean {
  return user.isAdmin || info.subgroup === subgroupKey(info.subjectName, info.lessonType, user);
}

router.get(
  "/homework-files/:id",
  asyncHandler(async (req, res) => {
    const fileId = fileIdParam.safeParse(req.params.id);
    if (!fileId.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const info = await fileAccessInfo(fileId.data);
    if (!info || !canAccessFile(info, req.user!)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const { rows } = await pool.query<{ filename: string; content_type: string; data: Buffer }>(
      "SELECT filename, content_type, data FROM homework_files WHERE id = $1",
      [fileId.data],
    );
    const file = rows[0];
    res.setHeader("Content-Type", file.content_type);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    res.send(file.data);
  }),
);

// Uploading a file is part of "adding" homework and stays open to everyone
// (see POST .../files above); removing one is an edit, so it follows the
// same admin/scoped-group-admin rule as PUT .../comment above.
router.delete(
  "/homework-files/:id",
  asyncHandler(async (req, res) => {
    const fileId = fileIdParam.safeParse(req.params.id);
    if (!fileId.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const info = await fileAccessInfo(fileId.data);
    if (!info || !canAccessFile(info, req.user!)) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const canDeleteFile = req.user!.isAdmin || (req.user!.groupAdmin && info.subgroup !== "");
    if (!canDeleteFile) {
      res.status(403).json({ error: "Удалять файлы может только администратор" });
      return;
    }

    await pool.query("DELETE FROM homework_files WHERE id = $1", [fileId.data]);
    res.status(204).end();
  }),
);

interface UpcomingEventRow {
  lesson_template_id: number;
  occurrence_date: string;
  event_type: LessonEventType;
  subject_name: string;
  lesson_type: string;
  teacher: string;
  room: string;
}

// Every future-or-today marker across the schedule (not scoped to a single
// subject) — backs the "Предстоящие мероприятия" block. Read-only for
// everyone; only PUT .../event (above) requires admin.
router.get(
  "/events/upcoming",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query<UpcomingEventRow>(
      `SELECT le.lesson_template_id, le.occurrence_date::text AS occurrence_date, le.event_type,
              lt.subject_name, lt.lesson_type, lt.teacher, lt.room
       FROM lesson_events le
       JOIN lesson_templates lt ON lt.id = le.lesson_template_id
       WHERE le.occurrence_date >= CURRENT_DATE
       ORDER BY le.occurrence_date ASC
       LIMIT 50`,
    );
    res.json(
      rows.map((r) => ({
        lessonTemplateId: r.lesson_template_id,
        date: r.occurrence_date,
        eventType: r.event_type,
        subject: r.subject_name,
        type: r.lesson_type,
        teacher: r.teacher,
        room: r.room,
      })),
    );
  }),
);

interface SubjectHomeworkTemplateRow {
  id: number;
  lesson_type: string;
  teacher: string;
  room: string;
}

interface SubjectHomeworkRow {
  id: number;
  lesson_template_id: number;
  occurrence_date: string;
  comment: string;
  due_date: string | null;
  updated_at: string;
  updated_by_name: string | null;
  subgroup: string;
  done: boolean;
  kind: "regular" | "modular";
}

// All homework ever entered for a subject (any date, past or future) in the
// active semester, filtered to the viewer's own subgroup slice for split
// subjects — backs the "Предметы" tab's per-subject list.
router.get(
  "/subjects/:name/homework",
  asyncHandler(async (req, res) => {
    const subjectName = req.params.name;
    const semester = await getActiveSemester();
    if (!semester) {
      res.json([]);
      return;
    }

    const templatesRes = await pool.query<SubjectHomeworkTemplateRow>(
      `SELECT id, lesson_type, teacher, room FROM lesson_templates WHERE semester_id = $1 AND subject_name = $2`,
      [semester.id, subjectName],
    );
    const templateById = new Map(templatesRes.rows.map((t) => [t.id, t]));
    if (templateById.size === 0) {
      res.json([]);
      return;
    }

    const hwRes = await pool.query<SubjectHomeworkRow>(
      `SELECT hi.id, hi.lesson_template_id, hi.occurrence_date::text AS occurrence_date, hi.comment,
              hi.due_date::text AS due_date, hi.updated_at, u.name AS updated_by_name, hi.subgroup,
              COALESCE(hc.done, false) AS done, hi.kind
       FROM homework_items hi
       LEFT JOIN users u ON u.id = hi.updated_by
       LEFT JOIN homework_completions hc ON hc.homework_item_id = hi.id AND hc.user_id = $1
       WHERE hi.lesson_template_id = ANY($2::int[])
       ORDER BY hi.occurrence_date DESC`,
      [req.user!.id, [...templateById.keys()]],
    );

    const rows = hwRes.rows.filter((row) => {
      const template = templateById.get(row.lesson_template_id)!;
      return row.subgroup === subgroupKey(subjectName, template.lesson_type, req.user!);
    });

    const filesMap = await filesByHomeworkId(rows.map((r) => r.id));

    res.json(
      rows.map((row) => {
        const template = templateById.get(row.lesson_template_id)!;
        return {
          homeworkId: row.id,
          lessonTemplateId: row.lesson_template_id,
          occurrenceDate: row.occurrence_date,
          type: template.lesson_type,
          teacher: template.teacher,
          room: template.room,
          comment: row.comment,
          dueDate: row.due_date,
          updatedAt: row.updated_at,
          updatedBy: row.updated_by_name,
          done: row.done,
          files: filesMap.get(row.id) ?? [],
          kind: row.kind,
          subgroupLabel: subgroupLabel(subjectName, template.lesson_type, req.user!),
        };
      }),
    );
  }),
);

// Shared study files (textbooks, reference materials) for a subject as a
// whole — not tied to any lesson occurrence or subgroup, visible to every
// viewer of that subject's "Предметы" page. Uploading stays open to
// everyone (same as homework file uploads — it's "adding", not editing);
// only an admin may remove one, since there's no subgroup to scope a
// junior admin's delete rights to here.
router.get(
  "/subjects/:name/files",
  asyncHandler(async (req, res) => {
    res.json(await subjectFiles(req.params.name));
  }),
);

router.post(
  "/subjects/:name/files",
  uploadSingleFile,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const usage = await getStorageUsage();
    if (usage.usedBytes + req.file.size > MAX_TOTAL_STORAGE_BYTES) {
      res.status(507).json({
        error: "Общий объём загруженных файлов достиг лимита (5 ГБ) — загрузка новых файлов отключена",
      });
      return;
    }

    const inserted = await pool.query<{ id: number; uploaded_at: string }>(
      `INSERT INTO subject_files (subject_name, filename, content_type, size_bytes, data, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, uploaded_at`,
      [req.params.name, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer, req.user!.id],
    );
    res.status(201).json({
      id: inserted.rows[0].id,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedAt: inserted.rows[0].uploaded_at,
      uploadedBy: req.user!.name,
    });
  }),
);

router.get(
  "/subject-files/:id",
  asyncHandler(async (req, res) => {
    const fileId = fileIdParam.safeParse(req.params.id);
    if (!fileId.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { rows } = await pool.query<{ filename: string; content_type: string; data: Buffer }>(
      "SELECT filename, content_type, data FROM subject_files WHERE id = $1",
      [fileId.data],
    );
    const file = rows[0];
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.setHeader("Content-Type", file.content_type);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    res.send(file.data);
  }),
);

router.delete(
  "/subject-files/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const fileId = fileIdParam.safeParse(req.params.id);
    if (!fileId.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const deleted = await pool.query("DELETE FROM subject_files WHERE id = $1 RETURNING id", [fileId.data]);
    if (deleted.rows.length === 0) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.status(204).end();
  }),
);

export default router;
