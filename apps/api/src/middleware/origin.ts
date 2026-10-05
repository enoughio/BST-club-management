import type { NextFunction, Request, Response } from "express";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export function originGuard(req: Request, res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) {
    next();
    return;
  }
  if (req.originalUrl.startsWith("/api/v1/webhooks/")) {
    next();
    return;
  }
  const allowed = process.env.WEB_ORIGIN || "http://localhost:3000";
  const origin = req.get("origin");
  if (origin !== allowed) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }
  next();
}
