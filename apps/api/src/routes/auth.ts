import { Router } from "express";
import { z } from "zod";
import {
  clearAuthCookies,
  createAuthToken,
  hashPassword,
  hashToken,
  issueSession,
  verifyPassword,
  verifyRefreshToken,
} from "../lib/auth";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../lib/http";
import { sendPasswordReset } from "../lib/mailer";
import { prisma } from "../lib/prisma";
import { sessionFor } from "../lib/serialize";

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = credentials.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !user.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }
    if (user.status === "SUSPENDED") throw new HttpError(403, "Account suspended");
    if (user.status === "INVITED") {
      await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
    }
    await issueSession(res, user.id);
    res.json({ user: await sessionFor(user.id) });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refresh_token as string | undefined;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(token) } });
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new HttpError(401, "Refresh token missing");
    let userId = "";
    try {
      userId = verifyRefreshToken(token);
    } catch {
      throw new HttpError(401, "Refresh token invalid");
    }
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!stored || stored.expiresAt < new Date() || stored.userId !== userId) {
      throw new HttpError(401, "Refresh token expired");
    }
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    await issueSession(res, userId);
    res.json({ user: await sessionFor(userId) });
  }),
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new HttpError(401, "Sign in required");
    res.json({ user: await sessionFor(req.user.id) });
  }),
);

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (user && user.status !== "SUSPENDED") {
      const token = await createAuthToken(user.id, "RESET", 1);
      const url = `${process.env.WEB_ORIGIN || "http://localhost:3000"}/reset-password?token=${token}`;
      await sendPasswordReset(user.email, url);
    }
    res.json({ ok: true });
  }),
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const body = z.object({ token: z.string().min(20), password: z.string().min(8).max(200) }).parse(req.body);
    await consumeToken(body.token, "RESET", body.password);
    res.json({ ok: true });
  }),
);

authRouter.post(
  "/accept-invite",
  asyncHandler(async (req, res) => {
    const body = z.object({ token: z.string().min(20), password: z.string().min(8).max(200) }).parse(req.body);
    const userId = await consumeToken(body.token, "INVITE", body.password);
    await issueSession(res, userId);
    res.json({ user: await sessionFor(userId) });
  }),
);

async function consumeToken(token: string, purpose: "INVITE" | "RESET", password: string) {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) {
    throw new HttpError(400, "This link is invalid or expired");
  }
  await prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash: await hashPassword(password), status: "ACTIVE" },
  });
  await prisma.refreshToken.deleteMany({ where: { userId: row.userId } });
  return row.userId;
}
