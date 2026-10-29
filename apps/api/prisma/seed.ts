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
      name: "Harbour Clubs Headquarters",
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
            kind: "GUIDE_FILE",
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

  type Child = {
    dateOfBirth: string;
    school: string;
    grade: string;
    gradeAtJoin: string;
    guardianName: string;
    guardianPhone: string;
    guardianEmail: string;
    secondGuardianName: string;
    secondGuardianPhone: string;
    secondGuardianEmail: string;
    consentPhoto?: boolean;
    consentParticipation?: boolean;
    consentData?: boolean;
  };
  const gradeAtJoin = new Map<string, string>();

  async function user(email: string, name: string, city: string, role: "SUPER_ADMIN" | "USER" = "USER", child?: Child) {
    const created = await prisma.user.create({
      data: {
        email,
        name,
        city,
        passwordHash,
        role,
        status: "ACTIVE",
        phone: "9800000000",
        occupation: child ? "Student" : "Professional",
        goals: "Speak with more clarity.",
        consentPhoto: child ? child.consentPhoto ?? true : true,
        consentParticipation: child ? child.consentParticipation ?? true : true,
        consentData: child ? child.consentData ?? true : true,
        ...(child
          ? {
              dateOfBirth: new Date(`${child.dateOfBirth}T00:00:00.000Z`),
              school: child.school,
              grade: child.grade,
              guardianName: child.guardianName,
              guardianPhone: child.guardianPhone,
              guardianEmail: child.guardianEmail,
              secondGuardianName: child.secondGuardianName,
              secondGuardianPhone: child.secondGuardianPhone,
              secondGuardianEmail: child.secondGuardianEmail,
            }
          : {}),
      },
    });
    if (child) gradeAtJoin.set(created.id, child.gradeAtJoin);
    return created;
  }

  const superAdmin = await user("super@clubportal.local", "HQ Admin", "Mumbai", "SUPER_ADMIN");
  const aisha = await user("admin@clubportal.local", "Aisha Kapoor", "Mumbai");
  const rohan = await user("member@clubportal.local", "Rohan Mehta", "Mumbai", "USER", {
    dateOfBirth: "2016-11-12",
    school: "Delhi Public School",
    grade: "4",
    gradeAtJoin: "2",
    guardianName: "Meera Mehta",
    guardianPhone: "9811111111",
    guardianEmail: "meera.mehta@example.com",
    secondGuardianName: "Anil Mehta",
    secondGuardianPhone: "9822222222",
    secondGuardianEmail: "anil.mehta@example.com",
    consentPhoto: false,
  });
  const neha = await user("neha.shah@clubportal.local", "Neha Shah", "Mumbai", "USER", {
    dateOfBirth: "2015-11-04",
    school: "Bombay Scottish School",
    grade: "5",
    gradeAtJoin: "3",
    guardianName: "Rekha Shah",
    guardianPhone: "9811001001",
    guardianEmail: "rekha.shah@example.com",
    secondGuardianName: "Nitin Shah",
    secondGuardianPhone: "9811001002",
    secondGuardianEmail: "nitin.shah@example.com",
  });
  const vikram = await user("vikram.iyer@clubportal.local", "Vikram Iyer", "Mumbai", "USER", {
    dateOfBirth: "2013-03-14",
    school: "Cathedral and John Connon",
    grade: "8",
    gradeAtJoin: "6",
    guardianName: "Lakshmi Iyer",
    guardianPhone: "9811002001",
    guardianEmail: "lakshmi.iyer@example.com",
    secondGuardianName: "Suresh Iyer",
    secondGuardianPhone: "9811002002",
    secondGuardianEmail: "suresh.iyer@example.com",
  });
  const sara = await user("sara.qureshi@clubportal.local", "Sara Qureshi", "Mumbai", "USER", {
    dateOfBirth: "2017-01-22",
    school: "Campion School",
    grade: "3",
    gradeAtJoin: "1",
    guardianName: "Fatima Qureshi",
    guardianPhone: "9811003001",
    guardianEmail: "fatima.qureshi@example.com",
    secondGuardianName: "Imtiaz Qureshi",
    secondGuardianPhone: "9811003002",
    secondGuardianEmail: "imtiaz.qureshi@example.com",
    consentData: false,
  });
  const leela = await user("leela.nair@clubportal.local", "Leela Nair", "Mumbai", "USER", {
    dateOfBirth: "2014-06-09",
    school: "Arya Vidya Mandir",
    grade: "6",
    gradeAtJoin: "4",
    guardianName: "Radha Nair",
    guardianPhone: "9811004001",
    guardianEmail: "radha.nair@example.com",
    secondGuardianName: "Mohan Nair",
    secondGuardianPhone: "9811004002",
    secondGuardianEmail: "mohan.nair@example.com",
  });
  const imran = await user("imran.das@clubportal.local", "Imran Das", "Mumbai", "USER", {
    dateOfBirth: "2012-09-30",
    school: "Ryan International",
    grade: "9",
    gradeAtJoin: "7",
    guardianName: "Seema Das",
    guardianPhone: "9811005001",
    guardianEmail: "seema.das@example.com",
    secondGuardianName: "Prakash Das",
    secondGuardianPhone: "9811005002",
    secondGuardianEmail: "prakash.das@example.com",
  });
  const tara = await user("tara.bose@clubportal.local", "Tara Bose", "Mumbai", "USER", {
    dateOfBirth: "2018-11-20",
    school: "Gokuldham High School",
    grade: "2",
    gradeAtJoin: "1",
    guardianName: "Anjali Bose",
    guardianPhone: "9811006001",
    guardianEmail: "anjali.bose@example.com",
    secondGuardianName: "Rajat Bose",
    secondGuardianPhone: "9811006002",
    secondGuardianEmail: "rajat.bose@example.com",
    consentParticipation: false,
  });
  const meera = await user("meera.joshi@clubportal.local", "Meera Joshi", "Pune");
  const arjun = await user("president@clubportal.local", "Arjun Deshmukh", "Pune", "USER", {
    dateOfBirth: "2010-02-11",
    school: "Vikhe Patil Memorial School",
    grade: "10",
    gradeAtJoin: "7",
    guardianName: "Sunita Deshmukh",
    guardianPhone: "9822001001",
    guardianEmail: "sunita.deshmukh@example.com",
    secondGuardianName: "Ajay Deshmukh",
    secondGuardianPhone: "9822001002",
    secondGuardianEmail: "ajay.deshmukh@example.com",
    consentPhoto: false,
  });
  const kabir = await user("kabir.rao@clubportal.local", "Kabir Rao", "Pune", "USER", {
    dateOfBirth: "2016-04-02",
    school: "Symbiosis School",
    grade: "4",
    gradeAtJoin: "1",
    guardianName: "Pooja Rao",
    guardianPhone: "9822002001",
    guardianEmail: "pooja.rao@example.com",
    secondGuardianName: "Kiran Rao",
    secondGuardianPhone: "9822002002",
    secondGuardianEmail: "kiran.rao@example.com",
  });
  const ananya = await user("ananya.kulkarni@clubportal.local", "Ananya Kulkarni", "Pune", "USER", {
    dateOfBirth: "2011-08-19",
    school: "St. Mary's School",
    grade: "9",
    gradeAtJoin: "6",
    guardianName: "Neeta Kulkarni",
    guardianPhone: "9822003001",
    guardianEmail: "neeta.kulkarni@example.com",
    secondGuardianName: "Sanjay Kulkarni",
    secondGuardianPhone: "9822003002",
    secondGuardianEmail: "sanjay.kulkarni@example.com",
  });
  const priya = await user("priya.nair@clubportal.local", "Priya Nair", "Bengaluru");
  const farhan = await user("farhan.ali@clubportal.local", "Farhan Ali", "Bengaluru", "USER", {
    dateOfBirth: "2015-07-21",
    school: "National Public School",
    grade: "5",
    gradeAtJoin: "5",
    guardianName: "Nazia Ali",
    guardianPhone: "9845001001",
    guardianEmail: "nazia.ali@example.com",
    secondGuardianName: "Sameer Ali",
    secondGuardianPhone: "9845001002",
    secondGuardianEmail: "sameer.ali@example.com",
  });
  const diya = await user("diya.menon@clubportal.local", "Diya Menon", "Bengaluru", "USER", {
    dateOfBirth: "2014-11-08",
    school: "Bishop Cotton Girls' School",
    grade: "6",
    gradeAtJoin: "6",
    guardianName: "Deepa Menon",
    guardianPhone: "9845002001",
    guardianEmail: "deepa.menon@example.com",
    secondGuardianName: "Arun Menon",
    secondGuardianPhone: "9845002002",
    secondGuardianEmail: "arun.menon@example.com",
    consentData: false,
  });
  const rahul = await user("rahul.verma@clubportal.local", "Rahul Verma", "New Delhi");
  const sneha = await user("sneha.iyer@clubportal.local", "Sneha Iyer", "New Delhi", "USER", {
    dateOfBirth: "2013-12-16",
    school: "Springdales School",
    grade: "7",
    gradeAtJoin: "3",
    guardianName: "Kavita Iyer",
    guardianPhone: "9818001001",
    guardianEmail: "kavita.iyer@example.com",
    secondGuardianName: "Ramesh Iyer",
    secondGuardianPhone: "9818001002",
    secondGuardianEmail: "ramesh.iyer@example.com",
  });
  const omar = await user("omar.sheikh@clubportal.local", "Omar Sheikh", "New Delhi", "USER", {
    dateOfBirth: "2012-05-27",
    school: "Modern School",
    grade: "8",
    gradeAtJoin: "4",
    guardianName: "Amina Sheikh",
    guardianPhone: "9818002001",
    guardianEmail: "amina.sheikh@example.com",
    secondGuardianName: "Yusuf Sheikh",
    secondGuardianPhone: "9818002002",
    secondGuardianEmail: "yusuf.sheikh@example.com",
  });
  const lakshmi = await user("lakshmi.rao@clubportal.local", "Lakshmi Rao", "Chennai");
  const hari = await user("hari.menon@clubportal.local", "Hari Menon", "Chennai", "USER", {
    dateOfBirth: "2011-01-09",
    school: "Padma Seshadri Bala Bhavan",
    grade: "9",
    gradeAtJoin: "4",
    guardianName: "Geeta Menon",
    guardianPhone: "9840001001",
    guardianEmail: "geeta.menon@example.com",
    secondGuardianName: "Vijay Menon",
    secondGuardianPhone: "9840001002",
    secondGuardianEmail: "vijay.menon@example.com",
  });

  async function join(person: { id: string }, clubId: string, joinedAt: Date) {
    await prisma.membership.create({
      data: { userId: person.id, clubId, status: "ACTIVE", joinedAt, gradeAtJoin: gradeAtJoin.get(person.id) ?? null },
    });
  }

  const harbourJoined = new Date("2024-02-01T00:00:00.000Z");
  for (const member of [aisha, rohan, neha, vikram, sara, leela, imran, tara]) {
    await join(member, harbour.id, harbourJoined);
  }
  for (const member of [meera, arjun, kabir, ananya]) await join(member, deccan.id, new Date("2023-07-01T00:00:00.000Z"));
  for (const member of [priya, farhan, diya]) await join(member, garden.id, new Date("2025-11-15T00:00:00.000Z"));
  for (const member of [rahul, sneha, omar]) await join(member, capital.id, new Date("2022-10-01T00:00:00.000Z"));
  for (const member of [lakshmi, hari]) await join(member, coastal.id, new Date("2021-05-01T00:00:00.000Z"));

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
