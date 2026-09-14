import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { isMonday } from "../services/weekParity.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const SEMESTER_COLUMNS = `id, name, start_date::text AS "startDate", start_week_parity AS "startWeekParity",
                          is_active AS "isActive", bmstu_group_uuid AS "bmstuGroupUuid"`;

// Full semester list is only shown in the admin UI — /active (below) is the
// one every logged-in user needs, for the two-week view's ч/з badges.
router.get(
  "/",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(`SELECT ${SEMESTER_COLUMNS} FROM semesters ORDER BY start_date DESC`);
    res.json(rows);
  }),
);

router.get(
  "/active",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(`SELECT ${SEMESTER_COLUMNS} FROM semesters WHERE is_active LIMIT 1`);
    res.json(rows[0] ?? null);
  }),
);

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startWeekParity: z.enum(["ch", "zn"]),
  bmstuGroupUuid: z.string().trim().min(1).optional(),
});

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { name, startDate, startWeekParity, bmstuGroupUuid } = parsed.data;
    if (!isMonday(startDate)) {
      res.status(400).json({ error: "startDate must be a Monday" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO semesters (name, start_date, start_week_parity, bmstu_group_uuid)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SEMESTER_COLUMNS}`,
      [name, startDate, startWeekParity, bmstuGroupUuid ?? null],
    );
    res.status(201).json(rows[0]);
  }),
);

const setGroupSchema = z.object({ bmstuGroupUuid: z.string().trim().min(1) });

// Lets an admin (re)assign the LKS group a semester syncs against — needed
// once a semester already exists (created without one, or the wrong one),
// since the creation form is otherwise the only place this gets set.
router.put(
  "/:id/bmstu-group",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = setGroupSchema.safeParse(req.body);
    if (!Number.isInteger(id) || id <= 0 || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { rows } = await pool.query(
      `UPDATE semesters SET bmstu_group_uuid = $1 WHERE id = $2 RETURNING ${SEMESTER_COLUMNS}`,
      [parsed.data.bmstuGroupUuid, id],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: "Semester not found" });
      return;
    }
    res.json(rows[0]);
  }),
);

router.put(
  "/:id/activate",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid semester id" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE semesters SET is_active = false WHERE is_active");
      const { rowCount } = await client.query("UPDATE semesters SET is_active = true WHERE id = $1", [id]);
      if (rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Semester not found" });
        return;
      }
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }),
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid semester id" });
      return;
    }

    const active = await pool.query("SELECT is_active FROM semesters WHERE id = $1", [id]);
    if (active.rows.length === 0) {
      res.status(404).json({ error: "Semester not found" });
      return;
    }
    if (active.rows[0].is_active) {
      res.status(400).json({ error: "Нельзя удалить активный семестр — сначала сделай активным другой" });
      return;
    }

    await pool.query("DELETE FROM semesters WHERE id = $1", [id]);
    res.status(204).end();
  }),
);

export default router;
