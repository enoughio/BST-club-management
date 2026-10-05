"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ApiError, api } from "@/lib/api";
import { money, titleCase } from "@/lib/format";
import type { Club } from "@/lib/types";

const emptyForm = { name: "", city: "", meetingSchedule: "", charterDate: "", membershipFeeAmount: "1500", electionIntervalMonths: "6", currency: "INR", status: "ACTIVE" };

export default function HqClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function load() {
    api<{ clubs: Club[] }>("/clubs").then((data) => setClubs(data.clubs)).catch(() => undefined);
  }
  useEffect(load, []);

  async function createClub(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api("/clubs", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          city: form.city,
          meetingSchedule: form.meetingSchedule || null,
          charterDate: form.charterDate,
          status: form.status,
          membershipFeeAmount: Math.round(Number(form.membershipFeeAmount) * 100),
          currency: form.currency,
          electionIntervalMonths: Number(form.electionIntervalMonths),
        }),
      });
      toast.success("Club created");
      setForm(emptyForm);
      setOpen(false);
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create club");
    }
  }

  return (
    <div>
      <PageIntro title="Clubs" lede="Each club has one current Club Admin." />
      <div className="mb-4">
        <Button onClick={() => setOpen(true)}>Add club</Button>
      </div>
      <div className="flex flex-col gap-3">
        {clubs.map((club) => (
          <Link key={club.id} href={`/hq/clubs/${club.id}`}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-xl">{club.name}</p>
                  <p className="text-sm text-muted-foreground">{club.city} · {titleCase(club.status)} · every {club.electionIntervalMonths} months</p>
                  {club.meetingSchedule && <p className="text-sm text-muted-foreground">{club.meetingSchedule}</p>}
                </div>
                <p className="text-sm">{money(club.membershipFeeAmount, club.currency)}</p>
              </div>
              <p className="mt-2 text-sm">Club Admin: {club.currentAdmin ? `${club.currentAdmin.name} (${club.currentAdmin.email})` : "Not appointed"}</p>
            </Card>
          </Link>
        ))}
      </div>
      <Sheet open={open} onOpenChange={setOpen} title="Add club">
        <form className="flex flex-col gap-3" onSubmit={createClub}>
          <Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="City"><Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required /></Field>
          <Field label="Meeting schedule"><Input value={form.meetingSchedule} placeholder="Thursdays, 7:00 PM" onChange={(event) => setForm({ ...form, meetingSchedule: event.target.value })} /></Field>
          <Field label="Charter date"><Input type="date" value={form.charterDate} onChange={(event) => setForm({ ...form, charterDate: event.target.value })} required /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PROVISIONAL">Provisional</option>
            </Select>
          </Field>
          <Field label="Membership fee (major units)"><Input value={form.membershipFeeAmount} onChange={(event) => setForm({ ...form, membershipFeeAmount: event.target.value })} required /></Field>
          <Field label="Currency"><Select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option>INR</option></Select></Field>
          <Field label="Election interval (months)"><Input value={form.electionIntervalMonths} onChange={(event) => setForm({ ...form, electionIntervalMonths: event.target.value })} required /></Field>
          <Button type="submit">Create club</Button>
        </form>
      </Sheet>
    </div>
  );
}
