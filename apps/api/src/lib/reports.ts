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

export type ReportRange = { from: Date; to: Date };

/** Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD, defaulting to the last 12 months ending today. */
export function parseRange(query: Record<string, unknown>): ReportRange {
  const parse = (value: unknown) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const toRaw = parse(query.to);
  const to = toRaw ? new Date(toRaw.getTime() + 86400000 - 1) : new Date();
  const fromRaw = parse(query.from);
  let from: Date;
  if (fromRaw) {
    from = fromRaw;
  } else {
    from = new Date(to);
    from.setMonth(from.getMonth() - 11);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }
  if (from > to) return { from: to, to: from };
  return { from, to };
}

/**
 * Bucket a date range into labelled periods. Weeks for ranges up to ~4 months,
 * months beyond that, so a 30-day window still produces a readable chart.
 */
function rangeBuckets(range: ReportRange) {
  const days = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86400000));
  const weekly = days <= 125;
  const buckets: { key: string; label: string; start: Date; end: Date }[] = [];
  if (weekly) {
    const cursor = new Date(range.from);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= range.to) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + 7);
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label: start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        start,
        end,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
    while (cursor <= range.to) {
      const start = new Date(cursor);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      buckets.push({
        key: monthKey(start),
        label: start.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        start,
        end,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return { buckets, weekly };
}

function countInto(buckets: { key: string; start: Date; end: Date }[], dates: Date[]) {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const bucket = buckets.find((row) => date >= row.start && date < row.end);
    if (bucket) counts.set(bucket.key, (counts.get(bucket.key) || 0) + 1);
  }
  return counts;
}

export async function overviewReport(range: ReportRange = parseRange({})) {
  const { buckets, weekly } = rangeBuckets(range);
  const since = range.from;
  const until = range.to;
  const engagementSince = new Date(until.getTime() - 30 * 86400000);
  const [
    clubRows,
    memberships,
    meetings,
    paidInRange,
    invoiceCounts,
    membershipCounts,
    attendance,
    invoices,
    completedMeetings,
    recentAttendance,
    duesTotals,
  ] = await Promise.all([
    prisma.club.findMany({ select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
    prisma.membership.findMany({ select: { clubId: true, userId: true, status: true, joinedAt: true } }),
    prisma.meeting.findMany({
      where: { status: "COMPLETED", meetingDate: { gte: since, lte: until } },
      select: { meetingDate: true, clubId: true },
    }),
    prisma.duesInvoice.aggregate({ where: { status: "PAID", paidAt: { gte: since, lte: until } }, _sum: { amount: true }, _count: true }),
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
      where: { meeting: { status: "COMPLETED", meetingDate: { gte: since, lte: until } } },
      select: { present: true, meeting: { select: { clubId: true } } },
    }),
    prisma.duesInvoice.findMany({ select: { clubId: true, status: true, amount: true } }),
    prisma.meeting.count({ where: { status: "COMPLETED", meetingDate: { gte: since, lte: until } } }),
    prisma.attendance.findMany({
      where: { present: true, meeting: { status: "COMPLETED", meetingDate: { gte: engagementSince, lte: until } } },
      select: { userId: true, meeting: { select: { clubId: true } } },
    }),
    Promise.all([
      prisma.duesInvoice.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
      prisma.duesInvoice.aggregate({ where: { status: "UNPAID" }, _sum: { amount: true }, _count: true }),
    ]),
  ]);

  const [paidCount, unpaidCount, waivedCount] = invoiceCounts;
  const [activeMembers, lapsed, expired, removed] = membershipCounts;
  const former = lapsed + expired + removed;
  const retentionBase = activeMembers + former;
  const duesBase = paidCount + unpaidCount;

  const clubStatus = CLUB_STATUSES.map((status) => ({
    status,
    count: clubRows.filter((club) => club.status === status).length,
  }));

  // Engagement: active members who were present at least once in the 30 days before the range end.
  const engagedKeys = new Set(recentAttendance.map((row) => `${row.meeting.clubId}:${row.userId}`));
  const activeRows = memberships.filter((row) => row.status === "ACTIVE");
  const engaged = activeRows.filter((row) => engagedKeys.has(`${row.clubId}:${row.userId}`)).length;

  const clubComparison = clubRows.map((club) => {
    const rows = memberships.filter((row) => row.clubId === club.id);
    const clubActive = rows.filter((row) => row.status === "ACTIVE");
    const clubAttendance = attendance.filter((row) => row.meeting.clubId === club.id);
    const present = clubAttendance.filter((row) => row.present).length;
    const clubInvoices = invoices.filter((row) => row.clubId === club.id);
    const paidInvoices = clubInvoices.filter((row) => row.status === "PAID").length;
    const unpaidInvoices = clubInvoices.filter((row) => row.status === "UNPAID").length;
    const ratioBase = paidInvoices + unpaidInvoices;
    return {
      id: club.id,
      name: club.name,
      status: club.status,
      members: clubActive.length,
      attendanceAverage: clubAttendance.length ? present / clubAttendance.length : 0,
      duesPaidRatio: ratioBase ? paidInvoices / ratioBase : 0,
      growth: rows.filter((row) => row.joinedAt >= since && row.joinedAt <= until).length,
      meetings: meetings.filter((row) => row.clubId === club.id).length,
      engaged: clubActive.filter((row) => engagedKeys.has(`${club.id}:${row.userId}`)).length,
      outstandingMinor: clubInvoices.filter((row) => row.status === "UNPAID").reduce((sum, row) => sum + row.amount, 0),
    };
  });

  const byAttendance = [...clubComparison].filter((row) => row.meetings > 0).sort((a, b) => b.attendanceAverage - a.attendanceAverage).slice(0, 3);
  const byGrowth = [...clubComparison].sort((a, b) => b.growth - a.growth || b.members - a.members).slice(0, 3);

  const joinedDates = memberships.filter((row) => row.joinedAt >= since && row.joinedAt <= until).map((row) => row.joinedAt);
  const growthCounts = countInto(buckets, joinedDates);
  const meetingCounts = countInto(buckets, meetings.map((row) => row.meetingDate));

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString(), granularity: weekly ? "week" : "month" },
    clubs: clubRows.length,
    activeMemberships: activeMembers,
    activeMembers,
    completedMeetings,
    paidInvoices: paidInRange._count,
    duesCollectedMinor: paidInRange._sum.amount || 0,
    memberGrowth: buckets.map((bucket) => ({ month: bucket.label, joined: growthCounts.get(bucket.key) || 0 })),
    clubStatus,
    meetingActivity: buckets.map((bucket) => ({ month: bucket.label, meetings: meetingCounts.get(bucket.key) || 0 })),
    retention: {
      active: activeMembers,
      former,
      rate: retentionBase ? activeMembers / retentionBase : 0,
    },
    engagement: {
      engaged,
      idle: Math.max(activeMembers - engaged, 0),
      rate: activeMembers ? engaged / activeMembers : 0,
      windowDays: 30,
    },
    dues: {
      paid: paidCount,
      unpaid: unpaidCount,
      waived: waivedCount,
      paidRatio: duesBase ? paidCount / duesBase : 0,
      collectedMinor: duesTotals[0]._sum.amount || 0,
      outstandingMinor: duesTotals[1]._sum.amount || 0,
      outstandingCount: duesTotals[1]._count,
    },
    topClubs: { byAttendance, byGrowth },
    clubComparison,
  };
}

