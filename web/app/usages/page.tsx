"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import RiskPill from "@/components/RiskPill";
import { api, type Team, type UseCase } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function UseCases() {
  const params = useSearchParams();
  const { m } = useI18n();
  const [items, setItems] = useState<UseCase[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [teamId, setTeamId] = useState("");
  const [sort, setSort] = useState("recent");
  const [mine, setMine] = useState(!!params.get("mine"));
  const tool = params.get("tool") ?? "";

  useEffect(() => {
    api<Team[]>("/teams").then(setTeams);
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams({ sort });
    if (q) qs.set("q", q);
    if (category) qs.set("category", category);
    if (teamId) qs.set("team_id", teamId);
    if (tool) qs.set("tool", tool);
    if (mine) qs.set("mine", "true");
    const t = setTimeout(() => {
      api<UseCase[]>(`/usecases?${qs}`).then(setItems);
    }, 200);
    return () => clearTimeout(t);
  }, [q, category, teamId, sort, tool, mine]);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{m.usecases.title}</h1>
          <p className="sub">{m.usecases.subtitle}</p>
        </div>
        <Link href="/usages/nouveau" className="btn">
          {m.usecases.share}
        </Link>
      </div>

      <div className="row" style={{ marginBottom: "1.25rem" }}>
        <input className="grow" placeholder={m.common.search} value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "2 1 220px" }} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: "1 1 160px", width: "auto" }}>
          <option value="">{m.usecases.allCategories}</option>
          {Object.entries(m.catalog.categories).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ flex: "1 1 140px", width: "auto" }}>
          <option value="">{m.usecases.allTeams}</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ flex: "1 1 160px", width: "auto" }}>
          <option value="recent">{m.usecases.sortRecent}</option>
          <option value="popular">{m.usecases.sortPopular}</option>
          <option value="saved">{m.usecases.sortSaved}</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {m.usecases.mine}
        </label>
      </div>
      {tool ? (
        <p>
          <span className="pill blue">{m.usecases.toolFilter(tool)}</span>{" "}
          <Link href="/usages" className="small">
            {m.usecases.removeFilter}
          </Link>
        </p>
      ) : null}

      {items === null ? (
        <p className="muted">{m.common.loading}</p>
      ) : items.length === 0 ? (
        <div className="card empty">
          {m.usecases.empty} <Link href="/usages/nouveau">{m.usecases.beFirst}</Link>
        </div>
      ) : (
        <div className="grid g3">
          {items.map((uc) => (
            <Link key={uc.id} href={`/usages/${uc.id}`} className="card uc-card">
              <div className="pills">
                <span className="pill blue">{m.catalog.categories[uc.category] ?? uc.category}</span>
                {uc.status === "validated" ? <span className="pill good">{m.usecases.validated}</span> : null}
                {uc.risk !== "low" ? <RiskPill risk={uc.risk} /> : null}
              </div>
              <h3>{uc.title}</h3>
              {uc.problem ? (
                <p className="small muted" style={{ margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {uc.problem}
                </p>
              ) : null}
              <div className="uc-meta">
                <span>{uc.team ?? ""}</span>
                <span>{m.usecases.minPerWeek(uc.minutes_saved_per_week)}</span>
                <span title={m.usecases.adoptersTitle}>👥 {uc.adopters}</span>
                <span title={m.usecases.likesTitle}>♥ {uc.likes}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export default function UseCasesPage() {
  return (
    <Suspense>
      <UseCases />
    </Suspense>
  );
}
