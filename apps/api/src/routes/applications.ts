import { Router } from "express";
import { z } from "zod";
import { assertClubAdmin, requireUser } from "../lib/access";
import { activatePaidApplication, type ApplicationForm } from "../lib/activation";
import { randomToken } from "../lib/auth";
import { addDays } from "../lib/dates";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../lib/http";
import { sendApplicationLink } from "../lib/mailer";
import { prisma } from "../lib/prisma";
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId, verifyPaymentSignature, verifyWebhookSignature } from "../lib/razorpay";

export const applicationsRouter = Router();
export const webhookRouter = Router();

const formSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().nullable(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  gender: z.string().max(40).optional().nullable(),
  address: z.string().max(240).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  occupation: z.string().max(120).optional().nullable(),
  goals: z.string().max(1000).optional().nullable(),
});

applicationsRouter.post(
  "/clubs/:clubId/applications",
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const club = await prisma.club.findUnique({ where: { id: req.params.clubId } });
    if (!club) throw new HttpError(404, "Club not found");
    await assertClubAdmin(user.id, club.id);
    const body = z.object({ email: z.string().email(), kind: z.enum(["NEW", "REINSTATE"]) }).parse(req.body);
    const email = body.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (body.kind === "REINSTATE") {
      const membership = existingUser
        ? await prisma.membership.findUnique({ where: { userId_clubId: { userId: existingUser.id, clubId: club.id } } })
        : null;
      if (!membership || membership.status === "ACTIVE") {
        throw new HttpError(400, "Reinstatement needs a former member of this club");
      }
    }
    if (body.kind === "NEW" && existingUser) {
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: existingUser.id, clubId: club.id } },
      });
      if (membership?.status === "ACTIVE") throw new HttpError(400, "This person is already an active member");
    }
    const token = randomToken();
    const application = await prisma.membershipApplication.create({
      data: {
        clubId: club.id,
        email,
        kind: body.kind,
        token,
        status: "OPEN",
        expiresAt: addDays(new Date(), 14),
        createdById: user.id,
        userId: existingUser?.id,
        formJson: existingUser
          ? {
              name: existingUser.name,
              email,
              phone: existingUser.phone,
              dateOfBirth: existingUser.dateOfBirth ? existingUser.dateOfBirth.toISOString().slice(0, 10) : null,
              gender: existingUser.gender,
              address: existingUser.address,
              city: existingUser.city,
              occupation: existingUser.occupation,
              goals: existingUser.goals,
            }
          : undefined,
      },
    });
    const url = `${process.env.WEB_ORIGIN || "http://localhost:3000"}/apply/${token}`;
    await sendApplicationLink(email, club.name, url, body.kind);
    res.status(201).json({ application: { id: application.id, email, kind: application.kind, status: application.status, expiresAt: application.expiresAt, url } });
  }),
);

applicationsRouter.get(
  "/applications/:token",
  asyncHandler(async (req, res) => {
    const application = await loadOpenApplication(req.params.token);
    res.json({
      application: {
        id: application.id,
        email: application.email,
        kind: application.kind,
        status: application.status,
        expiresAt: application.expiresAt,
        form: application.formJson,
      },
      club: {
        id: application.club.id,
        name: application.club.name,
        city: application.club.city,
        membershipFeeAmount: application.club.membershipFeeAmount,
        currency: application.club.currency,
      },
      razorpay: { configured: razorpayConfigured(), keyId: razorpayKeyId() },
    });
  }),
);

applicationsRouter.post(
  "/applications/:token/order",
  asyncHandler(async (req, res) => {
    const application = await loadOpenApplication(req.params.token);
    if (application.status !== "OPEN") throw new HttpError(400, "This application is already finished");
    const form = formSchema.parse(req.body);
    if (form.email.toLowerCase() !== application.email) {
      throw new HttpError(400, "Email must match the invitation");
    }
    const order = await createRazorpayOrder(application.club.membershipFeeAmount, application.club.currency, application.id);
    await prisma.membershipApplication.update({
      where: { id: application.id },
      data: { formJson: form satisfies ApplicationForm, razorpayOrderId: order.id },
    });
    res.json({
      orderId: order.id,
      amount: application.club.membershipFeeAmount,
      currency: application.club.currency,
      keyId: razorpayKeyId(),
    });
  }),
);

applicationsRouter.post(
  "/applications/:token/verify",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        razorpay_order_id: z.string().min(3),
        razorpay_payment_id: z.string().min(3),
        razorpay_signature: z.string().min(3),
      })
      .parse(req.body);
    const application = await prisma.membershipApplication.findUnique({
      where: { token: req.params.token },
      include: { club: true },
    });
    if (!application) throw new HttpError(404, "Application not found");
    if (application.razorpayOrderId && application.razorpayOrderId !== body.razorpay_order_id) {
      throw new HttpError(400, "Payment does not match this application");
    }
    if (!verifyPaymentSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      throw new HttpError(400, "Payment signature is invalid");
    }
    const result = await activatePaidApplication(application.id, {
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
    });
    res.json({
      active: true,
      already: result.already,
      clubName: application.club.name,
    });
  }),
);

webhookRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const raw = req.body as Buffer;
    const signature = req.get("x-razorpay-signature");
    if (!verifyWebhookSignature(raw, signature)) {
      throw new HttpError(400, "Webhook signature is invalid");
    }
    const payload = JSON.parse(raw.toString("utf8")) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } };
    };
    if (payload.event === "payment.captured") {
      const payment = payload.payload?.payment?.entity;
      if (payment?.order_id && payment.id) {
        const application = await prisma.membershipApplication.findFirst({
          where: { razorpayOrderId: payment.order_id },
        });
        if (application) {
          await activatePaidApplication(application.id, {
            razorpayOrderId: payment.order_id,
            razorpayPaymentId: payment.id,
          });
        }
      }
    }
    res.json({ ok: true });
  }),
);

async function loadOpenApplication(token: string) {
  const application = await prisma.membershipApplication.findUnique({
    where: { token },
    include: { club: true },
  });
  if (!application) throw new HttpError(404, "Application not found");
  if (application.status === "EXPIRED" || (application.status === "OPEN" && application.expiresAt < new Date())) {
    if (application.status === "OPEN") {
      await prisma.membershipApplication.update({ where: { id: application.id }, data: { status: "EXPIRED" } });
    }
    throw new HttpError(410, "This application link has expired");
  }
  return application;
}
