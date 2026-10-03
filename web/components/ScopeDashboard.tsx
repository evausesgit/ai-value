"use client";

// Bloc commun aux tableaux de bord équipe et organisation (mêmes définitions,
// cf. app/api/dashboards.py) : état actuel en direct + évolution par campagne.

import Link from "next/link";
import { useState } from "react";
import { BarList, Delta, Kpi, ToolBars, TrendChart } from "@/components/charts";
import type { EvolutionPoint, ScopeStats } from "@/lib/api";
import { currentLocale, useI18n } from "@/lib/i18n";
import { fmtDay, fmtNum } from "@/lib/catalog";

type Metric = "adoption_pct" | "hours_saved_avg" | "skills_avg" | "satisfaction" | "participation";
const METRICS: { key: Metric; unit: string; digits: number; max?: number }[] = [
  { key: "adoption_pct", unit: " %", digits: 0, max: 100 },
  { key: "hours_saved_avg", unit: " h", digits: 1 },
  { key: "skills_avg", unit: "", digits: 1, max: 3 },
  { key: "satisfaction", unit: "", digits: 1, max: 5 },
  { key: "participation", unit: " %", digits: 0, max: 100 },
];

function shortLabel(e: EvolutionPoint) {
  return new Date(`${e.date}T00:00:00`).toLocaleDateString(currentLocale(), { month: "short", year: "2-digit" });
}

