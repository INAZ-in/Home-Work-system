import type { NextFunction, Request, Response } from "express";

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Express 4 does not forward rejected promises from async handlers to the
 * error middleware — an unhandled rejection would otherwise just hang the
 * request (or crash the process, since Node terminates on unhandled
 * rejections by default). Wrap every async handler/middleware with this.
 */
export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
