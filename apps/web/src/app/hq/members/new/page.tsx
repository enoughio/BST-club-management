"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import type { Club } from "@/lib/types";

export default function NewMemberPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState("");
  useEffect(() => {
    api<{ clubs: Club[] }>("/clubs").then((data) => { setClubs(data.clubs); setClubId(data.clubs[0]?.id || ""); }).catch(() => undefined);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          dateOfBirth: form.get("dateOfBirth") || null,
          gender: form.get("gender"),
          address: form.get("address"),
          city: form.get("city"),
          occupation: form.get("occupation"),
          goals: form.get("goals"),
          clubId,
          paymentAmount: Math.round(Number(form.get("paymentAmount")) * 100),
          paymentDate: form.get("paymentDate"),
          paymentReference: form.get("paymentReference"),
        }),
      });
      toast.success("Member created and payment recorded");
      event.currentTarget.reset();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create member");
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <PageIntro title="Create member" lede="The profile and the manual payment are saved together. No Razorpay call." />
      <Field label="Full name"><Input name="name" required /></Field>
      <Field label="Email"><Input name="email" type="email" required /></Field>
      <Field label="Phone"><Input name="phone" /></Field>
      <Field label="Date of birth"><Input name="dateOfBirth" type="date" /></Field>
      <Field label="Gender"><Input name="gender" /></Field>
      <Field label="Address"><Input name="address" /></Field>
      <Field label="City"><Input name="city" /></Field>
      <Field label="Occupation"><Input name="occupation" /></Field>
      <Field label="Goals"><Textarea name="goals" /></Field>
      <Field label="Club">
        <Select value={clubId} onChange={(event) => setClubId(event.target.value)}>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</Select>
      </Field>
      <Field label="Amount received (rupees)"><Input name="paymentAmount" required defaultValue="1500" /></Field>
      <Field label="Payment date"><Input name="paymentDate" type="date" required /></Field>
      <Field label="Reference"><Input name="paymentReference" required placeholder="Receipt or transfer id" /></Field>
      <Button type="submit">Create profile and record payment</Button>
    </form>
  );
}
