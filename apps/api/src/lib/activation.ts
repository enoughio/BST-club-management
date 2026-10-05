import type { Prisma } from "@prisma/client";
import { HttpError } from "./errors";
import { sendSetPassword } from "./mailer";
import { createAuthToken } from "./auth";
import { notifyUser } from "./notify";
import { prisma } from "./prisma";

export type ApplicationForm = {
  name: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  occupation?: string | null;
  goals?: string | null;
};

type PaymentInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
};

export async function activatePaidApplication(applicationId: string, payment: PaymentInput) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.membershipApplication.findUnique({
      where: { id: applicationId },
      include: { club: true },
    });
    if (!existing) throw new HttpError(404, "Application not found");
    if (existing.status === "COMPLETED") {
      const invoice = await tx.duesInvoice.findFirst({
        where: { applicationId: existing.id, status: "PAID" },
      });
      return { already: true as const, application: existing, invoice, userId: existing.userId, created: false };
    }
    if (existing.status !== "OPEN") throw new HttpError(400, "Application is not open");
    if (existing.expiresAt < new Date()) throw new HttpError(400, "Application link has expired");

    const locked = await tx.membershipApplication.updateMany({
      where: { id: existing.id, status: "OPEN" },
      data: { status: "COMPLETED", razorpayOrderId: payment.razorpayOrderId },
    });
    if (locked.count === 0) {
      const again = await tx.membershipApplication.findUnique({ where: { id: existing.id }, include: { club: true } });
      return { already: true as const, application: again!, invoice: null, userId: again?.userId ?? null, created: false };
    }

    const form = (existing.formJson || {}) as Partial<ApplicationForm>;
    if (!form.name) throw new HttpError(400, "Complete the membership form before paying");
    const email = existing.email.toLowerCase();
    const profile: Prisma.UserUpdateInput = {
      name: form.name,
      phone: form.phone || null,
      gender: form.gender || null,
      address: form.address || null,
      city: form.city || null,
      occupation: form.occupation || null,
      goals: form.goals || null,
      dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : null,
    };

    let user = await tx.user.findUnique({ where: { email } });
    let created = false;
    if (!user) {
      user = await tx.user.create({
        data: {
          email,
          name: form.name,
          phone: form.phone || null,
          gender: form.gender || null,
          address: form.address || null,
          city: form.city || null,
          occupation: form.occupation || null,
          goals: form.goals || null,
          dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : null,
          role: "USER",
          status: "INVITED",
        },
      });
      created = true;
    } else {
      user = await tx.user.update({ where: { id: user.id }, data: profile });
    }

    await tx.membership.upsert({
      where: { userId_clubId: { userId: user.id, clubId: existing.clubId } },
      create: { userId: user.id, clubId: existing.clubId, status: "ACTIVE", joinedAt: new Date(), endedAt: null },
      update: { status: "ACTIVE", endedAt: null },
    });

    const duplicateInvoice = await tx.duesInvoice.findFirst({
      where: { razorpayOrderId: payment.razorpayOrderId, status: "PAID" },
    });
    const invoice =
      duplicateInvoice ||
      (await tx.duesInvoice.create({
        data: {
          userId: user.id,
          clubId: existing.clubId,
          amount: existing.club.membershipFeeAmount,
          currency: existing.club.currency,
          status: "PAID",
          method: "RAZORPAY",
          razorpayOrderId: payment.razorpayOrderId,
          razorpayPaymentId: payment.razorpayPaymentId,
          paidAt: new Date(),
          applicationId: existing.id,
        },
      }));

    await tx.membershipApplication.update({
      where: { id: existing.id },
      data: { userId: user.id },
    });

    return { already: false as const, application: existing, invoice, userId: user.id, created, needsPassword: !user.passwordHash, name: user.name, email: user.email };
  });

  if (!result.already && result.userId && "needsPassword" in result && result.needsPassword) {
    const token = await createAuthToken(result.userId, "INVITE", 7);
    const url = `${process.env.WEB_ORIGIN || "http://localhost:3000"}/accept-invite?token=${token}`;
    await sendSetPassword(result.email, result.name, url);
  }
  if (!result.already && result.userId) {
    await notifyUser(result.userId, "Membership active", `Your membership at ${result.application.club.name} is active.`, "/me");
  }
  return result;
}
