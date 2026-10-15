"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Shared channel for the three dashboard panels (sidebar, main content, activity rail).
 * Each panel owns its own scroll and data; this is the only thing they share.
 *
 * - `days` is the 30/60/90 reporting range. Pages that report over time read it; pages that do not never touch it.
 * - `alertCount` is published by the activity rail and read by the frame for the mobile bell badge.
 * - `emit` / `subscribe` let one panel tell the others that data changed, without importing each other.
 */

export type RangeDays = 30 | 60 | 90;
export type BusEvent = "club:changed" | "announcement:sent" | "meeting:changed" | "committee:changed" | "members:changed";

type Handler = (event: BusEvent) => void;

type Bus = {
  days: RangeDays;
  setDays: (days: RangeDays) => void;
  alertCount: number;
  setAlertCount: (count: number) => void;
  emit: (event: BusEvent) => void;
  subscribe: (handler: Handler) => () => void;
};

const DashboardContext = createContext<Bus>({
  days: 90,
  setDays: () => undefined,
  alertCount: 0,
  setAlertCount: () => undefined,
  emit: () => undefined,
  subscribe: () => () => undefined,
});

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [days, setDays] = useState<RangeDays>(90);
  const [alertCount, setAlertCount] = useState(0);
  const handlers = useRef(new Set<Handler>());

  const emit = useCallback((event: BusEvent) => {
    for (const handler of handlers.current) handler(event);
  }, []);

  const subscribe = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => { handlers.current.delete(handler); };
  }, []);

  const value = useMemo(() => ({ days, setDays, alertCount, setAlertCount, emit, subscribe }), [days, alertCount, emit, subscribe]);
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardBus() {
  return useContext(DashboardContext);
}

/** Reporting range shared by every page that reports over time. */
export function useClubRange() {
  const { days, setDays } = useDashboardBus();
  return { days, setDays };
}

/** Run `handler` when any other panel announces a change. */
export function useBusEvent(events: BusEvent[] | "*", handler: Handler) {
  const { subscribe } = useDashboardBus();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => subscribe((event) => {
    if (events === "*" || events.includes(event)) latest.current(event);
  }), [events, subscribe]);
}

/** Pill selector for the reporting range. Render it only on pages whose numbers depend on the range. */
export function RangeToggle({ className = "" }: { className?: string }) {
  const { days, setDays } = useClubRange();
  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
      <span className="text-muted-foreground">Range</span>
      {([30, 60, 90] as RangeDays[]).map((value) => (
        <button key={value} type="button" className={`rounded-full border px-3 py-1 ${days === value ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setDays(value)}>
          {value} days
        </button>
      ))}
    </div>
  );
}
