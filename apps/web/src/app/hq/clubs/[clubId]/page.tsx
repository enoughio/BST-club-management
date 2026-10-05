"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { money, titleCase, when } from "@/lib/format";
import type { Club, MemberRow } from "@/lib/types";

export default function HqClubPage() {
  const clubId = String(useParams().clubId);
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [adminId, setAdminId] = useState("");
  const [fee, setFee] = useState("");
  const [interval, setInterval] = useState("");

  function load() {
    api<{ club: Club; members: MemberRow[] }>(`/clubs/${clubId}`).then((data) => {
      setClub(data.club);
      setMembers(data.members);
      setFee(String(data.club.membershipFeeAmount / 100));
      setInterval(String(data.club.electionIntervalMonths));
      setAdminId(data.club.currentAdmin?.id || "");
    }).catch(() => undefined);
  }
  useEffect(load, [clubId]);
  if (!club) return <p>Loading…</p>;

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/clubs/${clubId}`, { method: "PATCH", body: JSON.stringify({ name: form.get("name"), city: form.get("city"), address: form.get("address"), meetingSchedule: form.get("meetingSchedule"), description: form.get("description"), status: form.get("status") }) });
      toast.success("Club updated");
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title={club.name} lede={`${club.city} · ${titleCase(club.status)}`} />
      <div className="flex gap-3 text-sm">
        <Link className="text-primary" href={`/hq/clubs/${clubId}/meetings`}>Past and upcoming meetings</Link>
        <Link className="text-primary" href={`/hq/clubs/${clubId}/committee`}>Committee history</Link>
      </div>
      <form className="flex flex-col gap-3" onSubmit={saveProfile}>
        <Field label="Name"><Input name="name" defaultValue={club.name} /></Field>
        <Field label="City"><Input name="city" defaultValue={club.city} /></Field>
        <Field label="Address"><Input name="address" defaultValue={club.address || ""} /></Field>
        <Field label="Meeting schedule"><Input name="meetingSchedule" defaultValue={club.meetingSchedule || ""} /></Field>
        <Field label="Description"><Input name="description" defaultValue={club.description || ""} /></Field>
        <Field label="Status">
          <Select name="status" defaultValue={club.status}><option>ACTIVE</option><option>PROVISIONAL</option><option>INACTIVE</option></Select>
        </Field>
        <Button type="submit">Save profile</Button>
      </form>
      <form className="flex flex-col gap-3 rounded-xl border bg-card p-4" onSubmit={(event) => { event.preventDefault(); api(`/clubs/${clubId}/billing`, { method: "PATCH", body: JSON.stringify({ membershipFeeAmount: Math.round(Number(fee) * 100), electionIntervalMonths: Number(interval) }) }).then(() => { toast.success("Fee and interval saved"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save billing")); }}>
        <h2 className="font-serif text-2xl">Fee and elections</h2>
        <p className="text-sm text-muted-foreground">Current fee {money(club.membershipFeeAmount, club.currency)}. Next election {when(club.nextElectionAt)}.</p>
        <Field label="Fee in rupees"><Input value={fee} onChange={(event) => setFee(event.target.value)} /></Field>
        <Field label="Interval in months"><Input value={interval} onChange={(event) => setInterval(event.target.value)} /></Field>
        <Button type="submit">Update fee and interval</Button>
      </form>
      <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); api(`/clubs/${clubId}/admin`, { method: "POST", body: JSON.stringify({ userId: adminId }) }).then(() => { toast.success("Club Admin appointed"); load(); }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not appoint")); }}>
        <h2 className="font-serif text-2xl">Club Admin</h2>
        <Select value={adminId} onChange={(event) => setAdminId(event.target.value)}>
          <option value="">Choose an active member</option>
          {members.filter((row) => row.status === "ACTIVE").map((row) => <option key={row.user.id} value={row.user.id}>{row.user.name}</option>)}
        </Select>
        <Button type="submit">Appoint or replace</Button>
      </form>
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-2xl">Members</h2>
        {members.map((row) => (
          <Card key={row.membershipId} className="p-4">
            <Link href={`/members/${row.user.id}`} className="font-medium">{row.user.name}</Link>
            <p className="text-sm text-muted-foreground">{row.user.email} · {titleCase(row.status)} · joined {when(row.joinedAt)}</p>
          </Card>
        ))}
      </div>
      <Button variant="destructive" onClick={() => api(`/clubs/${clubId}`, { method: "DELETE" }).then(() => toast.success("Club deleted")).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not delete"))}>Delete club</Button>
    </div>
  );
}
