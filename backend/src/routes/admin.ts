import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { hashPassword } from "../services/auth.js";
import { findBmstuGroups, runScheduleSync } from "../services/bmstuSync.js";
import { getStorageUsage } from "../services/homeworkFiles.js";
import { GEOMETRY_GROUPS, LANGUAGE_GROUPS } from "../services/subgroup.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/sync-runs",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const { rows } = await pool.query(
      `SELECT id, semester_id AS "semesterId", run_at AS "runAt", status, added_count AS "addedCount",
              updated_count AS "updatedCount", deactivated_count AS "deactivatedCount", details, error
       FROM schedule_sync_runs
       ORDER BY run_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json(rows);
  }),
);

router.post(
  "/sync-now",
  asyncHandler(async (_req, res) => {
    const result = await runScheduleSync();
    res.json(result);
  }),
);

const groupSearchSchema = z.object({ query: z.string().trim().min(1) });

router.get(
  "/bmstu-groups",
  asyncHandler(async (req, res) => {
    const parsed = groupSearchSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing `query`" });
      return;
    }
    const matches = await findBmstuGroups(parsed.data.query);
    res.json(matches.slice(0, 20));
  }),
);

router.get(
  "/storage-usage",
  asyncHandler(async (_req, res) => {
    res.json(await getStorageUsage());
  }),
);

// --- user management (admin-only, per whole-router requireAdmin in app.ts) ---

router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT id, name, is_admin AS "isAdmin", created_at AS "createdAt",
              language_group AS "languageGroup", geometry_group AS "geometryGroup",
              can_create_plans AS "canCreatePlans", last_login_at AS "lastLoginAt"
       FROM users ORDER BY name`,
    );
    res.json(rows);
  }),
);

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  password: z.string().min(6).max(200),
  isAdmin: z.boolean().optional(),
});

router.post(
  "/users",
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { name, password, isAdmin = false } = parsed.data;

    const existing = await pool.query("SELECT id FROM users WHERE lower(name) = lower($1)", [name]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Это имя уже занято" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const inserted = await pool.query(
      `INSERT INTO users (name, password_hash, is_admin) VALUES ($1, $2, $3)
       RETURNING id, name, is_admin AS "isAdmin", created_at AS "createdAt"`,
      [name, passwordHash, isAdmin],
    );
    res.status(201).json(inserted.rows[0]);
  }),
);

/** True if `id` is currently the only admin — used to block demoting/deleting the last one, which would permanently lock everyone out of admin-only features (only an admin can grant admin). */
async function isLastAdmin(id: number): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM users WHERE is_admin AND id != $1",
    [id],
  );
  return rows[0].count === "0";
}

const setAdminSchema = z.object({ isAdmin: z.boolean() });

router.put(
  "/users/:id/admin",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = setAdminSchema.safeParse(req.body);
    if (!Number.isInteger(id) || id <= 0 || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    if (!parsed.data.isAdmin && (await isLastAdmin(id))) {
      res.status(400).json({ error: "Нельзя убрать права у последнего администратора" });
      return;
    }

    const updated = await pool.query(
      `UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, name, is_admin AS "isAdmin", created_at AS "createdAt"`,
      [parsed.data.isAdmin, id],
    );
    if (updated.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated.rows[0]);
  }),
);

const setPasswordSchema = z.object({ password: z.string().min(6).max(200) });

router.put(
  "/users/:id/password",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = setPasswordSchema.safeParse(req.body);
    if (!Number.isInteger(id) || id <= 0 || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const updated = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, name, is_admin AS "isAdmin", created_at AS "createdAt"`,
      [passwordHash, id],
    );
    if (updated.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated.rows[0]);
  }),
);

const setSubgroupsSchema = z.object({
  languageGroup: z.enum(LANGUAGE_GROUPS as [string, ...string[]]),
  geometryGroup: z.coerce.number().refine((n): n is (typeof GEOMETRY_GROUPS)[number] => GEOMETRY_GROUPS.includes(n as 1 | 2)),
});

router.put(
  "/users/:id/subgroups",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = setSubgroupsSchema.safeParse(req.body);
    if (!Number.isInteger(id) || id <= 0 || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const updated = await pool.query(
      `UPDATE users SET language_group = $1, geometry_group = $2 WHERE id = $3
       RETURNING id, name, is_admin AS "isAdmin", created_at AS "createdAt",
                 language_group AS "languageGroup", geometry_group AS "geometryGroup"`,
      [parsed.data.languageGroup, parsed.data.geometryGroup, id],
    );
    if (updated.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated.rows[0]);
  }),
);

const setCanCreatePlansSchema = z.object({ canCreatePlans: z.boolean() });

router.put(
  "/users/:id/can-create-plans",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = setCanCreatePlansSchema.safeParse(req.body);
    if (!Number.isInteger(id) || id <= 0 || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const updated = await pool.query(
      `UPDATE users SET can_create_plans = $1 WHERE id = $2
       RETURNING id, name, is_admin AS "isAdmin", created_at AS "createdAt",
                 language_group AS "languageGroup", geometry_group AS "geometryGroup",
                 can_create_plans AS "canCreatePlans"`,
      [parsed.data.canCreatePlans, id],
    );
    if (updated.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated.rows[0]);
  }),
);

router.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    if (await isLastAdmin(id)) {
      res.status(400).json({ error: "Нельзя удалить последнего администратора" });
      return;
    }

    const deleted = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
    if (deleted.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(204).end();
  }),
);

export default router;
