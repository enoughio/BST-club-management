"use client";

import { Card } from "@/components/ui/card";
import { titleCase } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const FILLS = ["#1e3a5f", "#c4a574", "#6b7280", "#8f3d3d"];

export type OrgAnalytics = {
  memberGrowth?: { month: string; joined: number }[];
  clubStatus?: { status: string; count: number }[];
  meetingActivity?: { month: string; meetings: number }[];
  retention?: { active: number; former: number; rate: number };
  dues?: { paid: number; unpaid: number; waived: number; paidRatio: number };
  clubComparison?: { id: string; name: string; members: number; attendanceAverage: number; duesPaidRatio: number; growth: number }[];
};

function rows<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function ChartPanel({ title, caption, empty, children }: { title: string; caption?: string; empty: boolean; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="font-serif text-xl">{title}</h2>
      {caption && <p className="mt-1 text-sm text-muted-foreground">{caption}</p>}
      {empty ? (
        <p className="flex h-48 items-center text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="mt-3 h-64 w-full min-w-0">{children}</div>
      )}
    </Card>
  );
}

function Axis({ dataKey = "month" }: { dataKey?: string }) {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={dataKey} tick={{ fontSize: 12 }} />
      <YAxis allowDecimals={false} width={36} />
      <Tooltip />
    </>
  );
}

export function OrgAnalyticsCharts({ data, showComparison = false }: { data: OrgAnalytics | null; showComparison?: boolean }) {
  const growth = rows(data?.memberGrowth);
  const clubs = rows(data?.clubStatus).map((row) => ({ ...row, label: titleCase(row.status) }));
  const meetings = rows(data?.meetingActivity);
  const retention = data?.retention;
  const dues = data?.dues;
  const comparison = rows(data?.clubComparison);
  const retentionSlices = retention ? [{ name: "Active", value: retention.active }, { name: "Former", value: retention.former }] : [];
  const duesSlices = dues
    ? [
        { name: "Paid", value: dues.paid },
        { name: "Unpaid", value: dues.unpaid },
        { name: "Waived", value: dues.waived },
      ]
    : [];
  const comparisonChart = comparison.map((row) => ({
    name: row.name,
    members: row.members,
    growth: row.growth,
    attendance: Math.round((row.attendanceAverage || 0) * 100),
    duesPaid: Math.round((row.duesPaidRatio || 0) * 100),
  }));

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <ChartPanel title="Member growth" caption="New memberships by month." empty={growth.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={growth}>
            <Axis />
            <Bar dataKey="joined" fill="#1e3a5f" name="Joined" />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Club status" caption="Active, inactive, and provisional clubs." empty={clubs.length === 0 || clubs.every((row) => row.count === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={clubs} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={88}>
              {clubs.map((row, index) => <Cell key={row.status} fill={FILLS[index % FILLS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Meeting activity" caption="Completed meetings by month." empty={meetings.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={meetings}>
            <Axis />
            <Bar dataKey="meetings" fill="#c4a574" name="Meetings" />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Retention" caption={retention ? `${percent(retention.rate)} of memberships are still active.` : undefined} empty={retentionSlices.length === 0 || retentionSlices.every((row) => row.value === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={retentionSlices} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88}>
              {retentionSlices.map((row, index) => <Cell key={row.name} fill={FILLS[index % FILLS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Dues paid" caption={dues ? `${percent(dues.paidRatio)} of payable invoices are paid.` : undefined} empty={duesSlices.length === 0 || duesSlices.every((row) => row.value === 0)}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={duesSlices} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88}>
              {duesSlices.map((row, index) => <Cell key={row.name} fill={FILLS[index % FILLS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartPanel>
      {showComparison && (
        <div className="flex flex-col gap-4 lg:col-span-2">
          <ChartPanel title="Club comparison" caption="Active members and memberships joined in the last 12 months." empty={comparisonChart.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} height={56} tickFormatter={(value: unknown) => { const label = String(value ?? ""); return label.length > 14 ? `${label.slice(0, 14)}…` : label; }} />
                <YAxis allowDecimals={false} width={36} />
                <Tooltip />
                <Legend />
                <Bar dataKey="members" fill="#1e3a5f" name="Members" />
                <Bar dataKey="growth" fill="#c4a574" name="Growth" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title="Attendance and dues" caption="Attendance average and dues-paid ratio, in percent." empty={comparisonChart.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} height={56} tickFormatter={(value: unknown) => { const label = String(value ?? ""); return label.length > 14 ? `${label.slice(0, 14)}…` : label; }} />
                <YAxis allowDecimals={false} width={36} unit="%" />
                <Tooltip />
                <Legend />
                <Bar dataKey="attendance" fill="#1e3a5f" name="Attendance %" />
                <Bar dataKey="duesPaid" fill="#6b7280" name="Dues paid %" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3">Club</th>
                  <th className="p-3">Members</th>
                  <th className="p-3">Attendance</th>
                  <th className="p-3">Dues paid</th>
                  <th className="p-3">Growth</th>
                </tr>
              </thead>
              <tbody>
                {comparisonChart.length === 0 && (
                  <tr><td className="p-3 text-muted-foreground" colSpan={5}>No clubs to compare yet.</td></tr>
                )}
                {comparisonChart.map((row) => (
                  <tr key={row.name} className="border-t">
                    <td className="p-3">{row.name}</td>
                    <td className="p-3">{row.members}</td>
                    <td className="p-3">{row.attendance}%</td>
                    <td className="p-3">{row.duesPaid}%</td>
                    <td className="p-3">{row.growth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
