import { Prisma } from "@prisma/client";
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

const kinds = ["GUIDE_FILE", "VIDEO", "BOOK", "ARTICLE"] as const;

const snapshotSchema = z.object({
  levels: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        name: z.string().max(120),
        projects: z
          .array(
            z.object({
              id: z.string().min(1).max(80),
              title: z.string().max(160),
              description: z.string().max(4000).nullable().optional(),
              evaluationCriteria: z.string().max(4000).nullable().optional(),
              materials: z
                .array(
                  z.object({
                    id: z.string().min(1).max(80),
                    title: z.string().max(160),
                    kind: z.enum(kinds),
                    url: z.string().max(500).nullable().optional(),
                    fileKey: z.string().max(400).nullable().optional(),
                    fileName: z.string().max(200).nullable().optional(),
                    mimeType: z.string().max(120).nullable().optional(),
                  }),
                )
                .max(30),
            }),
          )
          .max(60),
      }),
    )
    .max(20),
});

type Snapshot = z.infer<typeof snapshotSchema>;
type Issue = { levelId: string; projectId?: string; materialId?: string; field: string; message: string };

const treeInclude = {
  projects: {
    orderBy: { number: "asc" as const },
    include: { materials: { orderBy: { position: "asc" as const } } },
  },
};

function loadTree() {
  return prisma.level.findMany({ orderBy: { number: "asc" }, include: treeInclude });
}

function versionList() {
  return prisma.curriculumVersion.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      status: true,
      summary: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });
}

function toSnapshot(levels: Awaited<ReturnType<typeof loadTree>>): Snapshot {
  return {
    levels: levels.map((level) => ({
      id: level.id,
      name: level.name,
      projects: level.projects.map((project) => ({
        id: project.id,
        title: project.title,
        description: project.description,
        evaluationCriteria: project.evaluationCriteria,
        materials: project.materials.map((material) => ({
          id: material.id,
          title: material.title,
          kind: material.kind,
          url: material.url,
          fileKey: material.fileKey,
          fileName: material.fileName,
          mimeType: material.mimeType,
        })),
      })),
    })),
  };
}

function blank(value: string | null | undefined) {
  const text = (value || "").trim();
  return text.length ? text : null;
}

function validUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function publicationIssues(snapshot: Snapshot, requireGuideFile: boolean): Issue[] {
  const issues: Issue[] = [];
  snapshot.levels.forEach((level) => {
    if (level.name.trim().length < 2) {
      issues.push({ levelId: level.id, field: "name", message: "Level name is required." });
    }
    level.projects.forEach((project) => {
      if (project.title.trim().length < 2) {
        issues.push({ levelId: level.id, projectId: project.id, field: "title", message: "Project title is required." });
      }
      if (project.materials.length === 0) {
        issues.push({ levelId: level.id, projectId: project.id, field: "materials", message: "Add at least one learning material." });
      }
      if (requireGuideFile && !project.materials.some((material) => material.kind === "GUIDE_FILE" && (material.fileKey || material.url))) {
        issues.push({ levelId: level.id, projectId: project.id, field: "guide", message: "Add a guide file before this can be published." });
      }
      project.materials.forEach((material) => {
        if (material.title.trim().length < 2) {
          issues.push({ levelId: level.id, projectId: project.id, materialId: material.id, field: "label", message: "Each learning material needs a label." });
        }
        const url = blank(material.url);
        const fileKey = blank(material.fileKey);
        if (!url && !fileKey) {
          issues.push({ levelId: level.id, projectId: project.id, materialId: material.id, field: "source", message: "Add a URL or upload a file." });
        } else if (url && !validUrl(url)) {
          issues.push({ levelId: level.id, projectId: project.id, materialId: material.id, field: "source", message: "Use an http or https link." });
        } else if (fileKey && !fileKey.startsWith("materials/")) {
          issues.push({ levelId: level.id, projectId: project.id, materialId: material.id, field: "source", message: "That file is not a curriculum upload." });
        }
      });
    });
  });
  return issues;
}

