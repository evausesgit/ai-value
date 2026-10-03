"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heatmap, Sparkline } from "@/components/charts";
import ScopeDashboard from "@/components/ScopeDashboard";
import { api, type ScopeStats } from "@/lib/api";
import { fmtNum } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";

interface OrgStats extends ScopeStats {
  org: { id: number; name: string };
  teams: {
    id: number;
    name: string;
    members: number;
    adoption_pct: number | null;
    skills_avg: number | null;
    quiz_avg_pct: number | null;
    usecases: number;
    hours_saved: number;
    participation: number | null;
    satisfaction: number | null;
    adoption_trend: (number | null)[];
  }[];
  skills_heatmap: { domains: string[]; rows: { team: string; values: { avg: number | null; n: number }[] }[] };
}

type SortKey = "name" | "members" | "adoption_pct" | "skills_avg" | "hours_saved" | "usecases" | "quiz_avg_pct" | "participation" | "satisfaction";

export default function OrgPage() {
  const { m } = useI18n();
  const d = m.dash;
  const [data, setData] = useState<OrgStats | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "adoption_pct", desc: true });

  useEffect(() => {
    api<OrgStats>("/dashboard/org").then(setData).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <main className="page"><div className="error">{error}</div></main>;
  if (!data) return <main className="page muted">{m.common.loading}</main>;

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
            {d.orgOverview(data.members, data.teams.length)}
          </p>
        </div>
      </div>

      <ScopeDashboard s={data} scopeLabel={d.ofOrg} />

      <div className="card section">
        <div className="card-head">
          <h2>{d.compare}</h2>
          <span className="muted small">{d.sortHint}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {th("name", d.colTeam, false)}
                {th("members", d.colMembers)}
                {th("adoption_pct", d.colAdoption)}
                <th>{d.colCampaigns}</th>
                {th("hours_saved", d.colTime)}
                {th("skills_avg", d.colSkills)}
                {th("usecases", d.colUseCases)}
                {th("quiz_avg_pct", d.colQuiz)}
                {th("participation", d.colParticipation)}
                {th("satisfaction", d.colSatisfaction)}
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
                  <td title={d.adoptionPerCampaign}>
                    <Sparkline values={t.adoption_trend} />
                  </td>
                  <td className="num">{fmtNum(t.hours_saved, 0, ` h ${m.common.perWeek}`)}</td>
                  <td className="num">{fmtNum(t.skills_avg, 1)}</td>
                  <td className="num">{t.usecases}</td>
                  <td className="num">{fmtNum(t.quiz_avg_pct, 0, " %")}</td>
                  <td className="num">{fmtNum(t.participation, 0, " %")}</td>
                  <td className="num" title={t.satisfaction === null ? m.common.hiddenSmall : ""}>
                    {fmtNum(t.satisfaction, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted tiny" style={{ margin: "0.6rem 0 0" }}>
          {d.compareNote}
        </p>
      </div>

      <div className="card section">
        <div className="card-head">
          <h2>{d.skillsMap}</h2>
          <span className="muted small">{d.skillsMapHint}</span>
        </div>
        <Heatmap
          columns={data.skills_heatmap.domains.map((k) => ({ key: k, label: m.catalog.domains[k]?.label ?? k }))}
          rows={data.skills_heatmap.rows.map((r) => ({ label: r.team, values: r.values }))}
        />
      </div>
    </main>
  );
}
