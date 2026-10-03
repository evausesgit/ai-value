"use client";

// Bloc commun aux tableaux de bord équipe et organisation (mêmes définitions,
// cf. app/api/dashboards.py).

import Link from "next/link";
import { useState } from "react";
import { BarList, Delta, Kpi, ToolBars, TrendChart } from "@/components/charts";
import type { ScopeStats } from "@/lib/api";
import { BLOCKERS, CATEGORIES, DOMAINS, FEEDBACK_STATUSES, SKILL_LEVELS, fmtNum, fmtWeek } from "@/lib/catalog";

type Metric = "using_pct" | "participation" | "intensity" | "satisfaction" | "hours_saved";
const METRICS: { key: Metric; label: string; unit: string; digits: number; max?: number }[] = [
  { key: "using_pct", label: "Utilisent l'IA plusieurs fois / sem.", unit: " %", digits: 0, max: 100 },
  { key: "participation", label: "Participation au pulse", unit: " %", digits: 0, max: 100 },
  { key: "intensity", label: "Intensité d'usage (0-4)", unit: "", digits: 1, max: 4 },
  { key: "satisfaction", label: "Satisfaction (1-5)", unit: "", digits: 1, max: 5 },
  { key: "hours_saved", label: "Heures gagnées déclarées", unit: " h", digits: 0 },
];

