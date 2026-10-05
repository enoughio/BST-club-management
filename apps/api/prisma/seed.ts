import { PrismaClient, type OfficerTitle } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function monthsAgo(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

async function main() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table.tablename}" RESTART IDENTITY CASCADE`);
  }

  const passwordHash = await bcrypt.hash("Demo1234!", 10);
  const uploads = path.resolve(process.cwd(), "uploads", "materials");
  await fs.mkdir(uploads, { recursive: true });

  await prisma.orgSettings.create({
    data: {
      id: "org",
      name: "Harbour & District Clubs",
      primaryColor: "#1e3a5f",
      defaultFeeAmount: 150000,
      defaultCurrency: "INR",
      supportEmail: "hq@clubportal.local",
    },
  });

  const levels = [
    { number: 1, name: "Foundations", projects: ["Ice Breaker", "Writing a Speech with Purpose"] },
    { number: 2, name: "Engagement", projects: ["Know Your Audience", "Connect with Storytelling"] },
    { number: 3, name: "Leadership basics", projects: ["Active Listening", "Give Useful Feedback"] },
    { number: 4, name: "Persuasion", projects: ["Persuade with Evidence", "Inspire Action"] },
    { number: 5, name: "Vision", projects: ["Lead a Team Brief", "Deliver Your Vision"] },
  ];

  const projectIds = new Map<string, string>();
  for (const level of levels) {
    const created = await prisma.level.create({
      data: { number: level.number, name: level.name },
    });
    for (const [index, title] of level.projects.entries()) {
      const project = await prisma.project.create({
        data: {
          levelId: created.id,
          number: index + 1,
          title,
          description: `${title} is part of ${level.name}. Download the guide, deliver it as a prepared speech, and ask your speech evaluator to approve it after the meeting.`,
        },
      });
      projectIds.set(`${level.number}.${index + 1}`, project.id);
      if (index === 0) {
        const fileName = `level-${level.number}-guide.txt`;
        const fileKey = `materials/${fileName}`;
        const body = [
          `${level.name} — ${title}`,
          "",
          "Speak for five to seven minutes.",
          "Open with one concrete moment, make a single point, and close with what you want the room to remember.",
          "Your speech evaluator records comments and a score after the meeting is marked completed.",
        ].join("\n");
        await fs.writeFile(path.join(uploads, fileName), body, "utf8");
        await prisma.projectMaterial.create({
          data: {
            projectId: project.id,
            title: `${title} guide`,
            kind: "GUIDE",
            fileKey,
            fileName,
            mimeType: "text/plain",
          },
        });
      }
    }
  }

  const clubs = await Promise.all([
    prisma.club.create({
      data: {
        name: "Harbour Lights",
        slug: "harbour-lights",
        city: "Mumbai",
        address: "12 Ropewalk Lane, Colaba",
        meetingSchedule: "2nd and 4th Thursday, 19:00",
        description: "A waterfront club for people learning to speak in public.",
        charterDate: new Date("2024-01-15T00:00:00.000Z"),
        status: "ACTIVE",
        membershipFeeAmount: 150000,
        currency: "INR",
        electionIntervalMonths: 6,
        nextElectionAt: daysFromNow(120),
      },
    }),
    prisma.club.create({
      data: {
        name: "Deccan Orators",
        slug: "deccan-orators",
        city: "Pune",
        address: "44 FC Road",
        meetingSchedule: "Every Wednesday, 18:30",
        description: "Weeknight speeches and evaluations in Pune.",
        charterDate: new Date("2023-06-01T00:00:00.000Z"),
        status: "ACTIVE",
        membershipFeeAmount: 120000,
        currency: "INR",
        electionIntervalMonths: 12,
        nextElectionAt: daysFromNow(200),
      },
    }),
    prisma.club.create({
      data: {
        name: "Garden City Voices",
        slug: "garden-city-voices",
        city: "Bengaluru",
        address: "8 Lavelle Road",
        meetingSchedule: "Saturday mornings, 10:00",
        description: "A provisional club building its first full committee.",
        charterDate: new Date("2025-11-01T00:00:00.000Z"),
        status: "PROVISIONAL",
        membershipFeeAmount: 180000,
        currency: "INR",
        electionIntervalMonths: 6,
        nextElectionAt: daysFromNow(160),
      },
    }),
    prisma.club.create({
      data: {
        name: "Capital Communicators",
        slug: "capital-communicators",
        city: "New Delhi",
        address: "3 Barakhamba Road",
        meetingSchedule: "1st and 3rd Monday, 19:30",
        description: "Speeches for people who work across the capital.",
        charterDate: new Date("2022-09-12T00:00:00.000Z"),
        status: "ACTIVE",
        membershipFeeAmount: 200000,
        currency: "INR",
        electionIntervalMonths: 12,
        nextElectionAt: daysFromNow(240),
      },
    }),
    prisma.club.create({
      data: {
        name: "Coastal Speakers",
        slug: "coastal-speakers",
        city: "Chennai",
        address: "19 Marina Road",
        meetingSchedule: "Paused",
        description: "Inactive while the club rebuilds its meeting place.",
        charterDate: new Date("2021-04-20T00:00:00.000Z"),
        status: "INACTIVE",
        membershipFeeAmount: 100000,
        currency: "INR",
        electionIntervalMonths: 6,
        nextElectionAt: daysFromNow(300),
      },
    }),
  ]);

  const [harbour, deccan, garden, capital, coastal] = clubs;

  async function user(email: string, name: string, city: string, role: "SUPER_ADMIN" | "USER" = "USER") {
    return prisma.user.create({
      data: { email, name, city, passwordHash, role, status: "ACTIVE", phone: "9800000000", occupation: "Professional", goals: "Speak with more clarity." },
    });
  }

  const superAdmin = await user("super@clubportal.local", "HQ Admin", "Mumbai", "SUPER_ADMIN");
  const aisha = await user("admin@clubportal.local", "Aisha Kapoor", "Mumbai");
  const rohan = await user("member@clubportal.local", "Rohan Mehta", "Mumbai");
  const neha = await user("neha.shah@clubportal.local", "Neha Shah", "Mumbai");
  const vikram = await user("vikram.iyer@clubportal.local", "Vikram Iyer", "Mumbai");
  const sara = await user("sara.qureshi@clubportal.local", "Sara Qureshi", "Mumbai");
  const leela = await user("leela.nair@clubportal.local", "Leela Nair", "Mumbai");
  const imran = await user("imran.das@clubportal.local", "Imran Das", "Mumbai");
  const tara = await user("tara.bose@clubportal.local", "Tara Bose", "Mumbai");
  const meera = await user("meera.joshi@clubportal.local", "Meera Joshi", "Pune");
  const arjun = await user("president@clubportal.local", "Arjun Deshmukh", "Pune");
  const kabir = await user("kabir.rao@clubportal.local", "Kabir Rao", "Pune");
  const ananya = await user("ananya.kulkarni@clubportal.local", "Ananya Kulkarni", "Pune");
  const priya = await user("priya.nair@clubportal.local", "Priya Nair", "Bengaluru");
  const farhan = await user("farhan.ali@clubportal.local", "Farhan Ali", "Bengaluru");
  const diya = await user("diya.menon@clubportal.local", "Diya Menon", "Bengaluru");
  const rahul = await user("rahul.verma@clubportal.local", "Rahul Verma", "New Delhi");
  const sneha = await user("sneha.iyer@clubportal.local", "Sneha Iyer", "New Delhi");
  const omar = await user("omar.sheikh@clubportal.local", "Omar Sheikh", "New Delhi");
  const lakshmi = await user("lakshmi.rao@clubportal.local", "Lakshmi Rao", "Chennai");
  const hari = await user("hari.menon@clubportal.local", "Hari Menon", "Chennai");

  async function join(userId: string, clubId: string, joinedAt: Date) {
    await prisma.membership.create({ data: { userId, clubId, status: "ACTIVE", joinedAt } });
  }

  const harbourJoined = new Date("2024-02-01T00:00:00.000Z");
  for (const member of [aisha, rohan, neha, vikram, sara, leela, imran, tara]) {
    await join(member.id, harbour.id, harbourJoined);
  }
  for (const member of [meera, arjun, kabir, ananya]) await join(member.id, deccan.id, new Date("2023-07-01T00:00:00.000Z"));
  for (const member of [priya, farhan, diya]) await join(member.id, garden.id, new Date("2025-11-15T00:00:00.000Z"));
  for (const member of [rahul, sneha, omar]) await join(member.id, capital.id, new Date("2022-10-01T00:00:00.000Z"));
  for (const member of [lakshmi, hari]) await join(member.id, coastal.id, new Date("2021-05-01T00:00:00.000Z"));

  async function appoint(userId: string, clubId: string) {
    await prisma.clubAdmin.create({ data: { userId, clubId, appointedById: superAdmin.id, appointedAt: monthsAgo(10) } });
  }
  await appoint(aisha.id, harbour.id);
  await appoint(meera.id, deccan.id);
  await appoint(priya.id, garden.id);
  await appoint(rahul.id, capital.id);
  await appoint(lakshmi.id, coastal.id);

  const pastStart = monthsAgo(14);
  const termChange = monthsAgo(2);
  const pastOfficers: [string, OfficerTitle][] = [
    [rohan.id, "PRESIDENT"],
    [neha.id, "VP_EDUCATION"],
    [vikram.id, "VP_MEMBERSHIP"],
    [sara.id, "VP_PUBLIC_RELATIONS"],
    [leela.id, "SECRETARY"],
    [imran.id, "TREASURER"],
    [tara.id, "SERGEANT_AT_ARMS"],
  ];
  for (const [userId, title] of pastOfficers) {
    await prisma.officerRole.create({
      data: { userId, clubId: harbour.id, title, startedAt: pastStart, endedAt: termChange },
    });
  }

  const election = await prisma.election.create({
    data: {
      clubId: harbour.id,
      status: "COMPLETED",
      nominationOpens: monthsAgo(4),
      nominationCloses: monthsAgo(3),
      votingOpens: monthsAgo(3),
      votingCloses: termChange,
      completedAt: termChange,
    },
  });
  const currentOfficers: [string, OfficerTitle][] = [
    [aisha.id, "PRESIDENT"],
    [neha.id, "VP_EDUCATION"],
    [vikram.id, "VP_MEMBERSHIP"],
    [sara.id, "VP_PUBLIC_RELATIONS"],
    [leela.id, "SECRETARY"],
    [imran.id, "TREASURER"],
    [tara.id, "SERGEANT_AT_ARMS"],
  ];
  for (const [userId, title] of currentOfficers) {
    await prisma.officerRole.create({
      data: { userId, clubId: harbour.id, title, startedAt: termChange, electionId: election.id },
    });
  }

  await prisma.officerRole.create({ data: { userId: arjun.id, clubId: deccan.id, title: "PRESIDENT", startedAt: monthsAgo(8) } });
  await prisma.officerRole.create({ data: { userId: ananya.id, clubId: deccan.id, title: "VP_EDUCATION", startedAt: monthsAgo(8) } });
  await prisma.officerRole.create({ data: { userId: hari.id, clubId: coastal.id, title: "PRESIDENT", startedAt: monthsAgo(6) } });
  await prisma.officerRole.create({ data: { userId: farhan.id, clubId: garden.id, title: "PRESIDENT", startedAt: monthsAgo(4) } });
  await prisma.officerRole.create({ data: { userId: omar.id, clubId: capital.id, title: "PRESIDENT", startedAt: monthsAgo(6) } });

  const series = await prisma.meetingSeries.create({
    data: { clubId: harbour.id, name: "Thursday Evening", weekday: 4, time: "19:00", place: "Colaba Community Hall" },
  });

  const iceBreaker = projectIds.get("1.1")!;
  const purpose = projectIds.get("1.2")!;

  async function completedMeeting(daysAgo: number, title: string, speakerId: string, projectId: string, evaluatorId: string) {
    const meeting = await prisma.meeting.create({
      data: {
        clubId: harbour.id,
        seriesId: series.id,
        title,
        meetingDate: daysFromNow(-daysAgo),
        startTime: "19:00",
        endTime: "21:00",
        place: "Colaba Community Hall",
        status: "COMPLETED",
        summary: `${title} ran on time. Prepared speeches were evaluated in the room.`,
        createdById: aisha.id,
        finalizedAt: daysFromNow(-daysAgo - 2),
        completedAt: daysFromNow(-daysAgo),
      },
    });
    const roles: { role: "MOC" | "PREPARED_SPEAKER" | "SPEECH_EVALUATOR" | "CHIEF_EVALUATOR" | "TIMEKEEPER" | "LANGUAGE_EVALUATOR" | "FILLER_COUNTER" | "LISTENER"; userId: string; title: string; targetUserId?: string; projectId?: string }[] = [
      { role: "MOC", userId: aisha.id, title: "Open the meeting" },
      { role: "PREPARED_SPEAKER", userId: speakerId, title: "Prepared speech", projectId },
      { role: "SPEECH_EVALUATOR", userId: evaluatorId, title: "Evaluate the speech", targetUserId: speakerId },
      { role: "CHIEF_EVALUATOR", userId: vikram.id === speakerId || vikram.id === evaluatorId ? sara.id : vikram.id, title: "General evaluation" },
      { role: "TIMEKEEPER", userId: sara.id === speakerId || sara.id === evaluatorId ? leela.id : sara.id, title: "Keep time" },
      { role: "LANGUAGE_EVALUATOR", userId: leela.id === speakerId ? imran.id : leela.id, title: "Word of the day" },
      { role: "FILLER_COUNTER", userId: imran.id === speakerId || imran.id === evaluatorId ? tara.id : imran.id, title: "Count fillers" },
      { role: "LISTENER", userId: tara.id === speakerId || tara.id === evaluatorId ? rohan.id : tara.id, title: "Listen for the theme" },
    ];
    const seen = new Set<string>();
    const uniqueRoles = roles.filter((role) => {
      if (seen.has(role.userId)) return false;
      seen.add(role.userId);
      return true;
    });
    await prisma.agendaItem.createMany({
      data: uniqueRoles.map((role, index) => ({
        meetingId: meeting.id,
        sortOrder: index,
        role: role.role,
        title: role.title,
        assigneeId: role.userId,
        targetUserId: role.targetUserId,
        projectId: role.projectId,
        durationMin: role.role === "PREPARED_SPEAKER" ? 7 : 3,
      })),
    });
    const people = [aisha, rohan, neha, vikram, sara, leela, imran, tara];
    await prisma.rsvp.createMany({
      data: people.map((person) => ({ meetingId: meeting.id, userId: person.id, status: "YES" as const })),
    });
    await prisma.attendance.createMany({
      data: people.map((person) => ({ meetingId: meeting.id, userId: person.id, present: true, markedById: aisha.id })),
    });
    return meeting;
  }

  const firstMeeting = await completedMeeting(45, "Harbour evening 1", rohan.id, iceBreaker, neha.id);
  await completedMeeting(30, "Harbour evening 2", leela.id, purpose, sara.id);
  await completedMeeting(14, "Harbour evening 3", vikram.id, projectIds.get("2.1")!, imran.id);

  const progress = await prisma.memberProject.create({
    data: {
      userId: rohan.id,
      projectId: iceBreaker,
      score: 88,
      feedback: "Clear opening story and a confident close. Slow the middle by one breath.",
      approved: true,
      evaluatorId: neha.id,
      meetingId: firstMeeting.id,
      approvedAt: daysFromNow(-45),
    },
  });
  await prisma.certificate.create({
    data: { userId: rohan.id, memberProjectId: progress.id, title: "Ice Breaker certificate", issuedAt: daysFromNow(-45) },
  });
  await prisma.memberProject.create({ data: { userId: rohan.id, projectId: purpose } });

  const upcoming = await prisma.meeting.create({
    data: {
      clubId: harbour.id,
      seriesId: series.id,
      title: "Harbour evening — upcoming",
      meetingDate: daysFromNow(7),
      startTime: "19:00",
      endTime: "21:00",
      place: "Colaba Community Hall",
      status: "FINALIZED",
      createdById: aisha.id,
      finalizedAt: daysFromNow(-1),
    },
  });
  await prisma.agendaItem.createMany({
    data: [
      { meetingId: upcoming.id, sortOrder: 0, role: "MOC", title: "Open the meeting", assigneeId: aisha.id, durationMin: 3 },
      { meetingId: upcoming.id, sortOrder: 1, role: "PREPARED_SPEAKER", title: "Prepared speech", assigneeId: rohan.id, projectId: purpose, durationMin: 7 },
      { meetingId: upcoming.id, sortOrder: 2, role: "SPEECH_EVALUATOR", title: "Evaluate the speech", assigneeId: neha.id, targetUserId: rohan.id, durationMin: 3 },
      { meetingId: upcoming.id, sortOrder: 3, role: "TIMEKEEPER", title: "Keep time", assigneeId: sara.id, durationMin: 1 },
    ],
  });
  await prisma.rsvp.create({ data: { meetingId: upcoming.id, userId: rohan.id, status: "MAYBE" } });

  await prisma.meeting.create({
    data: {
      clubId: harbour.id,
      seriesId: series.id,
      title: "Harbour draft agenda",
      meetingDate: daysFromNow(21),
      startTime: "19:00",
      endTime: "21:00",
      place: "Colaba Community Hall",
      status: "DRAFT",
      createdById: aisha.id,
    },
  });

  await prisma.removalRequest.create({
    data: { clubId: deccan.id, userId: kabir.id, reason: "DUES_UNPAID", details: "Two renewal cycles without payment.", requesterId: meera.id, status: "PENDING" },
  });
  await prisma.removalRequest.create({
    data: { clubId: capital.id, userId: sneha.id, reason: "RESIGNATION", details: "Moving out of Delhi.", requesterId: rahul.id, status: "PENDING" },
  });

  await prisma.duesInvoice.create({
    data: { userId: rohan.id, clubId: harbour.id, amount: 150000, currency: "INR", status: "PAID", method: "MANUAL", manualReference: "HQ-1044", paidAt: harbourJoined },
  });
  await prisma.duesInvoice.create({
    data: { userId: aisha.id, clubId: harbour.id, amount: 150000, currency: "INR", status: "PAID", method: "MANUAL", manualReference: "HQ-1045", paidAt: harbourJoined },
  });
  await prisma.duesInvoice.create({
    data: { userId: kabir.id, clubId: deccan.id, amount: 120000, currency: "INR", status: "UNPAID" },
  });
  await prisma.duesInvoice.create({
    data: { userId: sneha.id, clubId: capital.id, amount: 200000, currency: "INR", status: "UNPAID" },
  });

  await prisma.membershipApplication.create({
    data: {
      clubId: harbour.id,
      email: "applicant.pending@clubportal.local",
      kind: "NEW",
      token: "demo-open-application",
      status: "OPEN",
      expiresAt: daysFromNow(30),
      createdById: aisha.id,
    },
  });

  await prisma.announcement.create({
    data: { scope: "GLOBAL", authorId: superAdmin.id, title: "Welcome to the new club year", body: "Fees and election intervals are set on each club. Headquarters records manual payments from the new member page." },
  });
  await prisma.announcement.create({
    data: { scope: "CLUB", clubId: harbour.id, authorId: aisha.id, title: "Hall doors open at 18:40", body: "Please be seated before the MOC starts. Speech evaluators submit feedback only after the meeting is completed." },
  });

  console.log("Seed complete. Password for every demo account: Demo1234!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