/** Clubs with unpaid invoices, each with the members who owe and the current Club Admin. */
export async function unpaidByClub() {
  const invoices = await prisma.duesInvoice.findMany({
    where: { status: "UNPAID" },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      club: { select: { id: true, name: true, city: true, status: true, currency: true, admins: { where: { endedAt: null }, include: { user: { select: { id: true, name: true, email: true, phone: true } } } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, {
    clubId: string;
    name: string;
    city: string;
    status: string;
    currency: string;
    outstandingMinor: number;
    admin: { id: string; name: string; email: string; phone: string | null } | null;
    members: { invoiceId: string; userId: string; name: string; email: string; phone: string | null; amount: number; createdAt: Date }[];
  }>();
  for (const row of invoices) {
    const group = groups.get(row.clubId) || {
      clubId: row.clubId,
      name: row.club.name,
      city: row.club.city,
      status: row.club.status,
      currency: row.club.currency,
      outstandingMinor: 0,
      admin: row.club.admins[0]?.user || null,
      members: [],
    };
    group.outstandingMinor += row.amount;
    group.members.push({ invoiceId: row.id, userId: row.user.id, name: row.user.name, email: row.user.email, phone: row.user.phone, amount: row.amount, createdAt: row.createdAt });
    groups.set(row.clubId, group);
  }
  return [...groups.values()].sort((a, b) => b.outstandingMinor - a.outstandingMinor);
}

/** System-wide activity: audit log entries plus derived membership expiries, newest first. */
export async function activityFeed(limit = 40) {
  const [logs, expiries] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { name: true } } },
    }),
    prisma.membership.findMany({
      where: { status: { in: ["EXPIRED", "LAPSED"] } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      include: { user: { select: { name: true } }, club: { select: { id: true, name: true } } },
    }),
  ]);
  const clubIds = new Set<string>();
  const meetingIds = new Set<string>();
  const userIds = new Set<string>();
  for (const log of logs) {
    if (!log.entityId) continue;
    if (log.entityType === "Club") clubIds.add(log.entityId);
    if (log.entityType === "Meeting") meetingIds.add(log.entityId);
    if (log.entityType === "User") userIds.add(log.entityId);
  }
  const [clubs, meetings, users] = await Promise.all([
    prisma.club.findMany({ where: { id: { in: [...clubIds] } }, select: { id: true, name: true } }),
    prisma.meeting.findMany({ where: { id: { in: [...meetingIds] } }, select: { id: true, title: true, club: { select: { id: true, name: true } } } }),
    prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } }),
  ]);
  const clubName = new Map(clubs.map((row) => [row.id, row.name]));
  const meetingInfo = new Map(meetings.map((row) => [row.id, row]));
  const userName = new Map(users.map((row) => [row.id, row.name]));

  const labels: Record<string, string> = {
    "club.create": "New club registered",
    "club.update": "Club profile updated",
    "club.billing": "Club fee or election cycle changed",
    "club.delete": "Club deleted",
    "club.admin_appoint": "Club Admin appointed",
    "club.admin_reset_password": "Club Admin password reset sent",
    "club.officers_assign": "Committee updated",
    "club.note": "HQ note added",
    "meeting.finalize": "Meeting finalized",
    "meeting.cancel": "Meeting cancelled",
    "membership.reinstate_link": "Reinstatement link sent",
    "member.manual_create": "Member profile created by HQ",
    "user.update": "Member profile updated",
    "user.delete": "Account permanently deleted",
    "user.freeze": "Account frozen",
    "user.reinstate": "Account reinstated",
    "announcement.create": "Announcement sent",
    "settings.update": "Organization settings updated",
    "curriculum.publish": "Curriculum published",
    "curriculum.rollback": "Curriculum restored",
    "removal.request": "Removal requested",
  };

  const items = logs.map((log) => {
    const snapshot = (log.snapshot || {}) as Record<string, unknown>;
    let subject: string | null = null;
    let href: string | null = null;
    if (log.entityType === "Club" && log.entityId) {
      subject = clubName.get(log.entityId) || (typeof snapshot.name === "string" ? snapshot.name : null);
      href = clubName.has(log.entityId) ? `/hq/clubs/${log.entityId}` : null;
    } else if (log.entityType === "Meeting" && log.entityId) {
      const meeting = meetingInfo.get(log.entityId);
      subject = meeting ? `${meeting.title} · ${meeting.club.name}` : null;
      href = meeting ? `/hq/clubs/${meeting.club.id}/meetings` : null;
    } else if (log.entityType === "User" && log.entityId) {
      subject = userName.get(log.entityId) || null;
      href = userName.has(log.entityId) ? `/members/${log.entityId}` : null;
    } else if (log.entityType === "ClubAdmin" && typeof snapshot.clubId === "string") {
      href = `/hq/clubs/${snapshot.clubId}`;
    }
    return {
      id: log.id,
      at: log.createdAt,
      kind: log.action,
      title: labels[log.action] || log.action,
      subject,
      actor: log.actor?.name || "System",
      href,
    };
  });
  for (const row of expiries) {
    items.push({
      id: `exp-${row.id}`,
      at: row.updatedAt,
      kind: `membership.${row.status.toLowerCase()}`,
      title: row.status === "EXPIRED" ? "Membership expired" : "Membership lapsed",
      subject: `${row.user.name} · ${row.club.name}`,
      actor: "System",
      href: `/hq/clubs/${row.club.id}`,
    });
  }
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** Detailed rows behind each overview stat card. */
export async function drilldown(kind: string, range: ReportRange) {
  if (kind === "clubs") {
    const clubs = await prisma.club.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { memberships: { where: { status: "ACTIVE" } } } } },
    });
    return clubs.map((club) => ({ id: club.id, title: club.name, subtitle: `${club.city} · ${club.status}`, value: `${club._count.memberships} active`, href: `/hq/clubs/${club.id}` }));
  }
  if (kind === "members") {
    const rows = await prisma.membership.findMany({
      where: { status: "ACTIVE" },
      include: { user: { select: { id: true, name: true, email: true } }, club: { select: { name: true } } },
      orderBy: { joinedAt: "desc" },
    });
    return rows.map((row) => ({ id: row.id, title: row.user.name, subtitle: `${row.club.name} · ${row.user.email}`, value: `joined ${row.joinedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, href: `/members/${row.user.id}` }));
  }
  if (kind === "meetings") {
    const rows = await prisma.meeting.findMany({
      where: { status: "COMPLETED", meetingDate: { gte: range.from, lte: range.to } },
      include: { club: { select: { id: true, name: true } }, attendance: { select: { present: true } } },
      orderBy: { meetingDate: "desc" },
    });
    return rows.map((row) => ({ id: row.id, title: row.title, subtitle: `${row.club.name} · ${row.meetingDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, value: `${row.attendance.filter((item) => item.present).length} present`, href: `/hq/clubs/${row.club.id}/meetings` }));
  }
  if (kind === "dues") {
    const rows = await prisma.duesInvoice.findMany({
      where: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
      include: { user: { select: { name: true } }, club: { select: { id: true, name: true, currency: true } } },
      orderBy: { paidAt: "desc" },
    });
    return rows.map((row) => ({ id: row.id, title: row.user.name, subtitle: `${row.club.name}${row.paidAt ? ` · ${row.paidAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}${row.method ? ` · ${row.method}` : ""}`, value: row.amount, currency: row.club.currency, href: `/hq/clubs/${row.club.id}` }));
  }
  return [];
}

export async function clubHealth(clubId: string) {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) return null;
  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const [activeMembers, meetings, attendance, invoices, totalMembers, meetingsThisQuarter] = await Promise.all([
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
    prisma.membership.count({ where: { clubId } }),
    prisma.meeting.count({ where: { clubId, status: "COMPLETED", meetingDate: { gte: quarterStart } } }),
  ]);
  const present = attendance.filter((row) => row.present).length;
  const paid = invoices.find((row) => row.status === "PAID");
  const unpaid = invoices.find((row) => row.status === "UNPAID");
  return {
    club: { id: club.id, name: club.name, city: club.city, status: club.status },
    activeMembers,
    totalMembers,
    completedMeetings: meetings.length,
    meetingsThisQuarter,
    attendanceRate: attendance.length ? present / attendance.length : 0,
    paidInvoices: paid?._count || 0,
    unpaidInvoices: unpaid?._count || 0,
    duesCollectedMinor: paid?._sum.amount || 0,
    duesOutstandingMinor: unpaid?._sum.amount || 0,
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
