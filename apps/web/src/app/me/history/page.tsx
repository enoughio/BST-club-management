"use client";

import { useEffect, useState } from "react";
import { PageIntro } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { ageBracket, ageOn, gradeLabel, roleIcon } from "@/lib/child";
import { money, titleCase, when } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { AgendaItem, Meeting } from "@/lib/types";

type Membership = { id: string; status: string; joinedAt: string; endedAt: string | null; gradeAtJoin: string | null; club: { name: string; city: string } };
type Invoice = { id: string; amount: number; currency: string; status: string; paidAt: string | null; club: { name: string } };
type ProjectRow = { projectId: string; approved: boolean; score: number | null; approvedAt: string | null; project?: { title: string } };
type Level = { name: string; number: number; projects: { id: string; title: string }[] };
type MeetingRow = Meeting & { agenda?: AgendaItem[]; attendance?: { present: boolean; late: boolean }[] };

export default function HistoryPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string; level: string; score: number | null; approvedAt: string | null }[]>([]);
  const { user } = useSession();
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);

  useEffect(() => {
    api<{ memberships: Membership[] }>("/me/history").then((data) => setMemberships(data.memberships)).catch(() => undefined);
    api<{ invoices: Invoice[] }>("/me/dues").then((data) => setInvoices(data.invoices)).catch(() => undefined);
    api<{ levels: Level[]; progress: ProjectRow[] }>("/me/progress").then((data) => {
      const titles = new Map(data.levels.flatMap((level) => level.projects.map((project) => [project.id, { title: project.title, level: `Level ${level.number}: ${level.name}` }])));
      setProjects(data.progress.filter((row) => row.approved).map((row) => ({
        id: row.projectId,
        title: titles.get(row.projectId)?.title || row.project?.title || "Project",
        level: titles.get(row.projectId)?.level || "",
        score: row.score,
        approvedAt: row.approvedAt,
      })).sort((a, b) => new Date(a.approvedAt || 0).getTime() - new Date(b.approvedAt || 0).getTime()));
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
              <AgeGroup joinedAt={row.joinedAt} gradeAtJoin={row.gradeAtJoin} dateOfBirth={user?.dateOfBirth} />
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
            const roles = (meeting.agenda || []).map((item) => `${roleIcon(item.role)} ${titleCase(item.role)}`);
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
        <h2 className="mb-2 font-serif text-2xl">Growth timeline</h2>
        {projects.length === 0 && <Card className="p-4 text-sm text-muted-foreground">Approved projects will appear here with the age at each milestone.</Card>}
        {projects.length > 0 && (
          <div className="overflow-x-auto pb-2">
            <ol className="flex min-w-max items-start gap-0">
              {projects.map((project, index) => {
                const age = user?.dateOfBirth && project.approvedAt ? ageOn(user.dateOfBirth, new Date(project.approvedAt)) : null;
                return (
                  <li key={project.id} className="relative w-44 px-2">
                    {index < projects.length - 1 && <span className="absolute left-6 top-3 h-0.5 w-full bg-blue-200" />}
                    <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-[10px] text-white">{index + 1}</span>
                    <p className="mt-2 text-sm font-medium">{project.title}</p>
                    <p className="text-xs text-muted-foreground">{project.level}</p>
                    <p className="text-xs text-blue-900">{age != null ? `Age ${age}` : "Age not on file"}{project.approvedAt ? ` · ${when(project.approvedAt)}` : ""}</p>
                    <p className="text-xs">{project.score != null ? `Score ${project.score}` : "Approved"}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

function AgeGroup({ joinedAt, gradeAtJoin, dateOfBirth }: { joinedAt: string; gradeAtJoin: string | null; dateOfBirth?: string | null }) {
  const age = dateOfBirth ? ageOn(dateOfBirth, new Date(joinedAt)) : null;
  const grade = gradeLabel(gradeAtJoin);
  const label = [grade, age != null ? ageBracket(age) : null].filter(Boolean).join(" · ");
  if (!label) return null;
  return <p className="mt-2 inline-flex rounded-full bg-red-50 px-2 py-1 text-xs text-red-900">Age group · {label}</p>;
}
