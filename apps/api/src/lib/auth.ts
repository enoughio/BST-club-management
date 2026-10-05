import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import { addDays } from "./dates";

const ACCESS_TTL = "15m";
const ACCESS_MS = 15 * 60 * 1000;
const REFRESH_DAYS = 7;

export type SessionRole = "SUPER_ADMIN" | "USER";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function secret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId, type: "access" }, secret("JWT_ACCESS_SECRET"), { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId, type: "refresh" }, secret("JWT_REFRESH_SECRET"), { expiresIn: `${REFRESH_DAYS}d` });
}

export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, secret("JWT_ACCESS_SECRET"));
  if (typeof payload === "string" || payload.type !== "access" || !payload.sub) {
    throw new Error("Invalid access token");
  }
  return payload.sub;
}

export function verifyRefreshToken(token: string) {
  const payload = jwt.verify(token, secret("JWT_REFRESH_SECRET"));
  if (typeof payload === "string" || payload.type !== "refresh" || !payload.sub) {
    throw new Error("Invalid refresh token");
  }
  return payload.sub;
}

function cookieOptions(maxAge: number): CookieOptions {
  const sameSite = (process.env.COOKIE_SAMESITE || "lax") as CookieOptions["sameSite"];
  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge,
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("access_token", accessToken, cookieOptions(ACCESS_MS));
  res.cookie("refresh_token", refreshToken, cookieOptions(REFRESH_DAYS * 24 * 60 * 60 * 1000));
}

export function clearAuthCookies(res: Response) {
  const base = cookieOptions(0);
  res.clearCookie("access_token", base);
  res.clearCookie("refresh_token", base);
}

export async function issueSession(res: Response, userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: addDays(new Date(), REFRESH_DAYS),
    },
  });
  setAuthCookies(res, accessToken, refreshToken);
}

export async function createAuthToken(userId: string, purpose: "INVITE" | "RESET", days: number) {
  const token = randomToken();
  await prisma.authToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: addDays(new Date(), days),
    },
  });
  return token;
}
