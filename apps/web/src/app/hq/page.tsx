"use client";

import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DateRangePicker, defaultRange, rangeQuery, RANGE_PRESETS, type DateRange } from "@/components/date-range";
import { PageIntro } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { money, when } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Overview = {
  range: { from: string; to: string; granularity: "week" | "month" };
  clubs: number;
  activeMembers: number;
  completedMeetings: number;
  duesCollectedMinor: number;
  memberGrowth: { month: string; joined: number }[];
  meetingActivity: { month: string; meetings: number }[];
  engagement: { engaged: number; idle: number; rate: number; windowDays: number };
  dues: { collectedMinor: number; outstandingMinor: number; outstandingCount: number };
  topClubs: { byAttendance: ClubRow[]; byGrowth: ClubRow[] };
};
type ClubRow = { id: string; name: string; status: string; members: number; attendanceAverage: number; growth: number; meetings: number; engaged: number };
type Drill = { id: string; title: string; subtitle: string; value: string | number; currency?: string; href: string | null };
type UnpaidClub = { clubId: string; name: string; city: string; status: string; currency: string; outstandingMinor: number; admin: { id: string; name: string; email: string; phone: string | null } | null; members: { invoiceId: string; userId: string; name: string; email: string; phone: string | null; amount: number; createdAt: string }[] };
type Activity = { id: string; at: string; kind: string; title: string; subject: string | null; actor: string; href: string | null };
type DrillKind = "clubs" | "members" | "meetings" | "dues";

const DRILL_TITLES: Record<DrillKind, string> = { clubs: "All clubs", members: "Active members", meetings: "Meetings completed", dues: "Dues collected" };

