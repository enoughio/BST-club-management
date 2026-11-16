"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { feePeriodPhrase, money, titleCase, when } from "@/lib/format";
import type { Club, FeePeriod } from "@/lib/types";

type CreatedMember = {
  user?: { name?: string; email?: string };
  clubName?: string;
  payment?: { amount?: number; date?: string; reference?: string };
  feePeriod?: FeePeriod;
  periodEndsAt?: string | null;
  passwordEmailSent?: boolean;
  adminEmailSent?: boolean;
  adminName?: string | null;
  adminEmail?: string | null;
};

type Summary = {
  name: string;
  email: string;
  clubName: string;
  feePeriod: FeePeriod;
  amount: number | null;
  currency: string;
  paymentDate: string;
  reference: string;
  periodEndsAt: string | null;
  passwordEmailSent: boolean | null;
  adminEmailSent: boolean | null;
  adminName: string | null;
  adminEmail: string | null;
};

function feeAmount(club: Club | undefined, period: FeePeriod) {
  if (!club || typeof club.membershipFeeAmount !== "number") return "";
  const minor = period === "QUARTERLY" && typeof club.quarterlyFeeAmount === "number" ? club.quarterlyFeeAmount : club.membershipFeeAmount;
  return String(minor / 100);
}

function offersQuarterly(club: Club | undefined) {
  return typeof club?.quarterlyFeeAmount === "number";
}

