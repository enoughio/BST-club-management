"use client";

import { useState } from "react";
import { titleCase, when } from "@/lib/format";

export type AttendanceMark = {
  id: string;
  meetingDate: string;
  title: string;
  present: boolean;
  late?: boolean;
  roles: string[];
};

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weeksEndingToday(months: number) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setMonth(start.getMonth() - months);
  const sinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - sinceMonday);
  const columns: Date[][] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(week);
  }
  return columns;
}

export function AttendanceHeatmap({ marks, months = 12 }: { marks: AttendanceMark[]; months?: number }) {
  const [tip, setTip] = useState<string | null>(null);
  const byDay = new Map<string, AttendanceMark[]>();
  marks.forEach((mark) => {
    const key = dayKey(new Date(mark.meetingDate));
    byDay.set(key, [...(byDay.get(key) || []), mark]);
  });
  const columns = weeksEndingToday(months);
  const monthLabels = columns.map((week) => {
    const first = week[0];
    return first.getDate() <= 7 ? first.toLocaleDateString("en-IN", { month: "short" }) : "";
  });

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-max">
          <div className="mb-1 grid grid-flow-col gap-1 text-[10px] text-muted-foreground" style={{ gridTemplateRows: "1rem", gridAutoColumns: "0.8rem" }}>
            {monthLabels.map((label, index) => <span key={index}>{label}</span>)}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridAutoColumns: "0.8rem" }}>
            {columns.flatMap((week) => week.map((date) => {
              const key = dayKey(date);
              const dayMarks = byDay.get(key) || [];
              const attended = dayMarks.some((mark) => mark.present);
              const missed = dayMarks.length > 0 && !attended;
              const future = date.getTime() > Date.now();
              const label = dayMarks.length
                ? dayMarks.map((mark) => `${when(mark.meetingDate)} · ${mark.roles.length ? mark.roles.map((role) => titleCase(role)).join(", ") : attended ? "Attended" : "Absent"}`).join("\n")
                : `${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · No meeting`;
              return (
                <button
                  key={key}
                  type="button"
                  title={label}
                  aria-label={label}
                  className={`h-3.5 w-3.5 rounded-sm ${future ? "bg-transparent" : attended ? "bg-blue-600" : missed ? "bg-red-300" : "bg-muted"}`}
                  onClick={() => setTip(label)}
                  onMouseEnter={() => setTip(label)}
                />
              );
            }))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-muted" /> No meeting</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-300" /> Absent</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-blue-600" /> Attended</span>
        {tip && <span className="text-foreground">{tip}</span>}
      </div>
    </div>
  );
}