export default function HqHome() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [stats, setStats] = useState<Overview | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [drill, setDrill] = useState<{ kind: DrillKind; rows: Drill[] } | null>(null);
  const [unpaid, setUnpaid] = useState<UnpaidClub[] | null>(null);
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const [expandedClub, setExpandedClub] = useState<string | null>(null);
  const [adminFor, setAdminFor] = useState<UnpaidClub | null>(null);
  const [topBy, setTopBy] = useState<"attendance" | "growth">("attendance");

  useEffect(() => {
    api<Overview>(`/reports/overview?${rangeQuery(range)}`).then(setStats).catch(() => setStats(null));
  }, [range]);
  useEffect(() => {
    api<{ items: Activity[] }>("/reports/activity?limit=30").then((data) => setActivity(data.items)).catch(() => setActivity([]));
  }, []);

  function openDrill(kind: DrillKind) {
    api<{ rows: Drill[] }>(`/reports/drilldown?kind=${kind}&${rangeQuery(range)}`).then((data) => setDrill({ kind, rows: data.rows })).catch(() => toast.error("Could not load the list"));
  }

  function openUnpaid() {
    setUnpaidOpen(true);
    setAdminFor(null);
    if (!unpaid) api<{ clubs: UnpaidClub[] }>("/reports/unpaid").then((data) => { setUnpaid(data.clubs); setExpandedClub(data.clubs[0]?.clubId || null); }).catch(() => setUnpaid([]));
  }

  const inRange = stats ? `${when(stats.range.from)} – ${when(stats.range.to)}` : "";
  const engagementSlices = stats ? [{ name: "Engaged", value: stats.engagement.engaged }, { name: "Not engaged", value: stats.engagement.idle }] : [];
  const topClubs = stats ? (topBy === "attendance" ? stats.topClubs.byAttendance : stats.topClubs.byGrowth) : [];
  const perBucket = stats?.range.granularity === "week" ? "by Week" : "by Month";

  return (
    <div>
      <PageIntro title="Overview" lede={`Headquarters · ${range.label}`} actions={<DateRangePicker value={range} onChange={setRange} />} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatButton label="Total clubs" value={stats ? String(stats.clubs) : "—"} hint="Every club on the platform. Click for the list." onClick={() => openDrill("clubs")} />
        <StatButton label="Total active members" value={stats ? String(stats.activeMembers) : "—"} hint="People with an active membership right now. Click for the list." onClick={() => openDrill("members")} />
        <StatButton label="Meetings completed" value={stats ? String(stats.completedMeetings) : "—"} hint={`Completed in ${range.label.toLowerCase()}. Click for the list.`} onClick={() => openDrill("meetings")} />
        <StatButton label="Dues collected" value={stats ? money(stats.duesCollectedMinor) : "—"} hint={`Paid in ${range.label.toLowerCase()}. Click for the invoices.`} onClick={() => openDrill("dues")} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button asChild><Link href="/hq/clubs">Add a club</Link></Button>
        <Button variant="outline" asChild><Link href="/hq/removals">Review removals</Link></Button>
        <Button variant="outline" asChild><Link href="/hq/announcements">Send announcement</Link></Button>
        <Button variant="outline" asChild><Link href="/hq/reports">Open reports</Link></Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title={`New Members ${perBucket}`} caption={`Memberships that started between ${inRange}.`} range={range} onRange={setRange} empty={!stats || stats.memberGrowth.every((row) => row.joined === 0)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.memberGrowth || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={32} />
              <Tooltip />
              <Bar dataKey="joined" fill="#1e3a5f" name="New members" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={`Meetings Held ${perBucket}`} caption={`Completed meetings across all clubs between ${inRange}.`} range={range} onRange={setRange} empty={!stats || stats.meetingActivity.every((row) => row.meetings === 0)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.meetingActivity || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={32} />
              <Tooltip />
              <Bar dataKey="meetings" fill="#c4a574" name="Meetings" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="p-4">
          <h2 className="font-serif text-xl">Active Club Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">Active members who attended at least one meeting in the 30 days before {stats ? when(stats.range.to) : "the range end"}, across all clubs.</p>
          {stats && stats.activeMembers > 0 ? (
            <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={engagementSlices} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} startAngle={90} endAngle={-270} stroke="none">
                      <Cell fill="#1e3a5f" />
                      <Cell fill="#e7e0d3" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-serif text-3xl">{Math.round(stats.engagement.rate * 100)}%</span>
                  <span className="text-xs text-muted-foreground">engaged</span>
                </div>
              </div>
              <dl className="grid flex-1 grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Attended recently</dt><dd className="font-serif text-2xl">{stats.engagement.engaged}</dd></div>
                <div><dt className="text-muted-foreground">No meeting in 30 days</dt><dd className="font-serif text-2xl">{stats.engagement.idle}</dd></div>
                <div className="col-span-2 text-xs text-muted-foreground">Members who have not shown up are the first candidates for a reminder from their Club Admin.</div>
              </dl>
            </div>
          ) : <p className="flex h-48 items-center text-sm text-muted-foreground">No active members yet.</p>}
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-serif text-xl">Top Performing Clubs</h2>
              <p className="mt-1 text-sm text-muted-foreground">{topBy === "attendance" ? `Highest attendance at completed meetings in ${range.label.toLowerCase()}.` : `Most new members in ${range.label.toLowerCase()}.`}</p>
            </div>
            <div className="flex gap-1">
              {(["attendance", "growth"] as const).map((key) => (
                <button key={key} type="button" className={`rounded-full border px-3 py-1 text-xs ${topBy === key ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setTopBy(key)}>{key === "attendance" ? "Attendance" : "Growth"}</button>
              ))}
            </div>
          </div>
          <ol className="mt-3 flex flex-col gap-2">
            {topClubs.length === 0 && <li className="text-sm text-muted-foreground">{topBy === "attendance" ? "No completed meetings in this range yet." : "No new members in this range yet."}</li>}
            {topClubs.map((club, index) => (
              <li key={club.id}>
                <Link href={`/hq/clubs/${club.id}`} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif ${index === 0 ? "bg-accent text-accent-foreground" : "bg-muted"}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{club.name}</span>
                    <span className="block text-xs text-muted-foreground">{club.members} active · {club.meetings} meeting{club.meetings === 1 ? "" : "s"} · {club.engaged} engaged</span>
                  </span>
                  <span className="font-serif text-xl">{topBy === "attendance" ? `${Math.round(club.attendanceAverage * 100)}%` : `+${club.growth}`}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-serif text-xl">Dues</h2>
              <p className="mt-1 text-sm text-muted-foreground">All-time totals across every club.</p>
            </div>
            <Button variant="outline" size="sm" onClick={openUnpaid}>View unpaid invoices{stats && stats.dues.outstandingCount > 0 ? ` (${stats.dues.outstandingCount})` : ""}</Button>
          </div>
          {stats && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-sm text-muted-foreground">Total dues collected</p>
                <p className="font-serif text-3xl text-emerald-800">{money(stats.dues.collectedMinor)}</p>
              </div>
              <div className={`rounded-lg border p-4 ${stats.dues.outstandingMinor > 0 ? "border-red-200 bg-red-50/50" : ""}`}>
                <p className="text-sm text-muted-foreground">Total dues outstanding</p>
                <p className={`font-serif text-3xl ${stats.dues.outstandingMinor > 0 ? "text-red-700" : ""}`}>{money(stats.dues.outstandingMinor)}</p>
                <p className="text-xs text-muted-foreground">{stats.dues.outstandingCount} unpaid invoice{stats.dues.outstandingCount === 1 ? "" : "s"}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <section className="mt-6">
        <h2 className="font-serif text-2xl">Recent Activity</h2>
        <p className="mb-3 text-sm text-muted-foreground">System-wide events, newest first.</p>
        <Card className="divide-y p-0">
          {activity.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing recorded yet.</p>}
          {activity.map((item) => {
            const body = (
              <>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotFor(item.kind)}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.title}{item.subject ? <span className="font-normal text-muted-foreground"> · {item.subject}</span> : null}</span>
                  <span className="block text-xs text-muted-foreground">{item.actor} · {new Date(item.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </span>
              </>
            );
            return item.href
              ? <Link key={item.id} href={item.href} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50">{body}</Link>
              : <div key={item.id} className="flex items-start gap-3 px-4 py-3">{body}</div>;
          })}
        </Card>
      </section>

      <Sheet open={Boolean(drill)} onOpenChange={(open) => { if (!open) setDrill(null); }} title={drill ? DRILL_TITLES[drill.kind] : ""}>
        <p className="mb-3 text-sm text-muted-foreground">{drill?.kind === "clubs" || drill?.kind === "members" ? "Current totals." : `${range.label} · ${drill?.rows.length || 0} rows`}</p>
        <div className="flex flex-col gap-2">
          {drill?.rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing in this range.</p>}
          {drill?.rows.map((row) => {
            const content = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{row.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{row.subtitle}</span>
                </span>
                <span className="shrink-0 text-sm">{typeof row.value === "number" ? money(row.value, row.currency) : row.value}</span>
              </>
            );
            return row.href
              ? <Link key={row.id} href={row.href} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50">{content}</Link>
              : <div key={row.id} className="flex items-center gap-3 rounded-lg border p-3">{content}</div>;
          })}
        </div>
      </Sheet>

      <Sheet open={unpaidOpen} onOpenChange={setUnpaidOpen} title={adminFor ? "Club Admin" : "Unpaid invoices"}>
        {adminFor ? (
          <div className="flex flex-col gap-3">
            <button type="button" className="self-start text-sm text-primary" onClick={() => setAdminFor(null)}>← Back to clubs</button>
            <p className="font-serif text-2xl">{adminFor.name}</p>
            <p className="text-sm text-muted-foreground">{adminFor.city} · {money(adminFor.outstandingMinor, adminFor.currency)} outstanding across {adminFor.members.length} member{adminFor.members.length === 1 ? "" : "s"}</p>
            {adminFor.admin ? (
              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Club Admin</p>
                <p className="mt-1 font-medium">{adminFor.admin.name}</p>
                <CopyRow label={adminFor.admin.email} />
                {adminFor.admin.phone && <CopyRow label={adminFor.admin.phone} />}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" asChild><a href={`mailto:${adminFor.admin.email}?subject=${encodeURIComponent(`Outstanding dues at ${adminFor.name}`)}`}>Email the admin</a></Button>
                  <Button size="sm" variant="outline" asChild><Link href={`/hq/clubs/${adminFor.clubId}`}>Open club</Link></Button>
                </div>
              </Card>
            ) : <Card className="p-4 text-sm text-muted-foreground">No Club Admin is appointed. <Link className="text-primary" href={`/hq/clubs/${adminFor.clubId}`}>Appoint one</Link>.</Card>}
            <h3 className="mt-2 font-medium">Members with dues</h3>
            <div className="flex flex-col gap-2">
              {adminFor.members.map((member) => (
                <div key={member.invoiceId} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium">{member.name}</span><span className="block truncate text-xs text-muted-foreground">{member.email}</span></span>
                  <span className="shrink-0 font-medium text-red-700">{money(member.amount, adminFor.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {unpaid === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {unpaid?.length === 0 && <p className="text-sm text-muted-foreground">Every invoice is paid or waived.</p>}
            {unpaid?.map((club) => {
              const open = expandedClub === club.clubId;
              return (
                <div key={club.clubId} className="rounded-lg border">
                  <div className="flex items-center gap-2 p-3">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open} onClick={() => setExpandedClub(open ? null : club.clubId)}>
                      {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{club.name}</span>
                        <span className="block text-xs text-muted-foreground">{club.members.length} member{club.members.length === 1 ? "" : "s"} behind</span>
                      </span>
                    </button>
                    <span className="shrink-0 font-medium text-red-700">{money(club.outstandingMinor, club.currency)}</span>
                    <Button size="sm" variant="outline" onClick={() => setAdminFor(club)}>Admin</Button>
                  </div>
                  {open && (
                    <ul className="divide-y border-t">
                      {club.members.map((member) => (
                        <li key={member.invoiceId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="min-w-0"><span className="block truncate">{member.name}</span><span className="block truncate text-xs text-muted-foreground">Issued {when(member.createdAt)}</span></span>
                          <span className="shrink-0">{money(member.amount, club.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function dotFor(kind: string) {
  if (kind.startsWith("club.create")) return "bg-emerald-600";
  if (kind.startsWith("meeting.finalize")) return "bg-sky-600";
  if (kind.startsWith("meeting.cancel") || kind.startsWith("user.delete") || kind.startsWith("user.freeze") || kind.startsWith("membership.")) return "bg-red-600";
  if (kind.startsWith("club.")) return "bg-amber-500";
  return "bg-stone-400";
}

function StatButton({ label, value, hint, onClick }: { label: string; value: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" title={hint} className="rounded-xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm" onClick={onClick}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-serif text-3xl">{value}</p>
      <p className="mt-1 text-xs text-primary">View list →</p>
    </button>
  );
}

function ChartCard({ title, caption, range, onRange, empty, children }: { title: string; caption: string; range: DateRange; onRange: (range: DateRange) => void; empty: boolean; children: React.ReactNode }) {
  const active = RANGE_PRESETS.find((preset) => { const made = preset.make(); return made.from === range.from && made.to === range.to; })?.id;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          {RANGE_PRESETS.slice(0, 3).map((preset) => (
            <button key={preset.id} type="button" className={`rounded-full border px-2 py-0.5 text-xs ${active === preset.id ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => onRange(preset.make())}>{preset.id}d</button>
          ))}
        </div>
      </div>
      {empty ? <p className="flex h-56 items-center text-sm text-muted-foreground">No data in this range.</p> : <div className="mt-3 h-56 w-full min-w-0">{children}</div>}
    </Card>
  );
}

function CopyRow({ label }: { label: string }) {
  return (
    <div className="mt-1 flex items-center gap-2 text-sm">
      <span className="truncate">{label}</span>
      <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={`Copy ${label}`} onClick={() => { void navigator.clipboard.writeText(label); toast.success("Copied"); }}>
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}