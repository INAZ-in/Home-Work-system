import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { getActiveSemester, resolveSchedule } from "../services/scheduleResolver.js";
import { subgroupKey } from "../services/subgroup.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Distinct subject names for the active semester, in a stable order — the
// frontend assigns each a palette color by index so two subjects can never
// collide (see frontend/src/utils/subjectColor.ts), which a hash-based
// assignment can't guarantee once there are more than a couple of subjects.
router.get(
  "/subjects",
  asyncHandler(async (_req, res) => {
    const semester = await getActiveSemester();
    if (!semester) {
      res.json([]);
      return;
    }
    const { rows } = await pool.query<{ subject_name: string }>(
      `SELECT DISTINCT subject_name FROM lesson_templates
       WHERE semester_id = $1 AND is_active ORDER BY subject_name`,
      [semester.id],
    );
    res.json(rows.map((r) => r.subject_name));
  }),
);

interface ModularPendingRow {
  subject_name: string;
  lesson_type: string;
  subgroup: string;
}

// Subject names that currently have at least one not-yet-done modular
// homework item (in the viewer's own subgroup slice) — drives the red
// "unfinished module" highlight on the subject list in the "Предметы" tab.
router.get(
  "/subjects/modular-pending",
  asyncHandler(async (req, res) => {
    const semester = await getActiveSemester();
    if (!semester) {
      res.json([]);
      return;
    }
    const { rows } = await pool.query<ModularPendingRow>(
      `SELECT lt.subject_name, lt.lesson_type, hi.subgroup
       FROM homework_items hi
       JOIN lesson_templates lt ON lt.id = hi.lesson_template_id
       LEFT JOIN homework_completions hc ON hc.homework_item_id = hi.id AND hc.user_id = $1
       WHERE lt.semester_id = $2 AND hi.kind = 'modular' AND COALESCE(hc.done, false) = false`,
      [req.user!.id, semester.id],
    );
    const subjects = new Set(
      rows
        .filter((r) => r.subgroup === subgroupKey(r.subject_name, r.lesson_type, req.user!))
        .map((r) => r.subject_name),
    );
    res.json([...subjects]);
  }),
);

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.get(
  "/schedule",
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { from, to } = parsed.data;
    if (from > to) {
      res.status(400).json({ error: "`from` must be <= `to`" });
      return;
    }

    const occurrences = await resolveSchedule(from, to, req.user!);
    res.json(occurrences);
  }),
);

export default router;
