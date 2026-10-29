ALTER TABLE "User" ADD COLUMN "school" TEXT;
ALTER TABLE "User" ADD COLUMN "grade" TEXT;
ALTER TABLE "User" ADD COLUMN "guardianName" TEXT;
ALTER TABLE "User" ADD COLUMN "guardianPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "guardianEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "secondGuardianName" TEXT;
ALTER TABLE "User" ADD COLUMN "secondGuardianPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "secondGuardianEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "consentPhoto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "consentParticipation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "consentData" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Membership" ADD COLUMN "gradeAtJoin" TEXT;
