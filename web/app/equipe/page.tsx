"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ScopeDashboard from "@/components/ScopeDashboard";
import { api, type ScopeStats } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

interface TeamStats extends ScopeStats {
  team: { id: number; name: string };
  teams: { id: number; name: string }[];
  roster: {
    id: number;
    name: string;
    job: string;
    role: string;
    campaigns: number;
    assessed: boolean;
    active_tools: number;
    usecases: number;
    quiz_pct: number | null;
  }[];
}

export default function TeamPage() {
  return (
    <Suspense>
      <Team />
    </Suspense>
  );
}

function Team() {
  const { me } = useSession();
  const { m } = useI18n();
  const d = m.dash;
  const params = useSearchParams();
  const [teamId, setTeamId] = useState<number | null>(Number(params.get("team")) || null);
  const [data, setData] = useState<TeamStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!me) return;
    const qs = teamId ? `?team_id=${teamId}` : "";
    api<TeamStats>(`/dashboard/team${qs}`)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError((e as Error).message));
  }, [me, teamId]);

  if (error && !data)
    return (
      <main className="page">
        <h1>{d.myTeam}</h1>
        <div className="card empty">
          {me && !me.team ? d.noTeam : error}
        </div>
      </main>
    );
  if (!data) return <main className="page muted">{m.common.loading}</main>;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{d.teamTitle(data.team.name)}</h1>
          <p className="sub">
            {d.teamSubtitle(data.members)}
          </p>
        </div>
        {data.teams.length > 1 ? (
          <select value={data.team.id} onChange={(e) => setTeamId(Number(e.target.value))} style={{ width: "auto" }}>
            {data.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <ScopeDashboard s={data} scopeLabel={d.ofTeam} />

      <div className="card section">
        <div className="card-head">
          <h2>{d.roster}</h2>
          <span className="muted small">{d.rosterHint}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{d.colName}</th>
                <th>{d.colJob}</th>
                <th className="num">{d.colAnswered}</th>
                <th>{d.colAssessed}</th>
                <th className="num">{d.colActiveTools}</th>
                <th className="num">{d.colUseCases}</th>
                <th className="num">{d.colQuiz}</th>
              </tr>
            </thead>
            <tbody>
              {data.roster.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.name} {r.role !== "member" ? <span className="pill">{m.catalog.roles[r.role]}</span> : null}
                  </td>
                  <td className="muted">{r.job}</td>
                  <td className="num">{r.campaigns}</td>
                  <td>{r.assessed ? "✓" : <span className="muted">—</span>}</td>
                  <td className="num">{r.active_tools}</td>
                  <td className="num">{r.usecases}</td>
                  <td className="num">{r.quiz_pct === null ? "—" : `${r.quiz_pct} %`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
