// Appels relatifs : ils passent par le relais Next (/api → FastAPI).
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (res.status === 401 && !path.startsWith("/auth/")) {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
    throw new ApiError(401, "Connexion requise.");
  }
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") msg = data.detail;
      else if (Array.isArray(data.detail)) msg = "Certains champs sont invalides.";
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

// --- Types partagés --------------------------------------------------------

export type Role = "member" | "lead" | "manager" | "admin";

export interface Me {
  id: number;
  email: string;
  name: string;
  job: string;
  role: Role;
  is_superadmin: boolean;
  org: { id: number; name: string };
  team: { id: number; name: string } | null;
}

export interface Tool {
  id: number;
  name: string;
  category: string;
}

export interface Team {
  id: number;
  name: string;
  members: number;
}

export interface UseCase {
  id: number;
  title: string;
  category: string;
  problem: string;
  tools: string[];
  minutes_saved_per_week: number;
  risk: "low" | "medium" | "high";
  status: "published" | "validated";
  author: string | null;
  team: string | null;
  created_at: string | null;
  likes: number;
  adopters: number;
  liked: boolean;
  adopted: boolean;
  // détail seulement
  solution?: string;
  prompt?: string;
  can_edit?: boolean;
  can_validate?: boolean;
  mine?: boolean;
}

export interface Pulse {
  week: string;
  usage_level: number;
  hours_saved: number;
  satisfaction: number;
  blockers: string[];
  comment: string;
}

export interface FeedbackItem {
  id: number;
  kind: string;
  text: string;
  status: "new" | "in_progress" | "done";
  response: string;
  team: string | null;
  author: string | null;
  anonymous: boolean;
  created_at: string | null;
}

export interface TrendPoint {
  week: string;
  respondents: number;
  participation: number | null;
  intensity: number | null;
  using_pct: number | null;
  satisfaction: number | null;
  hours_saved: number | null;
}

export interface ScopeStats {
  members: number;
  adoption: {
    active_pct: number | null;
    explorers_pct: number | null;
    active: number;
    tools: { tool: string; daily: number; weekly: number; monthly: number; tried: number; active: number }[];
  };
  pulse: {
    reference_week: string;
    participation: number | null;
    intensity: number | null;
    using_pct: number | null;
    satisfaction: number | null;
    hours_saved: number | null;
    trend: TrendPoint[];
    blockers: { blocker: string; count: number }[] | null;
    comments: { week: string; text: string }[] | null;
  };
  skills: {
    domains: { domain: string; avg: number | null; n: number; dist: number[] }[];
    assessed_pct: number | null;
    quiz_avg_pct: number | null;
    quiz_participants: number;
  };
  usecases: {
    count: number;
    validated: number;
    last_30_days: number;
    contributors: number;
    hours_saved_per_week: number;
    top: { id: number; title: string; category: string; adopters: number; author: string | null }[];
  };
  feedback: { by_status: Record<string, number>; by_kind: Record<string, number> };
}
