"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDashboardBus } from "@/components/dashboard-bus";
import { Field, PageIntro } from "@/components/shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { money, titleCase, when } from "@/lib/format";
import { TITLES, type Club, type Meeting } from "@/lib/types";

type Officer = { title: string; user: { name: string; email?: string; avatarUrl?: string | null } };
type Settings = { name: string; supportEmail: string | null };

export default function ClubProfilePage() {
  const clubId = String(useParams().clubId);
  const { emit } = useDashboardBus();
  const [club, setClub] = useState<Club | null>(null);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api<{ club: Club }>(`/clubs/${clubId}`).then((data) => setClub(data.club)).catch(() => undefined);
    api<{ officers: Officer[] }>(`/clubs/${clubId}/officers?scope=current`).then((data) => setOfficers(data.officers)).catch(() => undefined);
    api<{ meetings: Meeting[] }>(`/clubs/${clubId}/meetings?scope=upcoming`).then((data) => setNextMeeting(data.meetings[0] || null)).catch(() => undefined);
    api<{ settings: Settings }>("/settings").then((data) => setSettings(data.settings)).catch(() => undefined);
  }, [clubId]);

  if (!club) return <p>Loading…</p>;
  const query = encodeURIComponent(club.address || club.city);
  const nextDate = nextMeeting ? new Date(nextMeeting.meetingDate) : null;
  const days = nextDate ? Math.ceil((nextDate.getTime() - Date.now()) / 86400000) : null;

  function downloadReport() {
    api<Blob>(`/reports/clubs/${clubId}/health.pdf`).then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${club?.slug || "club"}-report.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    }).catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not generate the report"));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PageIntro title={club.name} />
          <p className="text-sm text-muted-foreground">Club {club.slug}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{titleCase(club.status)}</Badge>
            <span className="text-sm">Chartered {when(club.charterDate)}</span>
            <span className="text-sm">Community club</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)}>Edit profile</Button>
          <Button variant="outline" onClick={downloadReport}>Generate club report</Button>
          {settings?.supportEmail && <Button variant="outline" asChild><a href={`mailto:${settings.supportEmail}`}>Contact support</a></Button>}
        </div>
      </div>

      <section>
        <h2 className="font-serif text-2xl">Present leadership</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {TITLES.map((title) => {
            const officer = officers.find((row) => row.title === title);
            return (
              <Card key={title} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{titleCase(title)}</p>
                  <p className="mt-1 truncate font-medium">{officer?.user.name || "Vacant"}</p>
                  <p className="truncate text-sm text-muted-foreground">{title === "PRESIDENT" ? officer?.user.email || "—" : "Email kept private"}</p>
                </div>
                <Avatar name={officer?.user.name} src={officer?.user.avatarUrl} size="lg" />
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h2 className="font-serif text-2xl">Meetings</h2>
          <p className="mt-2">{club.meetingSchedule || "Schedule not set"}</p>
          <p className="text-sm text-muted-foreground">{club.address || club.city}</p>
          {nextMeeting && <p className="mt-2 text-sm">Next: {nextMeeting.title} · {when(nextMeeting.meetingDate)} {days !== null && days >= 0 ? `· in ${days} day${days === 1 ? "" : "s"}` : ""}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div title="Headquarters sets the fee. Club admins cannot change it here.">
              <dt className="text-muted-foreground">Club fee</dt>
              <dd className="font-medium">{money(club.membershipFeeAmount, club.currency)}</dd>
            </div>
            <div title="Headquarters sets how often this club elects officers.">
              <dt className="text-muted-foreground">Election interval</dt>
              <dd className="font-medium">{club.electionIntervalMonths} months</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-4">
          <h2 className="font-serif text-2xl">Headquarters</h2>
          <p className="mt-2 font-medium">{settings?.name || "Headquarters"}</p>
          <p className="text-sm text-muted-foreground">{settings?.supportEmail || "Support email is not set"}</p>
          <p className="mt-3 text-sm text-muted-foreground">Fees, election intervals, and club status are managed by headquarters.</p>
        </Card>
        <Card className="p-4">
          <h2 className="font-serif text-2xl">About</h2>
          <p className="mt-2 text-sm">{club.description || "No description yet. Use Edit profile to add one."}</p>
        </Card>
      </section>

      <section>
        <h2 className="font-serif text-2xl">Where we meet</h2>
        <p className="mb-3 text-sm text-muted-foreground">{club.address || club.city}</p>
        <iframe title="Club location" className="h-[28rem] w-full rounded-xl border sm:h-[32rem]" loading="lazy" src={`https://maps.google.com/maps?q=${query}&z=15&output=embed`} />
      </section>

      {editing && (
        <form className="flex flex-col gap-3" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          api(`/clubs/${clubId}`, { method: "PATCH", body: JSON.stringify({ name: form.get("name"), city: form.get("city"), address: form.get("address"), meetingSchedule: form.get("meetingSchedule"), description: form.get("description") }) })
            .then(() => { toast.success("Profile saved"); setEditing(false); emit("club:changed"); api<{ club: Club }>(`/clubs/${clubId}`).then((data) => setClub(data.club)).catch(() => undefined); })
            .catch((error: unknown) => toast.error(error instanceof ApiError ? error.message : "Could not save"));
        }}>
          <Field label="Name"><Input name="name" defaultValue={club.name} /></Field>
          <Field label="City"><Input name="city" defaultValue={club.city} /></Field>
          <Field label="Address"><Input name="address" defaultValue={club.address || ""} /></Field>
          <Field label="Meeting schedule"><Input name="meetingSchedule" defaultValue={club.meetingSchedule || ""} /></Field>
          <Field label="Description"><Textarea name="description" defaultValue={club.description || ""} /></Field>
          <Button type="submit">Save</Button>
        </form>
      )}
    </div>
  );
}