async function applySnapshot(snapshot: Snapshot) {
  const existingLevels = await prisma.level.findMany({ include: { projects: { include: { materials: true } } } });
  const existingProjects = existingLevels.flatMap((level) => level.projects);
  const existingMaterials = existingProjects.flatMap((project) => project.materials);
  const existingLevelIds = new Set(existingLevels.map((level) => level.id));
  const existingProjectIds = new Set(existingProjects.map((project) => project.id));
  const existingMaterialIds = new Set(existingMaterials.map((material) => material.id));

  const keptFileKeys = new Set<string>();
  await prisma.$transaction(async (tx) => {
    for (const level of existingLevels) {
      await tx.level.update({ where: { id: level.id }, data: { number: level.number + 100 } });
    }
    for (const project of existingProjects) {
      await tx.project.update({ where: { id: project.id }, data: { number: project.number + 100 } });
    }

    const keptLevels = new Set<string>();
    const keptProjects = new Set<string>();
    const keptMaterials = new Set<string>();

    for (let levelIndex = 0; levelIndex < snapshot.levels.length; levelIndex += 1) {
      const level = snapshot.levels[levelIndex];
      let levelId = level.id;
      if (existingLevelIds.has(level.id)) {
        await tx.level.update({ where: { id: level.id }, data: { name: level.name.trim(), number: levelIndex + 1 } });
      } else {
        const created = await tx.level.create({ data: { name: level.name.trim() || "Untitled level", number: levelIndex + 1 } });
        levelId = created.id;
      }
      keptLevels.add(levelId);

      for (let projectIndex = 0; projectIndex < level.projects.length; projectIndex += 1) {
        const project = level.projects[projectIndex];
        const data = {
          levelId,
          number: projectIndex + 1,
          title: project.title.trim() || "Untitled project",
          description: blank(project.description),
          evaluationCriteria: blank(project.evaluationCriteria),
        };
        let projectId = project.id;
        if (existingProjectIds.has(project.id)) {
          await tx.project.update({ where: { id: project.id }, data });
        } else {
          const created = await tx.project.create({ data });
          projectId = created.id;
        }
        keptProjects.add(projectId);

        for (let materialIndex = 0; materialIndex < project.materials.length; materialIndex += 1) {
          const material = project.materials[materialIndex];
          const fileKey = blank(material.fileKey);
          if (fileKey) keptFileKeys.add(fileKey);
          const materialData = {
            projectId,
            title: material.title.trim() || "Untitled",
            kind: material.kind,
            url: blank(material.url),
            fileKey,
            fileName: blank(material.fileName),
            mimeType: blank(material.mimeType),
            position: materialIndex,
          };
          if (existingMaterialIds.has(material.id)) {
            await tx.projectMaterial.update({ where: { id: material.id }, data: materialData });
            keptMaterials.add(material.id);
          } else {
            const created = await tx.projectMaterial.create({ data: materialData });
            keptMaterials.add(created.id);
          }
        }
      }
    }

    const droppedMaterials = existingMaterials.filter((material) => !keptMaterials.has(material.id));
    if (droppedMaterials.length) {
      await tx.projectMaterial.deleteMany({ where: { id: { in: droppedMaterials.map((material) => material.id) } } });
    }
    const droppedProjects = existingProjects.filter((project) => !keptProjects.has(project.id) && keptLevels.has(project.levelId));
    if (droppedProjects.length) {
      await tx.project.deleteMany({ where: { id: { in: droppedProjects.map((project) => project.id) } } });
    }
    const droppedLevels = existingLevels.filter((level) => !keptLevels.has(level.id));
    if (droppedLevels.length) {
      await tx.level.deleteMany({ where: { id: { in: droppedLevels.map((level) => level.id) } } });
    }
  }, { timeout: 20000 });

  const orphanKeys = [...new Set(existingMaterials.flatMap((material) => (material.fileKey && !keptFileKeys.has(material.fileKey) ? [material.fileKey] : [])))];
  await Promise.all(orphanKeys.map((key) => deleteObject(key)));
}

