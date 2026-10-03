"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Kpi, Meter } from "@/components/charts";
import { api, type Campaign } from "@/lib/api";
import { fmtDay, fmtMinutes, fmtNum } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";
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
  const { m } = useI18n();
  const [dash, setDash] = useState<MeDash | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    api<MeDash>("/dashboard/me").then(setDash).catch(() => {});
    api<Campaign[]>("/campaigns/mine").then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  if (!me || !dash) return <main className="page muted">{m.common.loading}</main>;
  const open = (campaigns ?? []).filter((c) => c.open);
  const done = dash.todo.filter((t) => t.done).length;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{m.home.hello(me.name.split(" ")[0])}</h1>
          <p className="sub">
            {me.team ? `${me.team.name} · ` : ""}
            {me.org.name}
          </p>
        </div>
        <Link href="/usages/nouveau" className="btn">
          {m.home.shareUseCase}
        </Link>
      </div>

      <div className="grid g3">
        <div className="card span2">
          <div className="card-head">
            <h2>{m.home.requests}</h2>
            {open.length ? <span className="pill blue">{m.home.toDo(open.filter((c) => !c.me?.completed_at).length)}</span> : null}
          </div>
          {campaigns === null ? (
            <p className="muted">{m.common.loading}</p>
          ) : open.length === 0 ? (
            <div>
              <p className="muted" style={{ marginBottom: "0.75rem" }}>
                {m.home.noRequest}
              </p>
              <div className="row">
                <Link href="/outils" className="btn ghost small">
                  {m.home.myTools}
                </Link>
                <Link href="/competences" className="btn ghost small">
                  {m.home.mySelfAssessment}
                </Link>
                <Link href="/usages?mine=1" className="btn ghost small">
                  {m.home.myUseCases}
                </Link>
                <Link href="/feedback" className="btn ghost small">
                  {m.home.giveFeedback}
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
                        {m.home.requestedBy(c.author ?? "—", fmtDay(c.closes_on))}
                      </div>
                    </div>
                    <Link href={`/campagnes/${c.id}`} className={`btn ${sent ? "ghost" : ""} small`}>
                      {sent ? m.home.sentEdit : doneItems ? m.home.continue : m.home.start}
                    </Link>
                  </div>
                  {!sent ? (
                    <div style={{ marginTop: "0.5rem" }}>
                      <Meter value={doneItems} max={c.items.length} />
                      <div className="muted tiny" style={{ marginTop: "0.25rem" }}>
                        {m.home.steps(doneItems, c.items.length)}
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
            <h2>{m.home.gettingStarted}</h2>
            <span className="pill blue">
              {done}/{dash.todo.length}
            </span>
          </div>
          <ul className="todo">
            {dash.todo.map((t) => (
              <li key={t.key} className={t.done ? "done" : ""}>
                <span className="tick">{t.done ? "✓" : ""}</span>
                {t.done ? <span className="txt">{m.home.todo[t.key] ?? t.label}</span> : <Link href={TODO_LINKS[t.key]}>{m.home.todo[t.key] ?? t.label}</Link>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid g4 section">
        <Kpi
          label={m.home.timeSaved}
          value={dash.usecases.minutes_saved / 60}
          digits={1}
          unit={` h ${m.common.perWeek}`}
          foot={dash.usecases.minutes_saved ? m.home.timeSavedFoot(fmtMinutes(dash.usecases.minutes_saved)) : m.home.timeSavedEmpty}
        />
        <Kpi
          label={m.home.toolsUsed}
          value={dash.tools.active}
          foot={<Link href="/outils">{dash.tools.declared ? m.home.updateTools : m.home.declareTools}</Link>}
        />
        <Kpi
          label={m.home.useCasesShared}
          value={dash.usecases.count}
          foot={m.home.useCasesFoot(dash.usecases.adopters, dash.usecases.adopted)}
        />
        <Kpi label={m.home.quizAvg} value={dash.quiz_avg_pct} unit=" %" foot={m.home.quizDone(dash.quizzes_done)} />
      </div>

      <div className="card section">
        <div className="card-head">
          <h2>{m.home.mySkills}</h2>
          <Link href="/competences" className="small">
            {m.home.assessMe}
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{m.home.domain}</th>
                <th>{m.home.myLevel}</th>
                <th style={{ width: "30%" }} />
                <th className="num">{m.home.orgAvg}</th>
              </tr>
            </thead>
            <tbody>
              {dash.skills.map((s) => (
                <tr key={s.domain}>
                  <td>{m.catalog.domains[s.domain]?.label ?? s.domain}</td>
                  <td>{s.mine === null ? <span className="muted">{m.home.notAssessed}</span> : m.catalog.skillLevels[s.mine]}</td>
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
