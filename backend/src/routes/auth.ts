import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { loginIpLimiter, loginUsernameLimiter, registerIpLimiter } from "../middleware/authRateLimit.js";
import { currentUser } from "../middleware/currentUser.js";
import { hashPassword, signToken, verifyPassword } from "../services/auth.js";
import { GEOMETRY_GROUPS, LANGUAGE_GROUPS } from "../services/subgroup.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const credsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  password: z.string().min(6).max(200),
});

// Mandatory at registration (the whole-group schedule slot is shared by
// several parallel sessions for these two subjects — see services/subgroup)
// but editable afterwards from settings or by an admin, so login doesn't
// re-demand them.
const registerSchema = credsSchema.extend({
  languageGroup: z.enum(LANGUAGE_GROUPS as [string, ...string[]]),
  geometryGroup: z.coerce.number().refine((n): n is (typeof GEOMETRY_GROUPS)[number] => GEOMETRY_GROUPS.includes(n as 1 | 2)),
});

router.post(
  "/register",
  registerIpLimiter,
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { name, password, languageGroup, geometryGroup } = parsed.data;

    const existing = await pool.query("SELECT id FROM users WHERE lower(name) = lower($1)", [name]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Это имя уже занято" });
      return;
    }

    // Bootstrap: the very first account ever created becomes admin, since
    // nothing else has yet gained the power to appoint one. Every later
    // registration is a regular account.
    const countRes = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM users");
    const isFirstUser = countRes.rows[0].count === "0";

    const passwordHash = await hashPassword(password);
    // Approval is only ever skipped for the bootstrap admin — every other
    // self-registered account starts unapproved and gets no working session
    // until an admin signs off (see PUT /api/admin/users/:id/approve).
    const inserted = await pool.query<{
      id: number;
      name: string;
      isAdmin: boolean;
      languageGroup: string;
      geometryGroup: number;
      canCreatePlans: boolean;
      groupAdmin: boolean;
    }>(
      `INSERT INTO users (name, password_hash, is_admin, language_group, geometry_group, approved, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 THEN now() ELSE NULL END)
       RETURNING id, name, is_admin AS "isAdmin", language_group AS "languageGroup", geometry_group AS "geometryGroup",
                 can_create_plans AS "canCreatePlans", group_admin AS "groupAdmin"`,
      [name, passwordHash, isFirstUser, languageGroup, geometryGroup, isFirstUser],
    );
    const user = inserted.rows[0];
    if (!isFirstUser) {
      res.status(201).json({
        pending: true,
        message: "Аккаунт создан. Дождитесь подтверждения от одного из администраторов, затем войдите.",
      });
      return;
    }
    res.status(201).json({ token: signToken(user.id), user });
  }),
);

router.post(
  "/login",
  loginIpLimiter,
  loginUsernameLimiter,
  asyncHandler(async (req, res) => {
    const parsed = credsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { name, password } = parsed.data;

    const { rows } = await pool.query<{
      id: number;
      name: string;
      password_hash: string;
      isAdmin: boolean;
      languageGroup: string | null;
      geometryGroup: number | null;
      canCreatePlans: boolean;
      groupAdmin: boolean;
      approved: boolean;
    }>(
      `SELECT id, name, password_hash, is_admin AS "isAdmin",
              language_group AS "languageGroup", geometry_group AS "geometryGroup",
              can_create_plans AS "canCreatePlans", group_admin AS "groupAdmin", approved
       FROM users WHERE lower(name) = lower($1)`,
      [name],
    );
    const user = rows[0];
    // Run bcrypt.compare even on a missing user (against a fixed dummy hash,
    // never derived from a real password) so the response time doesn't leak
    // whether the name exists.
    const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) {
      res.status(401).json({ error: "Неверное имя или пароль" });
      return;
    }
    if (!user.approved) {
      res.status(403).json({ error: "Аккаунт ещё не подтверждён администратором", pending: true });
      return;
    }

    await pool.query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
    // A real user who fumbled the password once or twice shouldn't be left
    // sitting close to the per-username limit after finally getting it right.
    loginUsernameLimiter.resetKey(name.toLowerCase());

    res.json({
      token: signToken(user.id),
      user: {
        id: user.id,
        name: user.name,
        isAdmin: user.isAdmin,
        languageGroup: user.languageGroup,
        geometryGroup: user.geometryGroup,
        canCreatePlans: user.canCreatePlans,
        groupAdmin: user.groupAdmin,
      },
    });
  }),
);

router.get(
  "/me",
  currentUser,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  }),
);

const subgroupsSchema = z.object({
  languageGroup: z.enum(LANGUAGE_GROUPS as [string, ...string[]]),
  geometryGroup: z.coerce.number().refine((n): n is (typeof GEOMETRY_GROUPS)[number] => GEOMETRY_GROUPS.includes(n as 1 | 2)),
});

// Settings-page self-service: answer (or change) the two elective-track
// questions asked at registration. Anyone signed in may edit their own —
// admins editing someone else's go through /api/admin/users/:id/subgroups.
router.put(
  "/me/subgroups",
  currentUser,
  asyncHandler(async (req, res) => {
    const parsed = subgroupsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { languageGroup, geometryGroup } = parsed.data;
    const updated = await pool.query(
      `UPDATE users SET language_group = $1, geometry_group = $2 WHERE id = $3
       RETURNING id, name, is_admin AS "isAdmin", language_group AS "languageGroup", geometry_group AS "geometryGroup",
                 can_create_plans AS "canCreatePlans", group_admin AS "groupAdmin"`,
      [languageGroup, geometryGroup, req.user!.id],
    );
    res.json(updated.rows[0]);
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(200),
});

// Settings-page self-service password change. Requires the current password
// (unlike the admin's /api/admin/users/:id/password, which can reset anyone's
// without it) so a hijacked but still-logged-in session can't lock the real
// owner out by silently swapping the password.
router.put(
  "/me/password",
  currentUser,
  asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;

    const { rows } = await pool.query<{ passwordHash: string }>(
      `SELECT password_hash AS "passwordHash" FROM users WHERE id = $1`,
      [req.user!.id],
    );
    const ok = await verifyPassword(currentPassword, rows[0].passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Неверный текущий пароль" });
      return;
    }

    const newHash = await hashPassword(newPassword);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.user!.id]);
    res.status(204).end();
  }),
);

export default router;
