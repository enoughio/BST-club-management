"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Field } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { feePeriodPhrase, money } from "@/lib/format";
import type { FeePeriod } from "@/lib/types";

type FormState = {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  city: string;
  occupation: string;
  goals: string;
  school: string;
  grade: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  secondGuardianName: string;
  secondGuardianPhone: string;
  secondGuardianEmail: string;
  consentPhoto: boolean;
  consentParticipation: boolean;
  consentData: boolean;
};

type Payload = {
  application: { email: string; kind: string; status: string; form: Partial<FormState> | null };
  club: { name: string; city: string; membershipFeeAmount: number; quarterlyFeeAmount?: number | null; currency: string };
  razorpay: { configured: boolean; keyId: string };
};

const empty: FormState = { name: "", email: "", phone: "", dateOfBirth: "", gender: "", address: "", city: "", occupation: "", goals: "", school: "", grade: "", guardianName: "", guardianPhone: "", guardianEmail: "", secondGuardianName: "", secondGuardianPhone: "", secondGuardianEmail: "", consentPhoto: false, consentParticipation: false, consentData: false };

export default function ApplyPage() {
  const token = String(useParams().token);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [feePeriod, setFeePeriod] = useState<FeePeriod>("ANNUAL");

  useEffect(() => {
    api<Payload>(`/applications/${token}`)
      .then((data) => {
        setPayload(data);
        setForm({
          ...empty,
          ...(data.application.form || {}),
          email: data.application.email,
          phone: data.application.form?.phone || "",
          dateOfBirth: data.application.form?.dateOfBirth || "",
          gender: data.application.form?.gender || "",
          address: data.application.form?.address || "",
          city: data.application.form?.city || "",
          occupation: data.application.form?.occupation || "",
          goals: data.application.form?.goals || "",
          name: data.application.form?.name || "",
        });
        if (data.application.status === "COMPLETED") setDone(true);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "This link is not available"));
  }, [token]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const offersQuarterly = typeof payload?.club.quarterlyFeeAmount === "number";
  const selectedPeriod: FeePeriod = offersQuarterly && feePeriod === "QUARTERLY" ? "QUARTERLY" : "ANNUAL";

  async function pay() {
    if (!payload) return;
    if (!form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    setPaying(true);
    try {
      const order = await api<{ orderId: string; amount: number; currency: string; keyId: string }>(`/applications/${token}/order`, {
        method: "POST",
        body: JSON.stringify({ ...form, feePeriod: selectedPeriod }),
      });
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay Checkout did not load");
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: payload.club.name,
        description: `Membership fee, ${feePeriodPhrase(selectedPeriod)}`,
        prefill: { name: form.name, email: form.email, contact: form.phone },
        theme: { color: "#1d4ed8" },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await api(`/applications/${token}/verify`, { method: "POST", body: JSON.stringify(response) });
            setDone(true);
            toast.success("Membership is active");
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Payment could not be confirmed");
          }
        },
      });
      checkout.open();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Payment could not start");
    } finally {
      setPaying(false);
    }
  }

  if (error) {
    return (
      <main className="member-theme min-h-screen bg-blue-50 px-4 py-12">
        <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-red-600">Invitation</p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight">We could not open this form</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }
  if (!payload) {
    return (
      <main className="member-theme min-h-screen bg-blue-50 px-4 py-12">
        <p className="mx-auto max-w-lg text-muted-foreground">Loading the form…</p>
      </main>
    );
  }

  const joining = payload.application.kind !== "REINSTATE";
  const charge = selectedPeriod === "QUARTERLY" ? payload.club.quarterlyFeeAmount ?? payload.club.membershipFeeAmount : payload.club.membershipFeeAmount;
  const chargeLabel = `${money(charge, payload.club.currency)} ${feePeriodPhrase(selectedPeriod)}`;
  const missingConsent = [
    !form.consentPhoto && "photos",
    !form.consentParticipation && "participation",
    !form.consentData && "data handling",
  ].filter((item): item is string => Boolean(item));

  return (
    <main className="member-theme min-h-screen bg-blue-50">
      <div className="mx-auto max-w-lg px-4 pb-32 pt-6 sm:pt-10">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="h-2 bg-blue-700" />
          <div className="p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-700">
              <span className="h-2 w-2 rounded-full bg-red-600" />
              {payload.club.city}
            </p>
            <h1 className="mt-2 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
              {joining ? `Register your child with ${payload.club.name}` : `Welcome them back to ${payload.club.name}`}
            </h1>
            <p className="mt-3 text-muted-foreground">
              Parents usually fill this in. Share a few details about your child, add both guardians, and confirm the permissions you are happy with. Paying the fee on this page activates the membership.
            </p>
          </div>
        </div>

        {done ? (
          <div className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="h-2 bg-blue-700" />
            <div className="p-5">
              <p className="text-sm font-medium text-blue-700">Membership active</p>
              <h2 className="mt-1 font-serif text-3xl tracking-tight">You are in</h2>
              <p className="mt-2 text-muted-foreground">Your child&apos;s membership at {payload.club.name} is active. If this is a new account, check your email to set a password.</p>
            </div>
          </div>
        ) : (
          <form className="mt-5 flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void pay(); }}>
            <Section title="About your child" lede="The name and school details the club will use.">
              <Field label="Child's full name"><Input value={form.name} onChange={(event) => set("name", event.target.value)} required autoComplete="name" /></Field>
              <Field label="Child's date of birth"><Input type="date" value={form.dateOfBirth} onChange={(event) => set("dateOfBirth", event.target.value)} /></Field>
              <Field label="School"><Input value={form.school} onChange={(event) => set("school", event.target.value)} /></Field>
              <Field label="Grade"><Input value={form.grade} onChange={(event) => set("grade", event.target.value)} placeholder="4" /></Field>
              <Field label="Gender"><Input value={form.gender} onChange={(event) => set("gender", event.target.value)} /></Field>
              <Field label="Goals"><Textarea value={form.goals} onChange={(event) => set("goals", event.target.value)} /></Field>
            </Section>

            <Section title="Family contact" lede="The invitation email is already filled in and stays with this application.">
              <Field label="Email"><Input type="email" value={form.email} readOnly /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(event) => set("phone", event.target.value)} autoComplete="tel" /></Field>
              <Field label="Address"><Input value={form.address} onChange={(event) => set("address", event.target.value)} autoComplete="street-address" /></Field>
              <Field label="City"><Input value={form.city} onChange={(event) => set("city", event.target.value)} autoComplete="address-level2" /></Field>
              <Field label="Occupation"><Input value={form.occupation} onChange={(event) => set("occupation", event.target.value)} /></Field>
            </Section>

            <Section title="Parents and guardians" lede="Add both adults who look after this child, so the club can reach the right person.">
              <Field label="Guardian name"><Input value={form.guardianName} onChange={(event) => set("guardianName", event.target.value)} autoComplete="name" /></Field>
              <Field label="Guardian mobile"><Input value={form.guardianPhone} onChange={(event) => set("guardianPhone", event.target.value)} autoComplete="tel" /></Field>
              <Field label="Guardian email"><Input type="email" value={form.guardianEmail} onChange={(event) => set("guardianEmail", event.target.value)} autoComplete="email" /></Field>
              <Field label="Second guardian name"><Input value={form.secondGuardianName} onChange={(event) => set("secondGuardianName", event.target.value)} /></Field>
              <Field label="Second guardian mobile"><Input value={form.secondGuardianPhone} onChange={(event) => set("secondGuardianPhone", event.target.value)} /></Field>
              <Field label="Second guardian email"><Input type="email" value={form.secondGuardianEmail} onChange={(event) => set("secondGuardianEmail", event.target.value)} /></Field>
            </Section>

            <Section title="Permissions" lede="Leave a box open if you are not ready to agree. Open items stay marked in red.">
              <ConsentBox
                checked={form.consentPhoto}
                onChange={(value) => set("consentPhoto", value)}
                label="Photos"
                detail="Club photos that include your child."
              />
              <ConsentBox
                checked={form.consentParticipation}
                onChange={(value) => set("consentParticipation", value)}
                label="Participation"
                detail="Taking part in club meetings and activities."
              />
              <ConsentBox
                checked={form.consentData}
                onChange={(value) => set("consentData", value)}
                label="Data handling"
                detail="Storing these details so the club can run the membership."
              />
              {missingConsent.length > 0 ? (
                <p className="text-sm text-red-600">Still open: {missingConsent.join(", ")}.</p>
              ) : (
                <p className="text-sm text-muted-foreground">All three permissions are confirmed.</p>
              )}
            </Section>

            <div className="overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-3 h-1.5 w-12 rounded-full bg-red-600" />
              <p className="text-sm text-muted-foreground">Membership fee</p>
              {offersQuarterly && (
                <div className="mt-3">
                  <Field label="Tenure">
                    <Select value={selectedPeriod} onChange={(event) => setFeePeriod(event.target.value === "QUARTERLY" ? "QUARTERLY" : "ANNUAL")}>
                      <option value="ANNUAL">Annual</option>
                      <option value="QUARTERLY">Quarterly</option>
                    </Select>
                  </Field>
                </div>
              )}
              <p className="mt-3 font-serif text-3xl text-blue-700">{chargeLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {payload.razorpay.configured ? "Razorpay Checkout opens on this page." : "Razorpay keys are not configured on the server yet. The pay action still calls the live order API."}
              </p>
            </div>

            <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur">
              <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
                <span className="font-medium">{chargeLabel}</span>
                <Button type="submit" className="bg-blue-700 text-white hover:bg-blue-800" pending={paying}>Pay and activate</Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function Section({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{lede}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function ConsentBox({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm ${checked ? "border-border bg-background" : "border-red-200 bg-red-50"}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 accent-blue-700"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className={`font-medium ${checked ? "text-foreground" : "text-red-600"}`}>{label}</span>
        <span className="mt-0.5 block text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout"));
    document.body.appendChild(script);
  });
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}