export default function NewMemberPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsReady, setClubsReady] = useState(false);
  const [clubId, setClubId] = useState("");
  const [feePeriod, setFeePeriod] = useState<FeePeriod>("ANNUAL");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    api<{ clubs: Club[] }>("/clubs")
      .then((data) => {
        setClubs(data.clubs);
        setClubId((current) => current || data.clubs[0]?.id || "");
      })
      .catch(() => undefined)
      .finally(() => setClubsReady(true));
  }, []);

  const club = clubs.find((item) => item.id === clubId);
  const quarterly = offersQuarterly(club);

  useEffect(() => {
    if (feePeriod === "QUARTERLY" && !offersQuarterly(club)) {
      setFeePeriod("ANNUAL");
      return;
    }
    setAmount(feeAmount(club, feePeriod === "QUARTERLY" && offersQuarterly(club) ? "QUARTERLY" : "ANNUAL"));
  }, [club, feePeriod]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const period: FeePeriod = feePeriod === "QUARTERLY" && quarterly ? "QUARTERLY" : "ANNUAL";
    setPending(true);
    let saved = false;
    try {
      const result = await api<CreatedMember>("/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          dateOfBirth: form.get("dateOfBirth") || null,
          school: form.get("school"),
          grade: form.get("grade"),
          guardianName: form.get("guardianName"),
          guardianPhone: form.get("guardianPhone"),
          guardianEmail: form.get("guardianEmail") || null,
          secondGuardianName: form.get("secondGuardianName"),
          secondGuardianPhone: form.get("secondGuardianPhone"),
          secondGuardianEmail: form.get("secondGuardianEmail") || null,
          consentPhoto: form.get("consentPhoto") === "on",
          consentParticipation: form.get("consentParticipation") === "on",
          consentData: form.get("consentData") === "on",
          gender: form.get("gender"),
          address: form.get("address"),
          city: form.get("city"),
          occupation: form.get("occupation"),
          goals: form.get("goals"),
          clubId,
          feePeriod: period,
          paymentAmount: Math.round(Number(form.get("paymentAmount")) * 100),
          paymentDate: form.get("paymentDate"),
          paymentReference: form.get("paymentReference"),
        }),
      });
      saved = true;
      const next: Summary = {
        name: result.user?.name || String(form.get("name") || ""),
        email: result.user?.email || String(form.get("email") || ""),
        clubName: result.clubName || club?.name || "Club",
        feePeriod: result.feePeriod || period,
        amount: typeof result.payment?.amount === "number" ? result.payment.amount : Math.round(Number(form.get("paymentAmount")) * 100),
        currency: club?.currency || "INR",
        paymentDate: result.payment?.date || String(form.get("paymentDate") || ""),
        reference: result.payment?.reference || String(form.get("paymentReference") || ""),
        periodEndsAt: result.periodEndsAt || null,
        passwordEmailSent: typeof result.passwordEmailSent === "boolean" ? result.passwordEmailSent : null,
        adminEmailSent: typeof result.adminEmailSent === "boolean" ? result.adminEmailSent : null,
        adminName: result.adminName || null,
        adminEmail: result.adminEmail || null,
      };
      try {
        formEl.reset();
      } catch {
        // The saved element is the one that was submitted. A failed reset must not look like a failed save.
      }
      setFeePeriod("ANNUAL");
      setAmount(feeAmount(club, "ANNUAL"));
      setSummary(next);
    } catch (error) {
      if (!saved) toast.error(error instanceof ApiError ? error.message : "Could not create member");
    } finally {
      setPending(false);
    }
  }

  function createAnother() {
    setFeePeriod("ANNUAL");
    setAmount(feeAmount(club, "ANNUAL"));
    setSummary(null);
    setFormKey((key) => key + 1);
  }

  if (!clubsReady) {
    return (
      <div>
        <PageIntro title="Create member" lede="The profile and the manual payment are saved together. No Razorpay call." />
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </div>
      </div>
    );
  }

  if (summary) {
    return (
      <div>
        <PageIntro title="Member created" lede="The profile and the payment are saved.." />
        <Card className="p-5">
          <h2 className="font-serif text-2xl">{summary.name}</h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <Row label="Email" value={summary.email} />
            <Row label="Club" value={summary.clubName} />
            <Row label="Tenure" value={`${titleCase(summary.feePeriod)} · ${feePeriodPhrase(summary.feePeriod)}`} />
            <Row label="Amount" value={typeof summary.amount === "number" ? `${money(summary.amount, summary.currency)} ${feePeriodPhrase(summary.feePeriod)}` : "—"} />
            <Row label="Payment date" value={when(summary.paymentDate)} />
            <Row label="Reference" value={summary.reference || "—"} />
            <Row label="Period ends" value={when(summary.periodEndsAt)} />
          </dl>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <p>{passwordLine(summary)}</p>
            <p>{adminLine(summary)}</p>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={createAnother}>Create another</Button>
            <Button type="button" variant="outline" asChild><Link href="/hq/members">Back to members</Link></Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form key={formKey} className="flex flex-col gap-4" onSubmit={submit}>
      <PageIntro title="Create member" lede="The profile and the manual payment are saved together. No Razorpay call." />
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="font-serif text-2xl">Child</h2>
        <Field label="Full name"><Input name="name" required /></Field>
        <Field label="Date of birth"><Input name="dateOfBirth" type="date" /></Field>
        <Field label="Gender"><Input name="gender" /></Field>
        <Field label="School"><Input name="school" /></Field>
        <Field label="Grade"><Input name="grade" placeholder="4" /></Field>
        <Field label="Goals"><Textarea name="goals" /></Field>
      </section>
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="font-serif text-2xl">Contact</h2>
        <Field label="Email"><Input name="email" type="email" required /></Field>
        <Field label="Phone"><Input name="phone" /></Field>
        <Field label="Address"><Input name="address" /></Field>
        <Field label="City"><Input name="city" /></Field>
      </section>
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="font-serif text-2xl">Parents and consent</h2>
        <Field label="Guardian name"><Input name="guardianName" /></Field>
        <Field label="Guardian mobile"><Input name="guardianPhone" /></Field>
        <Field label="Guardian email"><Input name="guardianEmail" type="email" /></Field>
        <Field label="Second guardian name"><Input name="secondGuardianName" /></Field>
        <Field label="Second guardian mobile"><Input name="secondGuardianPhone" /></Field>
        <Field label="Second guardian email"><Input name="secondGuardianEmail" type="email" /></Field>
        <Field label="Occupation"><Input name="occupation" /></Field>
        <label className="flex items-center gap-2 text-sm"><input name="consentPhoto" type="checkbox" /> Photo consent</label>
        <label className="flex items-center gap-2 text-sm"><input name="consentParticipation" type="checkbox" /> Participation consent</label>
        <label className="flex items-center gap-2 text-sm"><input name="consentData" type="checkbox" /> Data handling consent</label>
      </section>
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="font-serif text-2xl">Club and payment</h2>
        <Field label="Club">
          <Select value={clubId} onChange={(event) => setClubId(event.target.value)}>
            {clubs.length === 0 && <option value="">No clubs yet</option>}
            {clubs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </Field>
        <Field label="Tenure">
          <Select value={feePeriod} onChange={(event) => setFeePeriod(event.target.value === "QUARTERLY" ? "QUARTERLY" : "ANNUAL")}>
            <option value="ANNUAL">Annual</option>
            {quarterly && <option value="QUARTERLY">Quarterly</option>}
          </Select>
        </Field>
        <Field label={`Amount received (rupees, ${feePeriodPhrase(feePeriod)})`}>
          <Input name="paymentAmount" required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Payment date"><Input name="paymentDate" type="date" required /></Field>
        <Field label="Reference"><Input name="paymentReference" required placeholder="Receipt or transfer id" /></Field>
      </section>
      <Button type="submit" pending={pending}>Create profile and record payment</Button>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="text-muted-foreground sm:w-36">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function passwordLine(summary: Summary) {
  if (summary.passwordEmailSent === true) return `A set-password email was sent to ${summary.email}.`;
  if (summary.passwordEmailSent === false) return "The set-password email was not sent.";
  return "Set-password email status is not available yet.";
}

function adminLine(summary: Summary) {
  const who = [summary.adminName, summary.adminEmail].filter(Boolean).join(", ");
  if (summary.adminEmailSent === true) return who ? `The club admin was emailed: ${who}.` : "The club admin was emailed.";
  if (summary.adminEmailSent === false && who) return `The email to the club admin failed (${who}).`;
  if (summary.adminEmailSent === false) return "This club has no admin, so no admin email was sent.";
  return "Club admin email status is not available yet.";
}
