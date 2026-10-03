"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heatmap, Sparkline } from "@/components/charts";
import ScopeDashboard from "@/components/ScopeDashboard";
import { api, type ScopeStats } from "@/lib/api";
import { DOMAINS, fmtNum } from "@/lib/catalog";

interface OrgStats extends ScopeStats {
  org: { id: number; name: string };
  teams: {
    id: number;
    name: string;
    members: number;
    adoption_pct: number | null;
    participation: number | null;
    intensity: number | null;
    satisfaction: number | null;
    hours_saved: number | null;
    usecases: number;
    quiz_avg_pct: number | null;
    adoption_trend: (number | null)[];
  }[];
  skills_heatmap: { domains: string[]; rows: { team: string; values: { avg: number | null; n: number }[] }[] };
}

type SortKey = "name" | "members" | "adoption_pct" | "participation" | "intensity" | "satisfaction" | "hours_saved" | "usecases" | "quiz_avg_pct";

export default function OrgPage() {
  const [data, setData] = useState<OrgStats | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "adoption_pct", desc: true });

  useEffect(() => {
    api<OrgStats>("/dashboard/org").then(setData).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <main className="page"><div className="error">{error}</div></main>;
  if (!data) return <main className="page muted">Chargement…</main>;

  const teams = [...data.teams].sort((a, b) => {
    const va = a[sort.key];
    const vb = b[sort.key];
    if (va === vb) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    const r = va < vb ? -1 : 1;
    return sort.desc ? -r : r;
  });
  const th = (key: SortKey, label: string, num = true) => (
    <th className={num ? "num" : ""} style={{ cursor: "pointer" }} onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : key !== "name" })}>
      {label}
      {sort.key === key ? (sort.desc ? " ▾" : " ▴") : ""}
    </th>
  );

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{data.org.name}</h1>
          <p className="sub">
            Vue d&apos;ensemble · {data.members} personnes · {data.teams.length} équipes
          </p>
        </div>
      </div>

      <ScopeDashboard s={data} scopeLabel="de l'organisation" />

      <div className="card section">
        <div className="card-head">
          <h2>Comparaison des équipes</h2>
          <span className="muted small">Cliquer sur une colonne pour trier</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {th("name", "Équipe", false)}
                {th("members", "Membres")}
                {th("adoption_pct", "Adoption")}
                <th>12 semaines</th>
                {th("participation", "Pulse")}
                {th("intensity", "Intensité")}
                {th("satisfaction", "Satisf.")}
                {th("hours_saved", "Heures")}
                {th("usecases", "Use cases")}
                {th("quiz_avg_pct", "Quiz")}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/equipe?team=${t.id}`}>
                      <strong>{t.name}</strong>
                    </Link>
                  </td>
                  <td className="num">{t.members}</td>
                  <td className="num">{fmtNum(t.adoption_pct, 0, " %")}</td>
                  <td title="Part des répondants utilisant l'IA plusieurs fois par semaine">
                    <Sparkline values={t.adoption_trend} />
                  </td>
                  <td className="num">{fmtNum(t.participation, 0, " %")}</td>
                  <td className="num">{fmtNum(t.intensity, 1)}</td>
                  <td className="num" title={t.satisfaction === null ? "Masqué : moins de 3 réponses" : ""}>
                    {fmtNum(t.satisfaction, 1)}
                  </td>
                  <td className="num">{fmtNum(t.hours_saved, 0, " h")}</td>
                  <td className="num">{t.usecases}</td>
                  <td className="num">{fmtNum(t.quiz_avg_pct, 0, " %")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted tiny" style={{ margin: "0.6rem 0 0" }}>
          Adoption = membres déclarant un outil IA utilisé chaque jour ou chaque semaine. Pulse = participation de la semaine de référence.
        </p>
      </div>

      <div className="card section">
        <div className="card-head">
          <h2>Carte des compétences</h2>
          <span className="muted small">Niveau moyen auto-évalué, par équipe et par domaine</span>
        </div>
        <Heatmap
          columns={data.skills_heatmap.domains.map((d) => ({ key: d, label: DOMAINS[d]?.label ?? d }))}
          rows={data.skills_heatmap.rows.map((r) => ({ label: r.team, values: r.values }))}
        />
      </div>
    </main>
  );
}