export default function ScopeDashboard({ s, scopeLabel }: { s: ScopeStats; scopeLabel: string }) {
  const { m: t } = useI18n();
  const d = t.dash;
  const [metric, setMetric] = useState<Metric>("adoption_pct");
  const m = METRICS.find((x) => x.key === metric)!;
  const evo = s.evolution;
  // Comparaison : les deux dernières campagnes closes.
  const answered = evo.filter((e) => e.respondents > 0 && !e.open);
  const last = answered[answered.length - 1] ?? null;
  const prev = answered[answered.length - 2] ?? null;
  const current = evo.find((e) => e.open) ?? null;
  const openFeedback = (s.feedback.by_status.new ?? 0) + (s.feedback.by_status.in_progress ?? 0);

  return (
    <>
      {current ? (
        <div className="card" style={{ marginBottom: "1rem", background: "var(--accent-soft)", borderColor: "transparent" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{d.currentCampaign(current.title)}</strong>
              <div className="small">
                {t.common.respondedOf(current.respondents, current.targeted)} ({fmtNum(current.participation)} %)
              </div>
            </div>
            <Link href={`/campagnes/${current.id}`} className="btn small">
              {d.seeResults}
            </Link>
          </div>
        </div>
      ) : null}

      {/* --- État actuel --- */}
      <div className="grid g4">
        <Kpi
          label={d.adoption}
          value={s.adoption.active_pct}
          unit=" %"
          foot={d.adoptionFoot(s.adoption.active, s.members)}
        />
        <Kpi
          label={d.timeSaved}
          value={s.usecases.hours_saved_per_week}
          unit={` h ${t.common.perWeek}`}
          foot={
            <>
              {d.timeSavedFoot}
              {last && prev ? (
                <>
                  {" "}· <Delta now={last.hours_saved_avg} before={prev.hours_saved_avg} unit=" h/pers." digits={1} />
                </>
              ) : null}
            </>
          }
        />
        <Kpi
          label={d.skillsLevel}
          value={s.skills.avg}
          unit=" / 3"
          digits={1}
          foot={
            <>
              {d.assessedPct(fmtNum(s.skills.assessed_pct))}
              {last && prev ? (
                <>
                  {" "}· <Delta now={last.skills_avg} before={prev.skills_avg} digits={1} />
                </>
              ) : null}
            </>
          }
        />
        <Kpi
          label={d.satisfaction}
          value={s.feeling?.satisfaction ?? null}
          unit=" / 5"
          digits={1}
          foot={
            s.feeling
              ? s.feeling.satisfaction === null
                ? t.common.hiddenSmall
                : `${s.feeling.campaign} · ${t.common.answers(s.feeling.respondents)}`
              : d.noCheckinYet
          }
        />
      </div>

      {/* --- Évolution --- */}
      <div className="card section">
        <div className="card-head" style={{ flexWrap: "wrap" }}>
          <h2>{d.evolution}</h2>
          <div className="pills">
            {METRICS.map((x) => (
              <button key={x.key} className={`ghost small ${metric === x.key ? "on" : ""}`} onClick={() => setMetric(x.key)}>
                {d.metrics[x.key]}
              </button>
            ))}
          </div>
        </div>
        {evo.length === 0 ? (
          <div className="empty small">
            {d.noCampaign} <Link href="/campagnes/nouvelle">{d.launchCampaign}</Link>
            {d.noCampaignEnd}
          </div>
        ) : (
          <>
            <TrendChart
              label={d.metrics[m.key]}
              unit={m.unit}
              digits={m.digits}
              max={m.max}
              points={evo.map((e) => ({
                key: String(e.id),
                label: shortLabel(e),
                title: `${e.title}${e.open ? d.inProgress : ""}`,
                value: e[metric],
                note: `${t.common.respondedOf(e.respondents, e.targeted)} · ${fmtDay(e.date)}`,
              }))}
            />
            <p className="muted tiny" style={{ margin: "0.5rem 0 0" }}>
              {d.evolutionNote}
            </p>
          </>
        )}
      </div>

      <div className="grid g2 section">
        <div className="card">
          <div className="card-head">
            <h2>{d.toolsUsed}</h2>
            <span className="muted small">{d.explorers(fmtNum(s.adoption.explorers_pct))}</span>
          </div>
          <ToolBars rows={s.adoption.tools.slice(0, 10)} members={s.members} />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>{d.blockers}</h2>
            <span className="muted small">{s.feeling ? s.feeling.campaign : ""}</span>
          </div>
          {!s.feeling ? (
            <div className="empty small">{d.askCheckin}</div>
          ) : s.feeling.blockers === null ? (
            <div className="empty small">{t.common.hiddenSmallDot}</div>
          ) : (
            <BarList rows={s.feeling.blockers.map((b) => ({ label: t.catalog.blockers[b.blocker] ?? b.blocker, value: b.count }))} format={(v) => `${v}`} />
          )}
        </div>
      </div>

      {/* --- Connaissances --- */}
      <div className="grid g2 section">
        <div className="card">
          <div className="card-head">
            <h2>{d.skillsOf(scopeLabel)}</h2>
            <span className="muted small">{d.assessedPct(fmtNum(s.skills.assessed_pct))}</span>
          </div>
          <SkillDistribution domains={s.skills.domains} />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>{d.quiz}</h2>
          </div>
          <div className="grid g2">
            <div className="kpi">
              <div className="label">{d.quizAvg}</div>
              <div className="value">
                {fmtNum(s.skills.quiz_avg_pct)}
                {s.skills.quiz_avg_pct !== null ? <span className="unit"> %</span> : null}
              </div>
            </div>
            <div className="kpi">
              <div className="label">{d.participants}</div>
              <div className="value">
                {s.skills.quiz_participants}
                <span className="unit"> / {s.members}</span>
              </div>
            </div>
          </div>
          <h3 style={{ marginTop: "1rem" }}>{d.toStrengthen}</h3>
          <BarList
            rows={[...s.skills.domains]
              .filter((d) => d.avg !== null)
              .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
              .slice(0, 3)
              .map((x) => ({ label: t.catalog.domains[x.domain]?.label ?? x.domain, value: x.avg ?? 0 }))}
            max={3}
            format={(v) => `${fmtNum(v, 1)} / 3`}
          />
        </div>
      </div>

      {/* --- Use cases et feedback --- */}
      <div className="grid g2 section">
        <div className="card">
          <div className="card-head">
            <h2>{d.useCases}</h2>
            <Link href="/usages" className="small">
              {d.catalog}
            </Link>
          </div>
          <div className="grid g3" style={{ marginBottom: "1rem" }}>
            <div className="kpi">
              <div className="label">{d.shared}</div>
              <div className="value">{s.usecases.count}</div>
              <div className="foot">{d.inLast30(s.usecases.last_30_days)}</div>
            </div>
            <div className="kpi">
              <div className="label">{d.contributors}</div>
              <div className="value">{s.usecases.contributors}</div>
              <div className="foot">{d.validated(s.usecases.validated)}</div>
            </div>
            <div className="kpi">
              <div className="label">{d.timeSaved}</div>
              <div className="value">
                {fmtNum(s.usecases.hours_saved_per_week)}
                <span className="unit"> h {t.common.perWeek}</span>
              </div>
              <div className="foot">{d.authorsAdopters}</div>
            </div>
          </div>
          <h3>{d.mostAdopted}</h3>
          {s.usecases.top.length ? (
            <table>
              <tbody>
                {s.usecases.top.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/usages/${u.id}`}>{u.title}</Link>
                      <div className="muted tiny">
                        {t.catalog.categories[u.category]} · {u.author}
                      </div>
                    </td>
                    <td className="num" title={t.usecases.adoptersTitle}>
                      👥 {u.adopters}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty small">{d.noUseCase}</div>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>{d.feedback}</h2>
            <Link href="/feedback" className="small">
              {d.inbox}
            </Link>
          </div>
          <div className="grid g3" style={{ marginBottom: "1rem" }}>
            {(["new", "in_progress", "done"] as const).map((k) => (
              <div className="kpi" key={k}>
                <div className="label">{t.catalog.feedbackStatuses[k]}</div>
                <div className="value">{s.feedback.by_status[k] ?? 0}</div>
              </div>
            ))}
          </div>
          {openFeedback ? (
            <p className="small">
              {d.awaiting(openFeedback)}
            </p>
          ) : null}
          <h3>{d.verbatims} {s.feeling ? `— ${s.feeling.campaign}` : ""}</h3>
          {!s.feeling ? (
            <div className="empty small">{d.noCheckin}</div>
          ) : s.feeling.comments === null ? (
            <div className="empty small">{t.common.hiddenSmallDot}</div>
          ) : s.feeling.comments.length === 0 ? (
            <div className="empty small">{d.noComment}</div>
          ) : (
            <ul style={{ paddingLeft: "1.1rem", margin: 0 }}>
              {s.feeling.comments.slice(0, 6).map((c, i) => (
                <li key={i} className="small" style={{ marginBottom: "0.4rem" }}>
                  « {c} »
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

const DIST_COLORS = ["var(--seq-100)", "var(--seq-300)", "var(--seq-500)", "var(--seq-700)"];

/** Répartition des niveaux par domaine : barres 100 % empilées (rampe ordinale). */
function SkillDistribution({ domains }: { domains: ScopeStats["skills"]["domains"] }) {
  const { m: t } = useI18n();
  const DOMAINS = t.catalog.domains;
  const SKILL_LEVELS = t.catalog.skillLevels;
  return (
    <>
      <div className="bars">
        {domains.map((d) => {
          const total = d.dist.reduce((a, b) => a + b, 0);
          return (
            <div
              className="bar-row"
              key={d.domain}
              title={`${DOMAINS[d.domain]?.label} — ${d.dist.map((n, i) => `${SKILL_LEVELS[i]} : ${n}`).join(", ")}`}
            >
              <span className="name">{DOMAINS[d.domain]?.label ?? d.domain}</span>
              <span className="bar-track">
                {total === 0 ? (
                  <span className="bar-seg" style={{ width: "100%", background: "var(--seq-empty)" }} />
                ) : (
                  d.dist.map((n, i) =>
                    n > 0 ? <span key={i} className="bar-seg" style={{ width: `${(100 * n) / total}%`, background: DIST_COLORS[i] }} /> : null,
                  )
                )}
              </span>
              <span className="val">{d.avg === null ? "—" : `${fmtNum(d.avg, 1)}`}</span>
            </div>
          );
        })}
      </div>
      <div className="legend">
        {SKILL_LEVELS.map((l, i) => (
          <span key={l}>
            <i style={{ background: DIST_COLORS[i] }} />
            {l}
          </span>
        ))}
        <span className="muted">{t.dash.levelLegend}</span>
      </div>
    </>
  );
}
