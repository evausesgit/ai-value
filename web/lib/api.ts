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

export type CampaignItem = "tools" | "skills" | "usecases" | "checkin";

export interface Campaign {
  id: number;
  title: string;
  message: string;
  team_ids: number[];
  items: CampaignItem[];
  opens_at: string | null;
  closes_on: string;
  open: boolean;
  author: string | null;
  // liste côté demandeur
  targeted?: number;
  respondents?: number;
  can_manage?: boolean;
  // côté participant
  me?: {
    done_items: CampaignItem[];
    completed_at: string | null;
    usage_level: number | null;
    satisfaction: number | null;
    blockers: string[];
    comment: string;
  } | null;
}

export interface CampaignSummary {
  targeted: number;
  respondents: number;
  participation: number | null;
  adoption_pct: number | null;
  active_tools_avg: number | null;
  skills_avg: number | null;
  skills: Record<string, number | null>;
  usecases: number;
  hours_saved: number;
  hours_saved_avg: number | null;
  satisfaction: number | null;
  usage_level: number | null;
  checkin_respondents: number;
  blockers: { blocker: string; count: number }[] | null;
  tools: { tool: string; active: number }[] | null;
  comments?: string[] | null;
}

export interface EvolutionPoint {
  id: number;
  title: string;
  date: string;
  open: boolean;
  targeted: number;
  respondents: number;
  participation: number | null;
  adoption_pct: number | null;
  skills_avg: number | null;
  hours_saved: number;
  hours_saved_avg: number | null;
  satisfaction: number | null;
}

export interface ScopeStats {
  members: number;
  adoption: {
    active_pct: number | null;
    explorers_pct: number | null;
    active: number;
    tools: { tool: string; daily: number; weekly: number; monthly: number; tried: number; active: number }[];
  };
  skills: {
    domains: { domain: string; avg: number | null; n: number; dist: number[] }[];
    avg: number | null;
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
  evolution: EvolutionPoint[];
  feeling: {
    campaign: string;
    date: string;
    respondents: number;
    satisfaction: number | null;
    usage_level: number | null;
    blockers: { blocker: string; count: number }[] | null;
    comments: string[] | null;
  } | null;
  feedback: { by_status: Record<string, number>; by_kind: Record<string, number> };
}
