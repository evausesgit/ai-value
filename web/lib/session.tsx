"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type Me, type Role } from "./api";
import { useI18n } from "./i18n";

interface SessionValue {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<SessionValue>({ me: null, loading: true, refresh: async () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const { setLang } = useI18n();

  const refresh = useCallback(async () => {
    try {
      const user = await api<Me>("/auth/me");
      setMe(user);
      // La langue du profil l'emporte sur celle du navigateur.
      if (user.lang) setLang(user.lang);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [setLang]);

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
