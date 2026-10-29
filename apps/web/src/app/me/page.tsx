"use client";

import { ArrowUpRight, Award, BookOpen, Mic } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AttendanceHeatmap, type AttendanceMark } from "@/components/attendance-heatmap";
import type { CertificateView } from "@/components/certificate-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { when } from "@/lib/format";
import type { AgendaItem, Meeting } from "@/lib/types";

type Project = { id: string; title: string; description?: string | null };
type Level = { id: string; number: number; name: string; unlocked?: boolean; projects: Project[] };
type Progress = { projectId: string; approved: boolean; score: number | null };
type MeetingRow = Meeting & { agenda?: AgendaItem[]; attendance?: { present: boolean; late: boolean }[]; rsvps?: { status: string }[] };

function unlocked(levels: Level[], progress: Progress[], index: number) {
  if (typeof levels[index]?.unlocked === "boolean") return levels[index].unlocked;
  const approved = new Set(progress.filter((row) => row.approved).map((row) => row.projectId));
  return levels.slice(0, index).every((level) => level.projects.every((project) => approved.has(project.id)));
}

function meetingStart(meeting: Meeting) {
  const day = meeting.meetingDate.slice(0, 10);
  const [hours = "0", minutes = "0"] = (meeting.startTime || "00:00").split(":");
  return new Date(`${day}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`);
}

function countdown(target: number, now: number) {
  const total = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  return days > 0 ? `${days}d ${clock}` : clock;
}

function shortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function MemberDashboard() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [certificates, setCertificates] = useState<CertificateView[]>([]);
  const [upcoming, setUpcoming] = useState<MeetingRow[]>([]);
  const [past, setPast] = useState<MeetingRow[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    api<{ levels: Level[]; progress: Progress[]; certificates: CertificateView[] }>("/me/progress")
      .then((data) => { setLevels(data.levels); setProgress(data.progress); setCertificates(data.certificates); })
      .catch(() => undefined);
    api<{ upcoming: MeetingRow[]; past?: MeetingRow[]; attended?: MeetingRow[] }>("/me/meetings")
      .then((data) => { setUpcoming(data.upcoming); setPast(data.past || data.attended || []); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const approvedIds = useMemo(() => new Set(progress.filter((row) => row.approved).map((row) => row.projectId)), [progress]);
  const selectedIds = useMemo(() => new Set(progress.map((row) => row.projectId)), [progress]);
  const allProjects = levels.flatMap((level) => level.projects);
  const completedCount = allProjects.filter((project) => approvedIds.has(project.id)).length;
  const runningCount = allProjects.filter((project) => selectedIds.has(project.id) && !approvedIds.has(project.id)).length;
  const currentIndex = levels.findIndex((level, index) => unlocked(levels, progress, index) && !level.projects.every((project) => approvedIds.has(project.id)));
  const currentLevel = currentIndex >= 0 ? levels[currentIndex] : levels[levels.length - 1] || null;
  const activeProject = currentLevel?.projects.find((project) => selectedIds.has(project.id) && !approvedIds.has(project.id))
    || currentLevel?.projects.find((project) => !approvedIds.has(project.id))
    || null;
  const speechStarted = Boolean(activeProject && selectedIds.has(activeProject.id) && !approvedIds.has(activeProject.id));
  const nextProjects = (currentLevel?.projects || []).filter((project) => !approvedIds.has(project.id)).slice(0, 3);
  const levelTotal = currentLevel?.projects.length || 0;
  const levelDone = currentLevel?.projects.filter((project) => approvedIds.has(project.id)).length || 0;
  const levelPercent = levelTotal ? Math.round((levelDone / levelTotal) * 100) : 0;
  const next = upcoming[0];
  const nextAt = next ? meetingStart(next).getTime() : 0;
  const yearAgo = now - 200 * 86400000;
  const marks: AttendanceMark[] = past.filter((meeting) => new Date(meeting.meetingDate).getTime() >= yearAgo).map((meeting) => ({
    id: meeting.id,
    meetingDate: meeting.meetingDate,
    title: meeting.title,
    present: (meeting.attendance || []).some((row) => row.present),
    late: (meeting.attendance || []).some((row) => row.late),
    roles: (meeting.agenda || []).map((item) => item.role),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your projects, the next meeting, and how far this level has come.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard featured href="/me/projects" label="Total projects" value={String(allProjects.length)} hint="On your education path" />
        <StatCard href="/me/projects" label="Completed" value={String(completedCount)} hint="Approved by an evaluator" />
        <StatCard href="/me/projects" label="In progress" value={String(runningCount)} hint={runningCount ? "Speech project started" : "None started"} />
        <StatCard
          href="/me/meetings"
          label="Upcoming meeting"
          value={next ? shortDate(next.meetingDate) : "None"}
          hint={next ? `${next.title} · ${next.startTime}` : "No meeting on the calendar"}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Card className="p-4 xl:col-span-6">
          <h2 className="font-medium">Attendance</h2>
          <p className="mb-3 text-xs text-muted-foreground">Last 6 months. Blue is attended, red is missed. Tap a square for the date and your role.</p>
          <AttendanceHeatmap marks={marks} months={6} />
        </Card>

        <Card className="flex flex-col p-4 xl:col-span-3">
          <h2 className="text-sm text-muted-foreground">Current project</h2>
          {activeProject && currentLevel ? (
            <>
              <p className="mt-3 font-serif text-2xl leading-tight text-blue-800">{activeProject.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">Level {currentLevel.number} · {currentLevel.name}</p>
              {activeProject.description && <p className="mt-2 line-clamp-4 text-sm">{activeProject.description}</p>}
              <p className="mt-2 text-xs text-muted-foreground">{speechStarted ? "In progress" : "Available to start"}</p>
              <Button className="mt-auto w-full rounded-full bg-red-700 text-white hover:bg-red-800" asChild>
                <Link href="/me/projects">Open materials</Link>
              </Button>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{levels.length ? "Every project on your path is approved." : "Your path will appear once headquarters publishes the curriculum."}</p>
          )}
        </Card>

        <Card className="p-4 xl:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-medium">This level</h2>
            <Link href="/me/projects" className="text-xs text-blue-800">All projects</Link>
          </div>
          {currentLevel && nextProjects.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {nextProjects.map((project, index) => {
                const started = selectedIds.has(project.id);
                const Icon = index === 0 ? Mic : BookOpen;
                return (
                  <li key={project.id} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${started ? "bg-red-100 text-red-800" : "bg-blue-50 text-blue-800"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{project.title}</p>
                      <p className="text-xs text-muted-foreground">Level {currentLevel.number} · {started ? "In progress" : "Available"}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No projects left in this level.</p>
          )}
        </Card>

        <Card className="p-4 xl:col-span-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-medium">Recent achievements</h2>
            <Link href="/me/certificates" className="text-xs text-blue-800">View all</Link>
          </div>
          {certificates.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {certificates.slice(0, 4).map((certificate) => {
                const score = certificate.memberProject?.score;
                return (
                  <li key={certificate.id} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                      <Award className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{certificate.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {certificate.memberProject?.project?.title || "Club award"} · {when(certificate.issuedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-900">{score != null ? `Score ${score}` : "Earned"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Approved projects and awards, including a Best Role Player certificate, show up here.</p>
          )}
        </Card>

        <Card className="flex flex-col p-4 xl:col-span-3">
          <h2 className="font-medium">Level progress</h2>
          <p className="text-xs text-muted-foreground">{currentLevel ? `Level ${currentLevel.number} · ${currentLevel.name}` : "No level yet"}</p>
          <LevelGauge percent={levelPercent} />
          <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-700" /> Done {levelDone}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-200" /> Left {Math.max(0, levelTotal - levelDone)}</span>
          </div>
        </Card>

        <div className="flex flex-col justify-between rounded-2xl bg-red-800 p-4 text-white shadow-sm xl:col-span-3">
          <div>
            <h2 className="text-sm text-red-100">Next meeting</h2>
            {speechStarted && next ? (
              <>
                <p className="mt-4 font-serif text-4xl tabular-nums tracking-tight">{countdown(nextAt, now)}</p>
                <p className="mt-2 text-sm text-red-100">{next.title}</p>
                <p className="text-sm text-red-200">{when(next.meetingDate)} · {next.startTime}{next.endTime ? `–${next.endTime}` : ""}</p>
                {next.place && <p className="text-xs text-red-200/80">{next.place}</p>}
              </>
            ) : speechStarted ? (
              <>
                <p className="mt-4 font-serif text-2xl leading-tight">No meeting scheduled</p>
                <p className="mt-2 text-sm text-red-100">You started {activeProject?.title}. The countdown appears when the club sets the next meeting.</p>
              </>
            ) : (
              <>
                <p className="mt-4 font-serif text-2xl leading-tight">Timer waits</p>
                <p className="mt-2 text-sm text-red-100">Start a speech project and this shows the time until your next meeting.</p>
              </>
            )}
          </div>
          <Button className="mt-4 w-full rounded-full bg-white text-red-900 hover:bg-red-50" variant="secondary" asChild>
            <Link href="/me/meetings">Open meetings</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, hint, href, featured = false }: { label: string; value: string; hint: string; href: string; featured?: boolean }) {
  return (
    <Link href={href} className={`flex min-h-[8.5rem] flex-col justify-between rounded-2xl border p-4 shadow-sm ${featured ? "border-transparent bg-gradient-to-br from-blue-700 to-blue-900 text-white" : "bg-card hover:bg-muted/40"}`}>
      <span className="flex items-start justify-between gap-2">
        <span className={`text-sm ${featured ? "text-blue-100" : "text-muted-foreground"}`}>{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${featured ? "border-white/30" : "border-border"}`}>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </span>
      <span>
        <span className="block font-serif text-3xl leading-none">{value}</span>
        <span className={`mt-2 block text-xs ${featured ? "text-blue-100" : "text-muted-foreground"}`}>{hint}</span>
      </span>
    </Link>
  );
}

function LevelGauge({ percent }: { percent: number }) {
  const radius = 68;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);
  return (
    <div className="relative mx-auto mt-2 h-40 w-40">
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="90" cy="90" r={radius} fill="none" strokeWidth={stroke} className="stroke-red-100" />
        <circle cx="90" cy="90" r={radius} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="stroke-blue-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-serif text-4xl leading-none">{percent}%</p>
        <p className="mt-1 text-xs text-muted-foreground">This level</p>
      </div>
    </div>
  );
}
