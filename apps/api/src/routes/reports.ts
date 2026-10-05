import { Router } from "express";
import { requireSuperAdmin } from "../lib/access";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../lib/http";
import { clubHealth, growthReport, overviewPdfLines, overviewReport, overviewWorkbook, pdfBuffer, workbookBuffer } from "../lib/reports";
import type { Response } from "express";

export const reportsRouter = Router();

reportsRouter.use((req, res, next) => {
  try {
    requireSuperAdmin(req);
    next();
  } catch (error) {
    next(error);
  }
});

reportsRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    res.json(await overviewReport());
  }),
);

reportsRouter.get(
  "/growth",
  asyncHandler(async (_req, res) => {
    res.json({ months: await growthReport() });
  }),
);

reportsRouter.get(
  "/clubs/:id/health",
  asyncHandler(async (req, res) => {
    const health = await clubHealth(req.params.id);
    if (!health) throw new HttpError(404, "Club not found");
    res.json(health);
  }),
);

reportsRouter.get(
  "/overview.pdf",
  asyncHandler(async (_req, res) => {
    const report = await overviewReport();
    const buffer = await pdfBuffer("Organization overview", overviewPdfLines(report));
    sendPdf(res, "overview.pdf", buffer);
  }),
);

reportsRouter.get(
  "/overview.xlsx",
  asyncHandler(async (_req, res) => {
    const report = await overviewReport();
    const buffer = await overviewWorkbook(report);
    sendXlsx(res, "overview.xlsx", buffer);
  }),
);

reportsRouter.get(
  "/clubs/:id/health.pdf",
  asyncHandler(async (req, res) => {
    const health = await clubHealth(req.params.id);
    if (!health) throw new HttpError(404, "Club not found");
    const buffer = await pdfBuffer(`${health.club.name} health`, [
      `City: ${health.club.city}`,
      `Status: ${health.club.status}`,
      `Active members: ${health.activeMembers}`,
      `Completed meetings: ${health.completedMeetings}`,
      `Attendance rate: ${Math.round(health.attendanceRate * 100)}%`,
      `Paid invoices: ${health.paidInvoices}`,
      `Unpaid invoices: ${health.unpaidInvoices}`,
      `Dues collected (minor units): ${health.duesCollectedMinor}`,
    ]);
    sendPdf(res, `${health.club.name}-health.pdf`, buffer);
  }),
);

reportsRouter.get(
  "/clubs/:id/health.xlsx",
  asyncHandler(async (req, res) => {
    const health = await clubHealth(req.params.id);
    if (!health) throw new HttpError(404, "Club not found");
    const buffer = await workbookBuffer(
      "Health",
      [
        { header: "Metric", key: "metric" },
        { header: "Value", key: "value" },
      ],
      [
        { metric: "Club", value: health.club.name },
        { metric: "Active members", value: health.activeMembers },
        { metric: "Completed meetings", value: health.completedMeetings },
        { metric: "Attendance rate", value: Number(health.attendanceRate.toFixed(4)) },
        { metric: "Paid invoices", value: health.paidInvoices },
        { metric: "Unpaid invoices", value: health.unpaidInvoices },
        { metric: "Dues collected minor", value: health.duesCollectedMinor },
      ],
    );
    sendXlsx(res, `${health.club.name}-health.xlsx`, buffer);
  }),
);

function sendPdf(res: Response, name: string, buffer: Buffer) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(buffer);
}

function sendXlsx(res: Response, name: string, buffer: Buffer) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(buffer);
}
