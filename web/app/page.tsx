"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Kpi, Meter } from "@/components/charts";
import { api, type Campaign } from "@/lib/api";
import { DOMAINS, SKILL_LEVELS, fmtDay, fmtMinutes, fmtNum } from "@/lib/catalog";
import { useSession } from "@/lib/session";

interface MeDash {
  pending_campaigns: number;
  tools: { active: number; declared: number };
  skills: { domain: string; mine: number | null; org_avg: number | null }[];
  quiz_avg_pct: number | null;
  quizzes_done: number;
  usecases: { count: number; adopters: number; adopted: number; minutes_saved: number };
  todo: { key: string; done: boolean; label: string }[];
}

const TODO_LINKS: Record<string, string> = {
  tools: "/outils",
  skills: "/competences",
  quiz: "/competences#quiz",
  usecase: "/usages/nouveau",
};

export default function Home() {
  const { me } = useSession();
  const [dash, setDash] = useState<MeDash | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    api<MeDash>("/dashboard/me").then(setDash).catch(() => {});
    api<Campaign[]>("/campaigns/mine").then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  if (!me || !dash) return <main className="page muted">Chargement…</main>;
  const open = (campaigns ?? []).filter((c) => c.open);
  const done = dash.todo.filter((t) => t.done).length;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Bonjour {me.name.split(" ")[0]} 👋</h1>
          <p className="sub">
            {me.team ? `${me.team.name} · ` : ""}
            {me.org.name}
          </p>
        </div>
        <Link href="/usages/nouveau" className="btn">
          + Partager un use case
        </Link>
      </div>

      <div className="grid g3">
        <div className="card span2">
          <div className="card-head">
            <h2>Demandes de mise à jour</h2>
            {open.length ? <span className="pill blue">{open.filter((c) => !c.me?.completed_at).length} à faire</span> : null}
          </div>
          {campaigns === null ? (
            <p className="muted">Chargement…</p>
          ) : open.length === 0 ? (
            <div>
              <p className="muted" style={{ marginBottom: "0.75rem" }}>
                Aucune demande en cours. Tu peux mettre ton profil à jour quand tu veux : tes outils, ton auto-évaluation, tes use cases.
              </p>
              <div className="row">
                <Link href="/outils" className="btn ghost small">
                  Mes outils
                </Link>
                <Link href="/competences" className="btn ghost small">
                  Mon auto-évaluation
                </Link>
                <Link href="/usages?mine=1" className="btn ghost small">
                  Mes use cases
                </Link>
                <Link href="/feedback" className="btn ghost small">
                  Donner un feedback
                </Link>
              </div>
            </div>
          ) : (
            open.map((c) => {
              const doneItems = c.me?.done_items.length ?? 0;
              const sent = !!c.me?.completed_at;
              return (
                <div key={c.id} style={{ padding: "0.75rem 0", borderTop: "1px solid var(--grid)" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <strong>{c.title}</strong>
                      <div className="muted small">
                        Demandé par {c.author ?? "—"} · avant le {fmtDay(c.closes_on)}
                      </div>
                    </div>
                    <Link href={`/campagnes/${c.id}`} className={`btn ${sent ? "ghost" : ""} small`}>
                      {sent ? "✓ Envoyée — modifier" : doneItems ? "Continuer" : "Faire ma mise à jour"}
                    </Link>
                  </div>
                  {!sent ? (
                    <div style={{ marginTop: "0.5rem" }}>
                      <Meter value={doneItems} max={c.items.length} />
                      <div className="muted tiny" style={{ marginTop: "0.25rem" }}>
                        {doneItems} / {c.items.length} étapes · environ 5 minutes
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Pour bien démarrer</h2>
            <span className="pill blue">
              {done}/{dash.todo.length}
            </span>
          </div>
          <ul className="todo">
            {dash.todo.map((t) => (
              <li key={t.key} className={t.done ? "done" : ""}>
                <span className="tick">{t.done ? "✓" : ""}</span>
                {t.done ? <span className="txt">{t.label}</span> : <Link href={TODO_LINKS[t.key]}>{t.label}</Link>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid g4 section">
        <Kpi
          label="Temps gagné grâce à l'IA"
          value={dash.usecases.minutes_saved / 60}
          digits={1}
          unit=" h/sem."
          foot={dash.usecases.minutes_saved ? `${fmtMinutes(dash.usecases.minutes_saved)} via tes use cases et ceux que tu as adoptés` : "Partage tes use cases pour le mesurer"}
        />
        <Kpi
          label="Outils IA utilisés"
          value={dash.tools.active}
          foot={<Link href="/outils">{dash.tools.declared ? "Mettre à jour mes outils" : "Déclarer mes outils"}</Link>}
        />
        <Kpi
          label="Use cases partagés"
          value={dash.usecases.count}
          foot={`${dash.usecases.adopters} personne${dash.usecases.adopters > 1 ? "s les ont adoptés" : " l'a adopté"} · ${dash.usecases.adopted} adopté${dash.usecases.adopted > 1 ? "s" : ""}`}
        />
        <Kpi label="Score moyen aux quiz" value={dash.quiz_avg_pct} unit=" %" foot={`${dash.quizzes_done} quiz réalisé${dash.quizzes_done > 1 ? "s" : ""}`} />
      </div>

      <div className="card section">
        <div className="card-head">
          <h2>Mes compétences</h2>
          <Link href="/competences" className="small">
            M&apos;auto-évaluer →
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Domaine</th>
                <th>Mon niveau</th>
                <th style={{ width: "30%" }} />
                <th className="num">Moyenne de l&apos;organisation</th>
              </tr>
            </thead>
            <tbody>
              {dash.skills.map((s) => (
                <tr key={s.domain}>
                  <td>{DOMAINS[s.domain]?.label ?? s.domain}</td>
                  <td>{s.mine === null ? <span className="muted">Non évalué</span> : SKILL_LEVELS[s.mine]}</td>
                  <td>
                    <Meter value={s.mine} max={3} />
                  </td>
                  <td className="num">{s.org_avg === null ? "—" : `${fmtNum(s.org_avg, 1)} / 3`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
