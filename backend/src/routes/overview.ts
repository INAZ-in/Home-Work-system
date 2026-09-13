import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { resolveSchedule } from "../services/scheduleResolver.js";
import type { PersonalPlan } from "../types/schedule.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PLAN_COLUMNS } from "./plans.js";

const router = Router();

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Homework file metadata is already cheap (no bytes, just rows), but a
  // caller that doesn't care about attachments can skip it for a lighter
  // payload — defaults to included, matching plain GET /api/schedule.
  files: z.enum(["true", "false"]).optional(),
});

// One combined call for a date range: schedule (with homework) + personal
// plans, so a client doesn't need to hit /api/schedule and /api/plans
// separately and stitch them together itself.
router.get(
  "/overview",
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
    const includeFiles = parsed.data.files !== "false";

    const occurrences = await resolveSchedule(from, to, req.user!);
    if (!includeFiles) {
      for (const occ of occurrences) {
        if (occ.homework) occ.homework.files = [];
      }
    }

    // Same permission as GET /api/plans: an account without the flag simply
    // gets an empty array here rather than a 403 that would sink the whole
    // combined response over one part of it.
    let plans: PersonalPlan[] = [];
    if (req.user!.canCreatePlans) {
      const { rows } = await pool.query<PersonalPlan>(
        `SELECT ${PLAN_COLUMNS} FROM personal_plans
         WHERE user_id = $1 AND plan_date BETWEEN $2 AND $3
         ORDER BY plan_date, id`,
        [req.user!.id, from, to],
      );
      plans = rows;
    }

    res.json({ occurrences, plans });
  }),
);

export default router;
