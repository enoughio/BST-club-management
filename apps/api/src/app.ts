import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorMiddleware } from "./lib/http";
import { getObject } from "./lib/storage";
import { loadUser } from "./middleware/auth";
import { originGuard } from "./middleware/origin";
import { applicationsRouter, webhookRouter } from "./routes/applications";
import { auditRouter } from "./routes/audit";
import { authRouter } from "./routes/auth";
import { clubsRouter } from "./routes/clubs";
import { commsRouter, settingsRouter } from "./routes/comms";
import { curriculumRouter, progressRouter } from "./routes/curriculum";
import { directoryRouter } from "./routes/directory";
import { governanceRouter } from "./routes/governance";
import { meetingsRouter } from "./routes/meetings";
import { reportsRouter } from "./routes/reports";
import { profileRouter, usersRouter } from "./routes/users";
import { requireUser } from "./lib/access";
import { HttpError } from "./lib/errors";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: process.env.WEB_ORIGIN || "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use("/api/v1/webhooks/razorpay", express.raw({ type: "application/json" }), webhookRouter);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(originGuard);
  app.use(loadUser);

  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get(/^\/api\/v1\/files\/(.+)/, async (req, res, next) => {
    try {
      const key = decodeURIComponent((req.params as unknown as string[])[0] || "");
      if (!key.startsWith("avatars/")) requireUser(req);
      const object = await getObject(key);
      if (!object) throw new HttpError(404, "File not found");
      res.setHeader("Content-Type", object.contentType);
      res.send(object.body);
    } catch (error) {
      next(error);
    }
  });

  const api = express.Router();
  api.use("/auth", authRouter);
  api.use("/users", usersRouter);
  api.use("/me", profileRouter);
  api.use("/me", progressRouter);
  api.use(applicationsRouter);
  api.use("/clubs", clubsRouter);
  api.use(meetingsRouter);
  api.use(governanceRouter);
  api.use("/curriculum", curriculumRouter);
  api.use(commsRouter);
  api.use("/settings", settingsRouter);
  api.use("/reports", reportsRouter);
  api.use("/audit-logs", auditRouter);
  api.use("/directory", directoryRouter);
  app.use("/api/v1", api);
  app.use(errorMiddleware);
  return app;
}
