-- CreateEnum
CREATE TYPE "FeePeriod" AS ENUM ('ANNUAL', 'QUARTERLY');

-- AlterTable
ALTER TABLE "Club" ADD COLUMN "quarterlyFeeAmount" INTEGER;

-- AlterTable
ALTER TABLE "MembershipApplication" ADD COLUMN "feePeriod" "FeePeriod" NOT NULL DEFAULT 'ANNUAL';

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "feePeriod" "FeePeriod" NOT NULL DEFAULT 'ANNUAL',
ADD COLUMN "periodEndsAt" TIMESTAMP(3),
ADD COLUMN "transferredAt" TIMESTAMP(3);

-- Backfill existing memberships as annual, ending on the next anniversary of joinedAt.
-- This year's anniversary is used when that date is still ahead; otherwise next year.
UPDATE "Membership"
SET "periodEndsAt" = CASE
  WHEN (
    ("joinedAt" + ((EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::int - EXTRACT(YEAR FROM "joinedAt")::int) * INTERVAL '1 year'))::date
    > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
  )
  THEN "joinedAt" + ((EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::int - EXTRACT(YEAR FROM "joinedAt")::int) * INTERVAL '1 year')
  ELSE "joinedAt" + ((EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))::int - EXTRACT(YEAR FROM "joinedAt")::int + 1) * INTERVAL '1 year')
END;

ALTER TABLE "Membership" ALTER COLUMN "periodEndsAt" SET NOT NULL;
