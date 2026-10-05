import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/auth";
import { prisma } from "../lib/prisma";

export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) {
    next();
    return;
  }
  try {
    const userId = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    if (user) req.user = user;
  } catch {
    req.user = undefined;
  }
  next();
}
