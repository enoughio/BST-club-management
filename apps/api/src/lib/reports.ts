import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "./prisma";

export async function overviewReport() {
  const [clubs, members, meetings, paid] = await Promise.all([
    prisma.club.count(),
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.meeting.count({ where: { status: "COMPLETED" } }),
    prisma.duesInvoice.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
  ]);
  return {
    clubs,
    activeMemberships: members,
    completedMeetings: meetings,
    paidInvoices: paid._count,
    duesCollectedMinor: paid._sum.amount || 0,
  };
}

export async function growthReport() {
  const since = new Date();
  since.setMonth(since.getMonth() - 11);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const rows = await prisma.membership.findMany({
    where: { joinedAt: { gte: since } },
    select: { joinedAt: true },
  });
  const buckets = new Map<string, number>();
  for (let i = 0; i < 12; i += 1) {
    const cursor = new Date(since);
    cursor.setMonth(since.getMonth() + i);
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, 0);
  }
  for (const row of rows) {
    const key = `${row.joinedAt.getFullYear()}-${String(row.joinedAt.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()].map(([month, joined]) => ({ month, joined }));
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
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: 28 }));
  sheet.addRows(rows);
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
