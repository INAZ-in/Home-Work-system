import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Every route below is scoped to req.user.id and gated on this flag — an
// admin grants it per account (see routes/admin.ts), and even an admin has
// no endpoint that reads another user's plan text. Nothing here should ever
// accept a user id from the request; the owner is always req.user!.id.
router.use((req, res, next) => {
  if (!req.user!.canCreatePlans) {
    res.status(403).json({ error: "Личные планы недоступны для этого аккаунта" });
    return;
  }
  next();
});

const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idParam = z.coerce.number().int().positive();

interface PlanRow {
  id: number;
  date: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

const PLAN_COLUMNS = `id, plan_date::text AS date, text, done, created_at AS "createdAt", updated_at AS "updatedAt"`;

const listQuerySchema = z.object({ from: dateParam, to: dateParam });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const { rows } = await pool.query<PlanRow>(
      `SELECT ${PLAN_COLUMNS} FROM personal_plans
       WHERE user_id = $1 AND plan_date BETWEEN $2 AND $3
       ORDER BY plan_date, id`,
      [req.user!.id, parsed.data.from, parsed.data.to],
    );
    res.json(rows);
  }),
);

const createSchema = z.object({ date: dateParam, text: z.string().trim().min(1).max(2000) });

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const inserted = await pool.query<PlanRow>(
      `INSERT INTO personal_plans (user_id, plan_date, text) VALUES ($1, $2, $3)
       RETURNING ${PLAN_COLUMNS}`,
      [req.user!.id, parsed.data.date, parsed.data.text],
    );
    res.status(201).json(inserted.rows[0]);
  }),
);

const updateSchema = z.object({
  text: z.string().trim().min(1).max(2000).optional(),
  done: z.boolean().optional(),
  date: dateParam.optional(),
});

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const body = updateSchema.safeParse(req.body);
    if (!id.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const existingRes = await pool.query<{ text: string; done: boolean; plan_date: string }>(
      "SELECT text, done, plan_date::text AS plan_date FROM personal_plans WHERE id = $1 AND user_id = $2",
      [id.data, req.user!.id],
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const updated = await pool.query<PlanRow>(
      `UPDATE personal_plans SET text = $1, done = $2, plan_date = $3, updated_at = now()
       WHERE id = $4 AND user_id = $5
       RETURNING ${PLAN_COLUMNS}`,
      [
        body.data.text ?? existing.text,
        body.data.done ?? existing.done,
        body.data.date ?? existing.plan_date,
        id.data,
        req.user!.id,
      ],
    );
    res.json(updated.rows[0]);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    await pool.query("DELETE FROM personal_plans WHERE id = $1 AND user_id = $2", [id.data, req.user!.id]);
    res.status(204).end();
  }),
);

export default router;
