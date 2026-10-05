import type { Election, OfficerTitle } from "@prisma/client";
import { addDays, addMonths } from "./dates";
import { sendElectionOpened, sendElectionResults } from "./mailer";
import { notifyUsers } from "./notify";
import { prisma } from "./prisma";
import { roleLabel, TITLES } from "./serialize";

async function activeMemberIds(clubId: string) {
  const rows = await prisma.membership.findMany({
    where: { clubId, status: "ACTIVE" },
    select: { userId: true, user: { select: { email: true, name: true } } },
  });
  return rows;
}

export async function openDueElections() {
  const now = new Date();
  const clubs = await prisma.club.findMany({
    where: { nextElectionAt: { lte: now }, status: { not: "INACTIVE" } },
  });
  for (const club of clubs) {
    const open = await prisma.election.findFirst({
      where: { clubId: club.id, status: { in: ["NOMINATION", "VOTING"] } },
    });
    if (open) continue;
    const nominationOpens = now;
    const nominationCloses = addDays(now, 7);
    const votingOpens = nominationCloses;
    const votingCloses = addDays(votingOpens, 7);
    await prisma.election.create({
      data: { clubId: club.id, status: "NOMINATION", nominationOpens, nominationCloses, votingOpens, votingCloses },
    });
    const members = await activeMemberIds(club.id);
    const url = `${process.env.WEB_ORIGIN || "http://localhost:3000"}/club/${club.id}/elections`;
    await notifyUsers(
      members.map((member) => member.userId),
      "Election open",
      `Nominations are open for ${club.name}.`,
      `/club/${club.id}/elections`,
    );
    await Promise.all(members.map((member) => sendElectionOpened(member.user.email, club.name, url).catch((error) => console.error(error))));
  }
}

export async function advanceElections() {
  const now = new Date();
  await prisma.election.updateMany({
    where: { status: "NOMINATION", nominationCloses: { lte: now } },
    data: { status: "VOTING" },
  });
  const due = await prisma.election.findMany({
    where: { status: "VOTING", votingCloses: { lte: now } },
  });
  for (const election of due) {
    await finalizeElection(election);
  }
}

export async function finalizeElection(election: Election) {
  const club = await prisma.club.findUnique({ where: { id: election.clubId } });
  if (!club) return;
  const [nominations, votes, memberships] = await Promise.all([
    prisma.nomination.findMany({ where: { electionId: election.id } }),
    prisma.vote.findMany({ where: { electionId: election.id } }),
    prisma.membership.findMany({ where: { clubId: club.id }, select: { userId: true, joinedAt: true } }),
  ]);
  const joined = new Map(memberships.map((row) => [row.userId, row.joinedAt.getTime()]));
  const lines: string[] = [];
  const now = new Date();

  for (const title of TITLES) {
    const candidates = nominations.filter((row) => row.title === title).map((row) => row.userId);
    if (candidates.length === 0) continue;
    const tally = new Map<string, number>();
    for (const candidate of candidates) tally.set(candidate, 0);
    for (const vote of votes) {
      if (vote.title !== title || !tally.has(vote.candidateId)) continue;
      tally.set(vote.candidateId, (tally.get(vote.candidateId) || 0) + 1);
    }
    const ranked = [...tally.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return (joined.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (joined.get(b[0]) ?? Number.MAX_SAFE_INTEGER);
    });
    const winnerId = ranked[0]?.[0];
    if (!winnerId) continue;
    await prisma.officerRole.updateMany({
      where: { clubId: club.id, title: title as OfficerTitle, endedAt: null },
      data: { endedAt: now },
    });
    await prisma.officerRole.create({
      data: { clubId: club.id, userId: winnerId, title: title as OfficerTitle, startedAt: now, electionId: election.id },
    });
    const winner = await prisma.user.findUnique({ where: { id: winnerId }, select: { name: true } });
    lines.push(`${roleLabel(title)}: ${winner?.name || "Member"} (${ranked[0][1]} votes)`);
  }

  await prisma.election.update({
    where: { id: election.id },
    data: { status: "COMPLETED", completedAt: now },
  });
  await prisma.club.update({
    where: { id: club.id },
    data: { nextElectionAt: addMonths(now, club.electionIntervalMonths) },
  });

  const summary = lines.length ? lines.join("\n") : "No nominations were received. Current officers remain in place.";
  const members = await activeMemberIds(club.id);
  await notifyUsers(members.map((member) => member.userId), "Election results", summary, `/club/${club.id}/elections`);
  await Promise.all(members.map((member) => sendElectionResults(member.user.email, club.name, summary).catch((error) => console.error(error))));
}

export async function runElectionMaintenance() {
  await openDueElections();
  await advanceElections();
}
