import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireSuperAdmin, requireUser } from "../lib/access";
import { writeAudit } from "../lib/audit";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../lib/http";
import { prisma } from "../lib/prisma";
import { deleteObject, getObject, putObject } from "../lib/storage";

export const curriculumRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

curriculumRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    requireUser(req);
    const levels = await prisma.level.findMany({
      orderBy: { number: "asc" },
      include: {
        projects: {
          orderBy: { number: "asc" },
          include: { materials: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
    res.json({ levels });
  }),
);

curriculumRouter.post(
  "/levels",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const body = z.object({ number: z.number().int().min(1).max(20), name: z.string().min(2).max(120) }).parse(req.body);
    const level = await prisma.level.create({ data: body });
    res.status(201).json({ level });
  }),
);

curriculumRouter.patch(
  "/levels/:id",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const body = z.object({ number: z.number().int().min(1).max(20).optional(), name: z.string().min(2).max(120).optional() }).parse(req.body);
    const level = await prisma.level.update({ where: { id: req.params.id }, data: body });
    res.json({ level });
  }),
);

curriculumRouter.delete(
  "/levels/:id",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    await prisma.level.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

curriculumRouter.post(
  "/projects",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const body = z
      .object({
        levelId: z.string(),
        number: z.number().int().min(1),
        title: z.string().min(2).max(160),
        description: z.string().max(2000).optional().nullable(),
      })
      .parse(req.body);
    const project = await prisma.project.create({ data: { ...body, description: body.description || null } });
    res.status(201).json({ project });
  }),
);

curriculumRouter.patch(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const body = z
      .object({
        number: z.number().int().min(1).optional(),
        title: z.string().min(2).max(160).optional(),
        description: z.string().max(2000).optional().nullable(),
      })
      .parse(req.body);
    const project = await prisma.project.update({ where: { id: req.params.id }, data: body });
    res.json({ project });
  }),
);

curriculumRouter.delete(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const materials = await prisma.projectMaterial.findMany({ where: { projectId: req.params.id } });
    await Promise.all(materials.filter((material) => material.fileKey).map((material) => deleteObject(material.fileKey!)));
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

curriculumRouter.post(
  "/projects/:id/materials",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) throw new HttpError(404, "Project not found");
    if (!req.file) throw new HttpError(400, "Choose a file");
    const body = z.object({ title: z.string().min(2).max(160), kind: z.enum(["GUIDE", "HANDBOOK", "OTHER"]) }).parse(req.body);
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `materials/${project.id}/${Date.now()}-${safeName}`;
    await putObject(key, req.file.buffer, req.file.mimetype || "application/octet-stream");
    const material = await prisma.projectMaterial.create({
      data: {
        projectId: project.id,
        title: body.title,
        kind: body.kind,
        fileKey: key,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype || "application/octet-stream",
      },
    });
    res.status(201).json({ material });
  }),
);

curriculumRouter.post(
  "/projects/:id/links",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) throw new HttpError(404, "Project not found");
    const body = z
      .object({
        title: z.string().min(2).max(160),
        url: z.string().url().max(500),
        kind: z.enum(["LINK", "YOUTUBE"]),
      })
      .parse(req.body);
    if (body.kind === "YOUTUBE") {
      const host = new URL(body.url).hostname.replace(/^www\./, "");
      const allowed = host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com";
      if (!allowed) throw new HttpError(400, "YouTube links must use youtube.com or youtu.be");
    }
    const material = await prisma.projectMaterial.create({
      data: { projectId: project.id, title: body.title, kind: body.kind, url: body.url },
    });
    await writeAudit({
      actorId: actor.id,
      action: "curriculum.link",
      entityType: "ProjectMaterial",
      entityId: material.id,
      snapshot: { projectId: project.id, kind: body.kind, url: body.url },
    });
    res.status(201).json({ material });
  }),
);

curriculumRouter.delete(
  "/materials/:id",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const material = await prisma.projectMaterial.findUnique({ where: { id: req.params.id } });
    if (!material) throw new HttpError(404, "File not found");
    if (material.fileKey) await deleteObject(material.fileKey);
    await prisma.projectMaterial.delete({ where: { id: material.id } });
    res.json({ ok: true });
  }),
);

curriculumRouter.get(
  "/materials/:id/download",
  asyncHandler(async (req, res) => {
    requireUser(req);
    const material = await prisma.projectMaterial.findUnique({ where: { id: req.params.id } });
    if (!material) throw new HttpError(404, "File not found");
    if (!material.fileKey) throw new HttpError(400, "This material is a link");
    const object = await getObject(material.fileKey);
    if (!object) throw new HttpError(404, "File is missing from storage");
    const fileName = material.fileName || "download";
    res.setHeader("Content-Type", material.mimeType || object.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(/"/g, "")}"`);
    res.send(object.body);
  }),
);

export const progressRouter = Router();

progressRouter.get(
  "/progress",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const [levels, progress, certificates] = await Promise.all([
      prisma.level.findMany({
        orderBy: { number: "asc" },
        include: { projects: { orderBy: { number: "asc" }, include: { materials: true } } },
      }),
      prisma.memberProject.findMany({ where: { userId: user.id }, include: { project: true, evaluator: { select: { id: true, name: true } } } }),
      prisma.certificate.findMany({ where: { userId: user.id }, orderBy: { issuedAt: "desc" } }),
    ]);
    const approved = new Set(progress.filter((row) => row.approved).map((row) => row.projectId));
    let open = true;
    const withAccess = levels.map((level) => {
      const unlocked = open;
      if (level.projects.some((project) => !approved.has(project.id))) open = false;
      return { ...level, unlocked };
    });
    res.json({ levels: withAccess, progress, certificates });
  }),
);

async function assertLevelUnlocked(userId: string, levelId: string) {
  const levels = await prisma.level.findMany({
    orderBy: { number: "asc" },
    include: { projects: { select: { id: true } } },
  });
  const index = levels.findIndex((level) => level.id === levelId);
  if (index < 0) throw new HttpError(404, "Level not found");
  const approved = await prisma.memberProject.findMany({
    where: { userId, approved: true },
    select: { projectId: true },
  });
  const approvedIds = new Set(approved.map((row) => row.projectId));
  const blocked = levels.slice(0, index).some((level) => level.projects.some((project) => !approvedIds.has(project.id)));
  if (blocked) throw new HttpError(400, "Complete every project in the current level before starting the next one");
}

progressRouter.post(
  "/projects/:projectId/select",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) throw new HttpError(404, "Project not found");
    const existing = await prisma.memberProject.findUnique({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
    });
    if (!existing) await assertLevelUnlocked(user.id, project.levelId);
    const row = await prisma.memberProject.upsert({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
      create: { userId: user.id, projectId: project.id },
      update: {},
    });
    res.json({ memberProject: row });
  }),
);
