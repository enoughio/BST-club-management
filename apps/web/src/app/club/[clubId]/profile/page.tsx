"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Club } from "@/lib/types";

export default function ClubProfilePage() {
  const clubId = String(useParams().clubId);
  const [club, setClub] = useState<Club | null>(null);
  useEffect(() => { api<{ club: Club }>(`/clubs/${clubId}`).then((data) => setClub(data.club)).catch(() => undefined); }, [clubId]);
  if (!club) return <p>Loading…</p>;
  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      api(`/clubs/${clubId}`, { method: "PATCH", body: JSON.stringify({ name: form.get("name"), city: form.get("city"), address: form.get("address"), meetingSchedule: form.get("meetingSchedule"), description: form.get("description") }) })
        .then(() => toast.success("Profile saved"))
        .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save"));
    }}>
      <PageIntro title="Club profile" lede={`Fee ${money(club.membershipFeeAmount, club.currency)} and the election interval are set by Headquarters.`} />
      <Field label="Name"><Input name="name" defaultValue={club.name} /></Field>
      <Field label="City"><Input name="city" defaultValue={club.city} /></Field>
      <Field label="Address"><Input name="address" defaultValue={club.address || ""} /></Field>
      <Field label="Meeting schedule"><Input name="meetingSchedule" defaultValue={club.meetingSchedule || ""} /></Field>
      <Field label="Description"><Textarea name="description" defaultValue={club.description || ""} /></Field>
      <Button type="submit">Save</Button>
    </form>
  );
}
