"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { SessionUser } from "./types";

type SessionState = { user: SessionUser | null; loading: boolean; refresh: () => Promise<void> };

const SessionContext = createContext<SessionState>({ user: null, loading: true, refresh: async () => undefined });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await api<{ user: SessionUser }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return <SessionContext.Provider value={{ user, loading, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
