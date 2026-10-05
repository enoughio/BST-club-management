-- AlterEnum
CREATE TYPE "MaterialKind_new" AS ENUM ('GUIDE', 'HANDBOOK', 'OTHER', 'LINK', 'YOUTUBE');
ALTER TABLE "ProjectMaterial" ALTER COLUMN "kind" TYPE "MaterialKind_new" USING ("kind"::text::"MaterialKind_new");
ALTER TYPE "MaterialKind" RENAME TO "MaterialKind_old";
ALTER TYPE "MaterialKind_new" RENAME TO "MaterialKind";
DROP TYPE "MaterialKind_old";

-- AlterTable
ALTER TABLE "ProjectMaterial" ALTER COLUMN "fileKey" DROP NOT NULL;
ALTER TABLE "ProjectMaterial" ALTER COLUMN "fileName" DROP NOT NULL;
ALTER TABLE "ProjectMaterial" ALTER COLUMN "mimeType" DROP NOT NULL;
ALTER TABLE "ProjectMaterial" ADD COLUMN "url" TEXT;
