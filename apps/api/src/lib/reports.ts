import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "./prisma";

const CLUB_STATUSES = ["ACTIVE", "INACTIVE", "PROVISIONAL"] as const;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function recentMonths(count = 12) {
  const since = new Date();
  since.setMonth(since.getMonth() - (count - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const cursor = new Date(since);
    cursor.setMonth(since.getMonth() + i);
    keys.push(monthKey(cursor));
  }
  return { since, keys };
}

function fillMonths(keys: string[], counts: Map<string, number>, field: string) {
  return keys.map((month) => ({ month, [field]: counts.get(month) || 0 }));
}

export async function growthReport() {
  const { since, keys } = recentMonths();
  const rows = await prisma.membership.findMany({
    where: { joinedAt: { gte: since } },
    select: { joinedAt: true },
  });
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const key = monthKey(row.joinedAt);
    if (keys.includes(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return fillMonths(keys, buckets, "joined") as { month: string; joined: number }[];
}

export async function overviewReport() {
  const { since, keys } = recentMonths();
  const [
    clubRows,
    memberships,
    meetings,
    paid,
    invoiceCounts,
    membershipCounts,
    attendance,
    invoices,
    completedMeetings,
  ] = await Promise.all([
    prisma.club.findMany({ select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
    prisma.membership.findMany({ select: { clubId: true, status: true, joinedAt: true } }),
    prisma.meeting.findMany({
      where: { status: "COMPLETED", meetingDate: { gte: since } },
      select: { meetingDate: true },
    }),
    prisma.duesInvoice.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
    Promise.all([
      prisma.duesInvoice.count({ where: { status: "PAID" } }),
      prisma.duesInvoice.count({ where: { status: "UNPAID" } }),
      prisma.duesInvoice.count({ where: { status: "WAIVED" } }),
    ]),
    Promise.all([
      prisma.membership.count({ where: { status: "ACTIVE" } }),
      prisma.membership.count({ where: { status: "LAPSED" } }),
      prisma.membership.count({ where: { status: "EXPIRED" } }),
      prisma.membership.count({ where: { status: "REMOVED" } }),
    ]),
    prisma.attendance.findMany({
      where: { meeting: { status: "COMPLETED" } },
      select: { present: true, meeting: { select: { clubId: true } } },
    }),
    prisma.duesInvoice.findMany({ select: { clubId: true, status: true } }),
    prisma.meeting.count({ where: { status: "COMPLETED" } }),
  ]);

  const meetingBuckets = new Map<string, number>();
  for (const meeting of meetings) {
    const key = monthKey(meeting.meetingDate);
    if (keys.includes(key)) meetingBuckets.set(key, (meetingBuckets.get(key) || 0) + 1);
  }

  const [paidCount, unpaidCount, waivedCount] = invoiceCounts;
  const [activeMembers, lapsed, expired, removed] = membershipCounts;
  const former = lapsed + expired + removed;
  const retentionBase = activeMembers + former;
  const duesBase = paidCount + unpaidCount;

  const clubStatus = CLUB_STATUSES.map((status) => ({
    status,
    count: clubRows.filter((club) => club.status === status).length,
  }));

  const clubComparison = clubRows.map((club) => {
    const rows = memberships.filter((row) => row.clubId === club.id);
    const clubAttendance = attendance.filter((row) => row.meeting.clubId === club.id);
    const present = clubAttendance.filter((row) => row.present).length;
    const clubInvoices = invoices.filter((row) => row.clubId === club.id);
    const paidInvoices = clubInvoices.filter((row) => row.status === "PAID").length;
    const unpaidInvoices = clubInvoices.filter((row) => row.status === "UNPAID").length;
    const ratioBase = paidInvoices + unpaidInvoices;
    return {
      id: club.id,
      name: club.name,
      members: rows.filter((row) => row.status === "ACTIVE").length,
      attendanceAverage: clubAttendance.length ? present / clubAttendance.length : 0,
      duesPaidRatio: ratioBase ? paidInvoices / ratioBase : 0,
      growth: rows.filter((row) => row.joinedAt >= since).length,
    };
  });

  return {
    clubs: clubRows.length,
    activeMemberships: activeMembers,
    completedMeetings,
    paidInvoices: paid._count,
    duesCollectedMinor: paid._sum.amount || 0,
    memberGrowth: fillMonths(
      keys,
      memberships.reduce((buckets, row) => {
        if (row.joinedAt < since) return buckets;
        const key = monthKey(row.joinedAt);
        if (keys.includes(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
        return buckets;
      }, new Map<string, number>()),
      "joined",
    ) as { month: string; joined: number }[],
    clubStatus,
    meetingActivity: fillMonths(keys, meetingBuckets, "meetings") as { month: string; meetings: number }[],
    retention: {
      active: activeMembers,
      former,
      rate: retentionBase ? activeMembers / retentionBase : 0,
    },
    dues: {
      paid: paidCount,
      unpaid: unpaidCount,
      waived: waivedCount,
      paidRatio: duesBase ? paidCount / duesBase : 0,
    },
    clubComparison,
  };
}

export async function clubHealth(clubId: string) {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) return null;
  const [activeMembers, meetings, attendance, invoices] = await Promise.all([
    prisma.membership.count({ where: { clubId, status: "ACTIVE" } }),
    prisma.meeting.findMany({ where: { clubId, status: "COMPLETED" }, select: { id: true } }),
    prisma.attendance.findMany({
      where: { meeting: { clubId, status: "COMPLETED" } },
      select: { present: true },
    }),
    prisma.duesInvoice.groupBy({
      by: ["status"],
      where: { clubId },
      _count: true,
      _sum: { amount: true },
    }),
  ]);
  const present = attendance.filter((row) => row.present).length;
  const paid = invoices.find((row) => row.status === "PAID");
  const unpaid = invoices.find((row) => row.status === "UNPAID");
  return {
    club: { id: club.id, name: club.name, city: club.city, status: club.status },
    activeMembers,
    completedMeetings: meetings.length,
    attendanceRate: attendance.length ? present / attendance.length : 0,
    paidInvoices: paid?._count || 0,
    unpaidInvoices: unpaid?._count || 0,
    duesCollectedMinor: paid?._sum.amount || 0,
  };
}

export function overviewPdfLines(report: Awaited<ReturnType<typeof overviewReport>>) {
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return [
    `Clubs: ${report.clubs}`,
    `Active memberships: ${report.activeMemberships}`,
    `Completed meetings: ${report.completedMeetings}`,
    `Paid invoices: ${report.paidInvoices}`,
    `Dues collected (minor units): ${report.duesCollectedMinor}`,
    `Club status: ${report.clubStatus.map((row) => `${row.status} ${row.count}`).join(", ")}`,
    `Retention: ${percent(report.retention.rate)} (${report.retention.active} active, ${report.retention.former} former)`,
    `Dues: ${report.dues.paid} paid, ${report.dues.unpaid} unpaid, ${report.dues.waived} waived (${percent(report.dues.paidRatio)} paid)`,
    "Member growth:",
    ...report.memberGrowth.map((row) => `${row.month}: ${row.joined} joined`),
    "Meeting activity:",
    ...report.meetingActivity.map((row) => `${row.month}: ${row.meetings} completed`),
    "Clubs:",
    ...report.clubComparison.map(
      (row) =>
        `${row.name}: ${row.members} members, attendance ${percent(row.attendanceAverage)}, dues paid ${percent(row.duesPaidRatio)}, growth ${row.growth}`,
    ),
  ];
}

export function pdfBuffer(title: string, lines: string[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fillColor("#1e3a5f").fontSize(22).text(title);
    doc.moveDown(0.4);
    doc.fillColor("#1c1915").fontSize(11);
    for (const line of lines) doc.text(line).moveDown(0.2);
    doc.end();
  });
}

export async function workbookBuffer(sheetName: string, columns: { header: string; key: string }[], rows: Record<string, string | number>[]) {
  return workbookSheets([{ name: sheetName, columns, rows }]);
}

export async function workbookSheets(sheets: { name: string; columns: { header: string; key: string }[]; rows: Record<string, string | number>[] }[]) {
  const workbook = new ExcelJS.Workbook();
  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(spec.name.slice(0, 31));
    sheet.columns = spec.columns.map((column) => ({ header: column.header, key: column.key, width: 28 }));
    sheet.addRows(spec.rows);
  }
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}

export function overviewWorkbook(report: Awaited<ReturnType<typeof overviewReport>>) {
  const percent = (value: number) => Number((value * 100).toFixed(1));
  return workbookSheets([
    {
      name: "Overview",
      columns: [
        { header: "Metric", key: "metric" },
        { header: "Value", key: "value" },
      ],
      rows: [
        { metric: "Clubs", value: report.clubs },
        { metric: "Active memberships", value: report.activeMemberships },
        { metric: "Completed meetings", value: report.completedMeetings },
        { metric: "Paid invoices", value: report.paidInvoices },
        { metric: "Unpaid invoices", value: report.dues.unpaid },
        { metric: "Waived invoices", value: report.dues.waived },
        { metric: "Dues collected minor", value: report.duesCollectedMinor },
        { metric: "Retention percent", value: percent(report.retention.rate) },
        { metric: "Dues paid percent", value: percent(report.dues.paidRatio) },
      ],
    },
    {
      name: "Member growth",
      columns: [
        { header: "Month", key: "month" },
        { header: "Joined", key: "joined" },
      ],
      rows: report.memberGrowth,
    },
    {
      name: "Club status",
      columns: [
        { header: "Status", key: "status" },
        { header: "Clubs", key: "count" },
      ],
      rows: report.clubStatus,
    },
    {
      name: "Meetings",
      columns: [
        { header: "Month", key: "month" },
        { header: "Completed", key: "meetings" },
      ],
      rows: report.meetingActivity,
    },
    {
      name: "Clubs",
      columns: [
        { header: "Club", key: "name" },
        { header: "Members", key: "members" },
        { header: "Attendance %", key: "attendance" },
        { header: "Dues paid %", key: "dues" },
        { header: "Growth", key: "growth" },
      ],
      rows: report.clubComparison.map((row) => ({
        name: row.name,
        members: row.members,
        attendance: percent(row.attendanceAverage),
        dues: percent(row.duesPaidRatio),
        growth: row.growth,
      })),
    },
  ]);
}