export default function ScopeDashboard({ s, scopeLabel }: { s: ScopeStats; scopeLabel: string }) {
  const [metric, setMetric] = useState<Metric>("using_pct");
  const m = METRICS.find((x) => x.key === metric)!;
  const trend = s.pulse.trend;
  const refIdx = trend.findIndex((w) => w.week === s.pulse.reference_week);
  const before = refIdx >= 4 ? trend[refIdx - 4] : null;
  const openFeedback = (s.feedback.by_status.new ?? 0) + (s.feedback.by_status.in_progress ?? 0);

  return (
    <>
      {/* --- Indicateurs clés --- */}
      <div className="grid g4">
        <Kpi
          label="Adoption"
          value={s.adoption.active_pct}
          unit=" %"
          foot={`${s.adoption.active} / ${s.members} utilisent un outil IA chaque semaine`}
        />
        <Kpi
          label="Utilisent l'IA cette semaine"
          value={s.pulse.using_pct}
          unit=" %"
          foot={
            <>
              Pulse du {fmtWeek(s.pulse.reference_week)} ·{" "}
              <Delta now={s.pulse.using_pct} before={before?.using_pct ?? null} unit=" pts" /> sur 4 sem.
            </>
          }
        />
        <Kpi
          label="Temps gagné déclaré"
          value={s.pulse.hours_saved}
          unit=" h"
          foot={s.pulse.hours_saved === null ? "Masqué : moins de 3 réponses" : `Semaine du ${fmtWeek(s.pulse.reference_week)}`}
        />
        <Kpi
          label="Satisfaction"
          value={s.pulse.satisfaction}
          unit=" / 5"
          digits={1}
          foot={
            s.pulse.satisfaction === null ? (
              "Masqué : moins de 3 réponses"
            ) : (
              <>
                Participation {fmtNum(s.pulse.participation)} % ·{" "}
                <Delta now={s.pulse.satisfaction} before={before?.satisfaction ?? null} digits={1} />
              </>
            )
          }
        />
      </div>

      {/* --- Tendance --- */}
      <div className="card section">
        <div className="card-head" style={{ flexWrap: "wrap" }}>
          <h2>Évolution sur 12 semaines</h2>
          <div className="pills">
            {METRICS.map((x) => (
              <button key={x.key} className={`ghost small ${metric === x.key ? "on" : ""}`} onClick={() => setMetric(x.key)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <TrendChart
          label={m.label}
          unit={m.unit}
          digits={m.digits}
          max={m.max}
          points={trend.map((w) => ({
            week: w.week,
            value: w[metric],
            note: `${w.respondents} réponse${w.respondents > 1 ? "s" : ""}`,
          }))}
        />
        <p className="muted tiny" style={{ margin: "0.5rem 0 0" }}>
          Source : pulse hebdomadaire. Satisfaction et heures masquées les semaines à moins de 3 réponses.
        </p>
      </div>

      <div className="grid g2 section">
        <div className="card">
          <div className="card-head">
            <h2>Outils utilisés</h2>
            <span className="muted small">{fmtNum(s.adoption.explorers_pct)} % ont déclaré au moins un outil</span>
          </div>
          <ToolBars rows={s.adoption.tools.slice(0, 10)} members={s.members} />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Freins remontés</h2>
            <span className="muted small">4 dernières semaines</span>
          </div>
          {s.pulse.blockers === null ? (
            <div className="empty small">Masqué : moins de 3 répondants sur la période.</div>
          ) : (
            <BarList
              rows={s.pulse.blockers.map((b) => ({ label: BLOCKERS[b.blocker] ?? b.blocker, value: b.count }))}
              format={(v) => `${v}`}
            />
          )}
        </div>
      </div>

      {/* --- Connaissances --- */}
      <div className="grid g2 section">
        <div className="card">
          <div className="card-head">
            <h2>Compétences {scopeLabel}</h2>
            <span className="muted small">{fmtNum(s.skills.assessed_pct)} % auto-évalués</span>
          </div>
          <SkillDistribution domains={s.skills.domains} />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Quiz</h2>
          </div>
          <div className="grid g2">
            <div className="kpi">
              <div className="label">Score moyen</div>
              <div className="value">
                {fmtNum(s.skills.quiz_avg_pct)}
                {s.skills.quiz_avg_pct !== null ? <span className="unit"> %</span> : null}
              </div>
            </div>
            <div className="kpi">
              <div className="label">Participants</div>
              <div className="value">
                {s.skills.quiz_participants}
                <span className="unit"> / {s.members}</span>
              </div>
            </div>
          </div>
          <h3 style={{ marginTop: "1rem" }}>Domaines à renforcer</h3>
          <BarList
            rows={[...s.skills.domains]
              .filter((d) => d.avg !== null)
              .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
              .slice(0, 3)
              .map((d) => ({ label: DOMAINS[d.domain]?.label ?? d.domain, value: d.avg ?? 0 }))}
            max={3}
            format={(v) => `${fmtNum(v, 1)} / 3`}
          />
        </div>
      </div>

      {/* --- Use cases et feedback --- */}
      <div className="grid g2 section">
        <div className="card">
          <div className="card-head">
            <h2>Use cases</h2>
            <Link href="/usages" className="small">
              Catalogue →
            </Link>
          </div>
          <div className="grid g3" style={{ marginBottom: "1rem" }}>
            <div className="kpi">
              <div className="label">Partagés</div>
              <div className="value">{s.usecases.count}</div>
              <div className="foot">+{s.usecases.last_30_days} en 30 j</div>
            </div>
            <div className="kpi">
              <div className="label">Contributeurs</div>
              <div className="value">{s.usecases.contributors}</div>
              <div className="foot">{s.usecases.validated} validés</div>
            </div>
            <div className="kpi">
              <div className="label">Gain potentiel</div>
              <div className="value">
                {fmtNum(s.usecases.hours_saved_per_week)}
                <span className="unit"> h/sem.</span>
              </div>
              <div className="foot">auteurs + adoptants</div>
            </div>
          </div>
          <h3>Les plus adoptés</h3>
          {s.usecases.top.length ? (
            <table>
              <tbody>
                {s.usecases.top.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/usages/${u.id}`}>{u.title}</Link>
                      <div className="muted tiny">
                        {CATEGORIES[u.category]} · {u.author}
                      </div>
                    </td>
                    <td className="num" title="Personnes qui l'utilisent aussi">
                      👥 {u.adopters}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty small">Aucun use case partagé pour l&apos;instant.</div>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Feedback</h2>
            <Link href="/feedback" className="small">
              Boîte de réception →
            </Link>
          </div>
          <div className="grid g3" style={{ marginBottom: "1rem" }}>
            {(["new", "in_progress", "done"] as const).map((k) => (
              <div className="kpi" key={k}>
                <div className="label">{FEEDBACK_STATUSES[k]}</div>
                <div className="value">{s.feedback.by_status[k] ?? 0}</div>
              </div>
            ))}
          </div>
          {openFeedback ? (
            <p className="small">
              <strong>{openFeedback}</strong> feedback{openFeedback > 1 ? "s" : ""} en attente de réponse.
            </p>
          ) : null}
          <h3>Verbatims récents du pulse</h3>
          {s.pulse.comments === null ? (
            <div className="empty small">Masqué : moins de 3 répondants.</div>
          ) : s.pulse.comments.length === 0 ? (
            <div className="empty small">Aucun commentaire.</div>
          ) : (
            <ul style={{ paddingLeft: "1.1rem", margin: 0 }}>
              {s.pulse.comments.slice(0, 6).map((c, i) => (
                <li key={i} className="small" style={{ marginBottom: "0.4rem" }}>
                  « {c.text} » <span className="muted tiny">— sem. du {fmtWeek(c.week)}</span>
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
                    n > 0 ? (
                      <span key={i} className="bar-seg" style={{ width: `${(100 * n) / total}%`, background: DIST_COLORS[i] }} />
                    ) : null,
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
        <span className="muted">· valeur = niveau moyen / 3</span>
      </div>
    </>
  );
}
