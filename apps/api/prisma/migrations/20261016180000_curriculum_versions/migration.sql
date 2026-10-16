-- AlterTable
ALTER TABLE "Project" ADD COLUMN "evaluationCriteria" TEXT;
ALTER TABLE "ProjectMaterial" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrgSettings" ADD COLUMN "requireGuideFile" BOOLEAN NOT NULL DEFAULT true;

-- Remap learning-material kinds into one list: guide file, video, book, article.
CREATE TYPE "MaterialKind_new" AS ENUM ('GUIDE_FILE', 'VIDEO', 'BOOK', 'ARTICLE');
ALTER TABLE "ProjectMaterial" ALTER COLUMN "kind" TYPE "MaterialKind_new" USING (
  CASE "kind"::text
    WHEN 'GUIDE' THEN 'GUIDE_FILE'
    WHEN 'YOUTUBE' THEN 'VIDEO'
    WHEN 'HANDBOOK' THEN 'BOOK'
    WHEN 'GUIDE_FILE' THEN 'GUIDE_FILE'
    WHEN 'VIDEO' THEN 'VIDEO'
    WHEN 'BOOK' THEN 'BOOK'
    WHEN 'ARTICLE' THEN 'ARTICLE'
    ELSE 'ARTICLE'
  END::"MaterialKind_new"
);
ALTER TYPE "MaterialKind" RENAME TO "MaterialKind_old";
ALTER TYPE "MaterialKind_new" RENAME TO "MaterialKind";
DROP TYPE "MaterialKind_old";

WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt")) - 1 AS pos
  FROM "ProjectMaterial"
)
UPDATE "ProjectMaterial" AS m SET "position" = ranked.pos FROM ranked WHERE m.id = ranked.id;

-- CreateTable
CREATE TYPE "CurriculumVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "CurriculumVersion" (
    "id" TEXT NOT NULL,
    "status" "CurriculumVersionStatus" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CurriculumVersion_status_createdAt_idx" ON "CurriculumVersion"("status", "createdAt");

ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
