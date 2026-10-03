"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type Me, type Role } from "./api";

interface SessionValue {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<SessionValue>({ me: null, loading: true, refresh: async () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("/auth/me"));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ me, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useSession() {
  return useContext(Ctx);
}

const RANK: Record<Role, number> = { member: 0, lead: 1, manager: 2, admin: 3 };

export function hasRole(me: Me | null, minimum: Role): boolean {
  return !!me && RANK[me.role] >= RANK[minimum];
}
