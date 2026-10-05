"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { money } from "@/lib/format";

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
};

type Payload = {
  application: { email: string; kind: string; status: string; form: Partial<FormState> | null };
  club: { name: string; city: string; membershipFeeAmount: number; currency: string };
  razorpay: { configured: boolean; keyId: string };
};

const empty: FormState = { name: "", email: "", phone: "", dateOfBirth: "", gender: "", address: "", city: "", occupation: "", goals: "" };

export default function ApplyPage() {
  const token = String(useParams().token);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

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

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

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
        body: JSON.stringify(form),
      });
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay Checkout did not load");
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: payload.club.name,
        description: "Membership fee",
        prefill: { name: form.name, email: form.email, contact: form.phone },
        theme: { color: "#1e3a5f" },
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

  if (error) return <main className="mx-auto max-w-lg px-4 py-12">{error}</main>;
  if (!payload) return <main className="p-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-8">
      <p className="text-sm uppercase tracking-widest text-accent">{payload.club.city}</p>
      <h1 className="mt-1 font-serif text-4xl text-primary">{payload.application.kind === "REINSTATE" ? "Reinstate" : "Join"} {payload.club.name}</h1>
      <p className="mt-2 text-muted-foreground">The form and the fee are on this page. A successful payment activates the membership immediately.</p>
      {done ? (
        <div className="mt-8 rounded-xl border bg-card p-5">
          <h2 className="font-serif text-2xl">You are in</h2>
          <p className="mt-2">Your membership at {payload.club.name} is active. If this is a new account, check your email to set a password.</p>
        </div>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void pay(); }}>
          <Field label="Full name"><Input value={form.name} onChange={(event) => set("name", event.target.value)} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} readOnly /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(event) => set("phone", event.target.value)} /></Field>
          <Field label="Date of birth"><Input type="date" value={form.dateOfBirth} onChange={(event) => set("dateOfBirth", event.target.value)} /></Field>
          <Field label="Gender"><Input value={form.gender} onChange={(event) => set("gender", event.target.value)} /></Field>
          <Field label="Address"><Input value={form.address} onChange={(event) => set("address", event.target.value)} /></Field>
          <Field label="City"><Input value={form.city} onChange={(event) => set("city", event.target.value)} /></Field>
          <Field label="Occupation"><Input value={form.occupation} onChange={(event) => set("occupation", event.target.value)} /></Field>
          <Field label="Goals"><Textarea value={form.goals} onChange={(event) => set("goals", event.target.value)} /></Field>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Membership fee</p>
            <p className="font-serif text-3xl">{money(payload.club.membershipFeeAmount, payload.club.currency)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {payload.razorpay.configured ? "Razorpay Checkout opens on this page." : "Razorpay keys are not configured on the server yet. The pay action still calls the live order API."}
            </p>
          </div>
          <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
              <span className="font-medium">{money(payload.club.membershipFeeAmount, payload.club.currency)}</span>
              <Button type="submit" variant="accent" disabled={paying}>{paying ? "Opening…" : "Pay and activate"}</Button>
            </div>
          </div>
        </form>
      )}
    </main>
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