async function builderPayload() {
  const [draft, levels, versions, settings, progress] = await Promise.all([
    prisma.curriculumVersion.findFirst({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" } }),
    loadTree(),
    versionList(),
    prisma.orgSettings.findUnique({ where: { id: "org" } }),
    prisma.memberProject.groupBy({ by: ["projectId"], _count: { _all: true } }),
  ]);
  const parsed = draft ? snapshotSchema.safeParse(draft.snapshot) : null;
  const progressCounts: Record<string, number> = {};
  progress.forEach((row) => {
    progressCounts[row.projectId] = row._count._all;
  });
  return {
    source: parsed?.success ? "draft" : "published",
    draftSavedAt: parsed?.success ? draft?.createdAt : null,
    levels: parsed?.success ? parsed.data.levels : toSnapshot(levels).levels,
    requireGuideFile: settings?.requireGuideFile ?? true,
    versions,
    progressCounts,
  };
}

curriculumRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    requireUser(req);
    res.json({ levels: await loadTree() });
  }),
);

curriculumRouter.get(
  "/builder",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    res.json(await builderPayload());
  }),
);

curriculumRouter.post(
  "/uploads",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    if (!req.file) throw new HttpError(400, "Choose a file");
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `materials/${Date.now()}-${safeName}`;
    await putObject(fileKey, req.file.buffer, req.file.mimetype || "application/octet-stream");
    res.status(201).json({ fileKey, fileName: req.file.originalname, mimeType: req.file.mimetype || "application/octet-stream" });
  }),
);

curriculumRouter.put(
  "/draft",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const snapshot = snapshotSchema.parse(req.body);
    const summary = typeof req.body.summary === "string" ? req.body.summary.slice(0, 200) : "Saved as draft";
    const existing = await prisma.curriculumVersion.findFirst({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" } });
    if (existing) {
      await prisma.curriculumVersion.update({
        where: { id: existing.id },
        data: { snapshot: snapshot as Prisma.InputJsonValue, summary, authorId: actor.id, createdAt: new Date() },
      });
    } else {
      await prisma.curriculumVersion.create({
        data: { status: "DRAFT", snapshot: snapshot as Prisma.InputJsonValue, summary, authorId: actor.id },
      });
    }
    res.json(await builderPayload());
  }),
);

curriculumRouter.delete(
  "/draft",
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    await prisma.curriculumVersion.deleteMany({ where: { status: "DRAFT" } });
    res.json(await builderPayload());
  }),
);

curriculumRouter.post(
  "/publish",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const snapshot = snapshotSchema.parse(req.body);
    const settings = await prisma.orgSettings.findUnique({ where: { id: "org" } });
    const issues = publicationIssues(snapshot, settings?.requireGuideFile ?? true);
    if (issues.length) throw new HttpError(400, "Fix the flagged levels and projects before publishing.", issues);
    const summary = typeof req.body.summary === "string" ? req.body.summary.slice(0, 200) : "Published";
    await applySnapshot(snapshot);
    const levels = toSnapshot(await loadTree());
    await prisma.curriculumVersion.deleteMany({ where: { status: "DRAFT" } });
    await prisma.curriculumVersion.create({
      data: {
        status: "PUBLISHED",
        snapshot: levels as Prisma.InputJsonValue,
        summary,
        authorId: actor.id,
      },
    });
    await writeAudit({ actorId: actor.id, action: "curriculum.publish", entityType: "Curriculum", entityId: "org", snapshot: { summary } });
    res.json(await builderPayload());
  }),
);

curriculumRouter.post(
  "/rollback",
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const body = z.object({ versionId: z.string() }).parse(req.body);
    const version = await prisma.curriculumVersion.findUnique({ where: { id: body.versionId } });
    if (!version || version.status !== "PUBLISHED") throw new HttpError(404, "Published version not found");
    const snapshot = snapshotSchema.parse(version.snapshot);
    await applySnapshot(snapshot);
    const levels = toSnapshot(await loadTree());
    const summary = `Restored the version from ${version.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
    await prisma.curriculumVersion.deleteMany({ where: { status: "DRAFT" } });
    await prisma.curriculumVersion.create({
      data: { status: "PUBLISHED", snapshot: levels as Prisma.InputJsonValue, summary, authorId: actor.id },
    });
    await writeAudit({
      actorId: actor.id,
      action: "curriculum.rollback",
      entityType: "Curriculum",
      entityId: "org",
      snapshot: { restoredVersionId: version.id },
    });
    res.json(await builderPayload());
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
      prisma.level.findMany({ orderBy: { number: "asc" }, include: treeInclude }),
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
