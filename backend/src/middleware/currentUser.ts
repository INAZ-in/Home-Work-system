import { pool } from "../db/pool.js";
import { verifyToken } from "../services/auth.js";
import type { GeometryGroup, LanguageGroup } from "../services/subgroup.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export interface CurrentUser {
  id: number;
  name: string;
  isAdmin: boolean;
  languageGroup: LanguageGroup | null;
  geometryGroup: GeometryGroup | null;
  canCreatePlans: boolean;
  /** Junior-admin: may delete homework in their own foreign-language/descriptive-geometry subgroup only — see routes/homework.ts DELETE /occurrences. */
  groupAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

export const currentUser = asyncHandler(async (req, res, next) => {
  const header = req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const userId = verifyToken(token);
  if (userId === null) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const { rows } = await pool.query<CurrentUser>(
    `SELECT id, name, is_admin AS "isAdmin", language_group AS "languageGroup", geometry_group AS "geometryGroup",
            can_create_plans AS "canCreatePlans", group_admin AS "groupAdmin"
     FROM users WHERE id = $1`,
    [userId],
  );
  if (rows.length === 0) {
    res.status(401).json({ error: "Unknown user" });
    return;
  }

  req.user = rows[0];
  next();
});
