"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export type DateRange = { from: string; to: string; label: string };

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function quarterBounds(offset: 0 | -1) {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + offset;
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
  return { start, end: end > now ? now : end };
}

export const RANGE_PRESETS: { id: string; label: string; make: () => DateRange }[] = [
  { id: "30", label: "30 days", make: () => ({ from: iso(daysAgo(30)), to: iso(new Date()), label: "Last 30 days" }) },
  { id: "60", label: "60 days", make: () => ({ from: iso(daysAgo(60)), to: iso(new Date()), label: "Last 60 days" }) },
  { id: "90", label: "90 days", make: () => ({ from: iso(daysAgo(90)), to: iso(new Date()), label: "Last 90 days" }) },
  { id: "quarter", label: "This quarter", make: () => { const { start, end } = quarterBounds(0); return { from: iso(start), to: iso(end), label: "This quarter" }; } },
  { id: "last-quarter", label: "Last quarter", make: () => { const { start, end } = quarterBounds(-1); return { from: iso(start), to: iso(end), label: "Last quarter" }; } },
  { id: "ytd", label: "Year to date", make: () => ({ from: iso(new Date(new Date().getFullYear(), 0, 1)), to: iso(new Date()), label: "Year to date" }) },
];

export function defaultRange() {
  return RANGE_PRESETS.find((preset) => preset.id === "ytd")?.make() ?? RANGE_PRESETS[2].make();
}

export function rangeQuery(range: DateRange) {
  return `from=${range.from}&to=${range.to}`;
}

/**
 * Preset chips plus custom from/to dates. One picker drives every chart and stat on the page,
 * so quarter-over-quarter comparisons use the same window everywhere.
 */
export function DateRangePicker({ value, onChange, compact = false }: { value: DateRange; onChange: (range: DateRange) => void; compact?: boolean }) {
  const [custom, setCustom] = useState(false);
  const activePreset = RANGE_PRESETS.find((preset) => { const made = preset.make(); return made.from === value.from && made.to === value.to; })?.id;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {RANGE_PRESETS.filter((preset) => !compact || ["30", "60", "90"].includes(preset.id)).map((preset) => (
          <button key={preset.id} type="button" className={`rounded-full border px-3 py-1 text-xs ${activePreset === preset.id && !custom ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`} onClick={() => { setCustom(false); onChange(preset.make()); }}>
            {preset.label}
          </button>
        ))}
        <button type="button" className={`rounded-full border px-3 py-1 text-xs ${custom || !activePreset ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`} onClick={() => setCustom((open) => !open)}>
          Custom
        </button>
      </div>
      {(custom || !activePreset) && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <label className="flex items-center gap-1">From<Input type="date" className="h-9 w-40" value={value.from} max={value.to} onChange={(event) => onChange({ from: event.target.value, to: value.to, label: "Custom range" })} /></label>
          <label className="flex items-center gap-1">To<Input type="date" className="h-9 w-40" value={value.to} min={value.from} onChange={(event) => onChange({ from: value.from, to: event.target.value, label: "Custom range" })} /></label>
        </div>
      )}
    </div>
  );
}
