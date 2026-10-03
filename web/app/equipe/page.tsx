"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ScopeDashboard from "@/components/ScopeDashboard";
import { api, type ScopeStats } from "@/lib/api";
import { ROLES } from "@/lib/catalog";
import { useSession } from "@/lib/session";

interface TeamStats extends ScopeStats {
  team: { id: number; name: string };
  teams: { id: number; name: string }[];
  roster: {
    id: number;
    name: string;
    job: string;
    role: string;
    pulses_4w: number;
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
        <h1>Mon équipe</h1>
        <div className="card empty">
          {me && !me.team ? "Tu n'es rattaché·e à aucune équipe. Choisis-en une depuis l'Organisation ou demande à ton admin." : error}
        </div>
      </main>
    );
  if (!data) return <main className="page muted">Chargement…</main>;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Équipe {data.team.name}</h1>
          <p className="sub">
            {data.members} membre{data.members > 1 ? "s" : ""} · adoption, connaissances et retours de l&apos;équipe
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

      <ScopeDashboard s={data} scopeLabel="de l'équipe" />

      <div className="card section">
        <div className="card-head">
          <h2>Membres</h2>
          <span className="muted small">Activité uniquement — les réponses au pulse restent anonymes</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Métier</th>
                <th className="num">Pulses (4 sem.)</th>
                <th className="num">Outils actifs</th>
                <th className="num">Use cases</th>
                <th className="num">Quiz</th>
              </tr>
            </thead>
            <tbody>
              {data.roster.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.name} {r.role !== "member" ? <span className="pill">{ROLES[r.role]}</span> : null}
                  </td>
                  <td className="muted">{r.job}</td>
                  <td className="num">{r.pulses_4w} / 4</td>
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
