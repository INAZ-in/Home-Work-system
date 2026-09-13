import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Group member list (e.g. for admin views) — registration/login now live
// under /api/auth. Requires auth like everything else under /api.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(`SELECT id, name, is_admin AS "isAdmin" FROM users ORDER BY name`);
    res.json(rows);
  }),
);

export default router;
