import { Router } from "express";
import { requireSuperAdmin } from "../lib/access";
import { asyncHandler } from "../lib/http";
import { prisma } from "../lib/prisma";

export const auditRouter = Router();

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const action = String(req.query.action || "");
    const entityType = String(req.query.entityType || "");
    const where = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
    };
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    res.json({ logs, total, page, pageSize });
  }),
);
