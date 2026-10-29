"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { money, titleCase, when } from "@/lib/format";
import type { AgendaItem, Meeting } from "@/lib/types";

type Membership = { id: string; status: string; joinedAt: string; endedAt: string | null; club: { name: string; city: string } };
type Invoice = { id: string; amount: number; currency: string; status: string; paidAt: string | null; club: { name: string } };
type ProjectRow = { projectId: string; approved: boolean; score: number | null; project?: { title: string } };
type Level = { name: string; number: number; projects: { id: string; title: string }[] };
type MeetingRow = Meeting & { agenda?: AgendaItem[]; attendance?: { present: boolean; late: boolean }[] };

export default function HistoryPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<{ title: string; level: string; score: number | null; approved: boolean }[]>([]);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);

  useEffect(() => {
    api<{ memberships: Membership[] }>("/me/history").then((data) => setMemberships(data.memberships)).catch(() => undefined);
    api<{ invoices: Invoice[] }>("/me/dues").then((data) => setInvoices(data.invoices)).catch(() => undefined);
    api<{ levels: Level[]; progress: ProjectRow[] }>("/me/progress").then((data) => {
      const titles = new Map(data.levels.flatMap((level) => level.projects.map((project) => [project.id, { title: project.title, level: `Level ${level.number}: ${level.name}` }])));
      setProjects(data.progress.filter((row) => row.approved).map((row) => ({
        title: titles.get(row.projectId)?.title || row.project?.title || "Project",
        level: titles.get(row.projectId)?.level || "",
        score: row.score,
        approved: row.approved,
      })));
    }).catch(() => undefined);
    api<{ past?: MeetingRow[]; attended?: MeetingRow[] }>("/me/meetings").then((data) => setMeetings(data.past || data.attended || [])).catch(() => undefined);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Full history" lede="Clubs you have belonged to, meetings you were marked for, dues you have paid, and projects an evaluator approved." />

      <section>
        <h2 className="mb-2 font-serif text-2xl">Membership</h2>
        {memberships.length === 0 && <Card className="p-4 text-sm text-muted-foreground">No club memberships yet.</Card>}
        <div className="flex flex-col gap-2">
          {memberships.map((row) => (
            <Card key={row.id} className="p-4">
              <p className="font-medium">{row.club.name}</p>
              <p className="text-sm text-muted-foreground">{row.club.city} · {titleCase(row.status)}</p>
              <p className="text-sm">Joined {when(row.joinedAt)}{row.endedAt ? ` · ended ${when(row.endedAt)}` : ""}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-serif text-2xl">Attendance</h2>
        {meetings.length === 0 && <Card className="p-4 text-sm text-muted-foreground">Completed meetings will appear here.</Card>}
        <div className="flex flex-col gap-2">
          {meetings.map((meeting) => {
            const record = meeting.attendance?.[0];
            const status = !record ? "Absent" : record.late ? "Late" : record.present ? "Present" : "Absent";
            const roles = (meeting.agenda || []).map((item) => titleCase(item.role));
            return (
              <Card key={meeting.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{meeting.title}</p>
                  <p className="text-sm text-muted-foreground">{when(meeting.meetingDate)}{meeting.club?.name ? ` · ${meeting.club.name}` : ""}{roles.length ? ` · ${roles.join(", ")}` : ""}</p>
                </div>
                <Badge className={status === "Present" ? "bg-blue-100 text-blue-900" : "bg-red-50 text-red-800"}>{status}</Badge>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-serif text-2xl">Dues</h2>
        {invoices.length === 0 && <Card className="p-4 text-sm text-muted-foreground">No invoices yet.</Card>}
        <div className="flex flex-col gap-2">
          {invoices.map((row) => (
            <Card key={row.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{row.club.name}</p>
                <p className="text-sm text-muted-foreground">{titleCase(row.status)}{row.paidAt ? ` · ${when(row.paidAt)}` : ""}</p>
              </div>
              <p className={row.status === "PAID" ? "text-blue-800" : row.status === "UNPAID" ? "text-red-700" : ""}>{money(row.amount, row.currency)}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-serif text-2xl">Projects completed</h2>
        {projects.length === 0 && <Card className="p-4 text-sm text-muted-foreground">Approved projects and their scores will appear here.</Card>}
        <div className="flex flex-col gap-2">
          {projects.map((project) => (
            <Card key={project.title} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{project.title}</p>
                <p className="text-sm text-muted-foreground">{project.level}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-900">{project.score != null ? `Score ${project.score}` : "Approved"}</Badge>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
