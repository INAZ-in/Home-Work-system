import type { NextFunction, Request, Response } from "express";

/** Must run after `currentUser` — rejects any request from a non-admin account. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
