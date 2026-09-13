import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { currentUser } from "./middleware/currentUser.js";
import { requireAdmin } from "./middleware/requireAdmin.js";
import adminRouter from "./routes/admin.js";
import authRouter from "./routes/auth.js";
import homeworkRouter from "./routes/homework.js";
import overviewRouter from "./routes/overview.js";
import plansRouter from "./routes/plans.js";
import scheduleRouter from "./routes/schedule.js";
import semestersRouter from "./routes/semesters.js";
import usersRouter from "./routes/users.js";

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // /register and /login are public; /me applies `currentUser` itself.
  app.use("/api/auth", authRouter);

  app.use("/api/users", currentUser, usersRouter);
  app.use("/api", currentUser, scheduleRouter);
  app.use("/api", currentUser, homeworkRouter);
  app.use("/api", currentUser, overviewRouter);
  app.use("/api/plans", currentUser, plansRouter);
  // GET /active inside semestersRouter stays open to any authenticated user
  // (the two-week view's ч/з badges need it) — write routes and the full
  // list gate themselves with requireAdmin individually.
  app.use("/api/semesters", currentUser, semestersRouter);
  app.use("/api/admin", currentUser, requireAdmin, adminRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
