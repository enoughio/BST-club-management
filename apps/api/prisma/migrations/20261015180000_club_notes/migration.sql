CREATE TABLE "ClubNote" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "flag" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClubNote_clubId_createdAt_idx" ON "ClubNote"("clubId", "createdAt");

ALTER TABLE "ClubNote" ADD CONSTRAINT "ClubNote_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubNote" ADD CONSTRAINT "ClubNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
