"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { money, titleCase } from "@/lib/format";
import type { Club } from "@/lib/types";

export default function HqClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [form, setForm] = useState({ name: "", city: "", charterDate: "", membershipFeeAmount: "1500", electionIntervalMonths: "6", currency: "INR" });

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
          charterDate: form.charterDate,
          membershipFeeAmount: Math.round(Number(form.membershipFeeAmount) * 100),
          currency: form.currency,
          electionIntervalMonths: Number(form.electionIntervalMonths),
        }),
      });
      toast.success("Club created");
      setForm({ ...form, name: "", city: "" });
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create club");
    }
  }

  return (
    <div>
      <PageIntro title="Clubs" lede="Each club has one current Club Admin." />
      <div className="flex flex-col gap-3">
        {clubs.map((club) => (
          <Link key={club.id} href={`/hq/clubs/${club.id}`}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-xl">{club.name}</p>
                  <p className="text-sm text-muted-foreground">{club.city} · {titleCase(club.status)} · every {club.electionIntervalMonths} months</p>
                </div>
                <p className="text-sm">{money(club.membershipFeeAmount, club.currency)}</p>
              </div>
              <p className="mt-2 text-sm">Club Admin: {club.currentAdmin ? `${club.currentAdmin.name} (${club.currentAdmin.email})` : "Not appointed"}</p>
            </Card>
          </Link>
        ))}
      </div>
      <form className="mt-8 flex flex-col gap-3 rounded-xl border bg-card p-4" onSubmit={createClub}>
        <h2 className="font-serif text-2xl">New club</h2>
        <Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
        <Field label="City"><Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required /></Field>
        <Field label="Charter date"><Input type="date" value={form.charterDate} onChange={(event) => setForm({ ...form, charterDate: event.target.value })} required /></Field>
        <Field label="Fee (rupees)"><Input value={form.membershipFeeAmount} onChange={(event) => setForm({ ...form, membershipFeeAmount: event.target.value })} required /></Field>
        <Field label="Currency"><Select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option>INR</option></Select></Field>
        <Field label="Election interval (months)"><Input value={form.electionIntervalMonths} onChange={(event) => setForm({ ...form, electionIntervalMonths: event.target.value })} required /></Field>
        <Button type="submit">Create club</Button>
      </form>
    </div>
  );
}
