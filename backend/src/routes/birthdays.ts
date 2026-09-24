import { Router } from "express";
import { pool } from "../db/pool.js";
import { daysUntilNextBirthday } from "../services/birthdays.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

export interface BirthdayEntry {
  id: number;
  name: string;
  birthDate: string;
  daysUntil: number;
}

// Whole-group list (any authenticated user, not admin-only — same trust
// level as the shared schedule/homework) for the "Дни рождения" tab.
// Accounts without a birth_date (most, until an admin sets one) are omitted.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query<{ id: number; name: string; birthDate: string }>(
      `SELECT id, name, birth_date AS "birthDate" FROM users WHERE birth_date IS NOT NULL ORDER BY name`,
    );
    const todayIso = new Date().toISOString().slice(0, 10);
    const entries: BirthdayEntry[] = rows
      .map((row) => ({ ...row, daysUntil: daysUntilNextBirthday(row.birthDate, todayIso) }))
      .sort((a, b) => a.daysUntil - b.daysUntil);
    res.json(entries);
  }),
);

export default router;
