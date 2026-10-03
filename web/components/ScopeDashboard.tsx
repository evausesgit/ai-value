"use client";

// Bloc commun aux tableaux de bord équipe et organisation (mêmes définitions,
// cf. app/api/dashboards.py) : état actuel en direct + évolution par campagne.

import Link from "next/link";
import { useState } from "react";
import { BarList, Delta, Kpi, ToolBars, TrendChart } from "@/components/charts";
import type { EvolutionPoint, ScopeStats } from "@/lib/api";
import { BLOCKERS, CATEGORIES, DOMAINS, FEEDBACK_STATUSES, SKILL_LEVELS, fmtDay, fmtNum } from "@/lib/catalog";

type Metric = "adoption_pct" | "hours_saved_avg" | "skills_avg" | "satisfaction" | "participation";
const METRICS: { key: Metric; label: string; unit: string; digits: number; max?: number }[] = [
  { key: "adoption_pct", label: "Adoption", unit: " %", digits: 0, max: 100 },
  { key: "hours_saved_avg", label: "Temps gagné / pers. / sem.", unit: " h", digits: 1 },
  { key: "skills_avg", label: "Niveau de compétences (0-3)", unit: "", digits: 1, max: 3 },
  { key: "satisfaction", label: "Satisfaction (1-5)", unit: "", digits: 1, max: 5 },
  { key: "participation", label: "Participation", unit: " %", digits: 0, max: 100 },
];

function shortLabel(e: EvolutionPoint) {
  return new Date(`${e.date}T00:00:00`).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

export default function ScopeDashboard({ s, scopeLabel }: { s: ScopeStats; scopeLabel: string }) {
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
              <strong>Campagne en cours : {current.title}</strong>
              <div className="small">
                {current.respondents} / {current.targeted} réponses ({fmtNum(current.participation)} %)
              </div>
            </div>
            <Link href={`/campagnes/${current.id}`} className="btn small">
              Voir les résultats
            </Link>
          </div>
        </div>
      ) : null}

      {/* --- État actuel --- */}
      <div className="grid g4">
        <Kpi
          label="Adoption"
          value={s.adoption.active_pct}
          unit=" %"
          foot={`${s.adoption.active} / ${s.members} utilisent un outil IA chaque semaine`}
        />
        <Kpi
          label="Temps gagné"
          value={s.usecases.hours_saved_per_week}
          unit=" h/sem."
          foot={
            <>
              via les use cases et leurs adoptants
              {last && prev ? (
                <>
                  {" "}· <Delta now={last.hours_saved_avg} before={prev.hours_saved_avg} unit=" h/pers." digits={1} />
                </>
              ) : null}
            </>
          }
        />
        <Kpi
          label="Niveau de compétences"
          value={s.skills.avg}
          unit=" / 3"
          digits={1}
          foot={
            <>
              {fmtNum(s.skills.assessed_pct)} % auto-évalués
              {last && prev ? (
                <>
                  {" "}· <Delta now={last.skills_avg} before={prev.skills_avg} digits={1} />
                </>
              ) : null}
            </>
          }
        />
        <Kpi
          label="Satisfaction"
          value={s.feeling?.satisfaction ?? null}
          unit=" / 5"
          digits={1}
          foot={
            s.feeling
              ? s.feeling.satisfaction === null
                ? "Masqué : moins de 3 réponses"
                : `${s.feeling.campaign} · ${s.feeling.respondents} réponses`
              : "Pas encore de campagne avec ressenti"
          }
        />
      </div>

      {/* --- Évolution --- */}
      <div className="card section">
        <div className="card-head" style={{ flexWrap: "wrap" }}>
          <h2>Évolution par campagne</h2>
          <div className="pills">
            {METRICS.map((x) => (
              <button key={x.key} className={`ghost small ${metric === x.key ? "on" : ""}`} onClick={() => setMetric(x.key)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        {evo.length === 0 ? (
          <div className="empty small">
            Pas encore de campagne. <Link href="/campagnes/nouvelle">Lance une campagne de mise à jour</Link> : chaque campagne
            ajoute un point à cette courbe.
          </div>
        ) : (
          <>
            <TrendChart
              label={m.label}
              unit={m.unit}
              digits={m.digits}
              max={m.max}
              points={evo.map((e) => ({
                key: String(e.id),
                label: shortLabel(e),
                title: `${e.title}${e.open ? " (en cours)" : ""}`,
                value: e[metric],
                note: `${e.respondents} / ${e.targeted} réponses · ${fmtDay(e.date)}`,
              }))}
            />
            <p className="muted tiny" style={{ margin: "0.5rem 0 0" }}>
              Chaque point est la photo des répondants d&apos;une campagne. Satisfaction masquée sous 3 réponses.
            </p>
          </>
        )}
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
            <span className="muted small">{s.feeling ? s.feeling.campaign : ""}</span>
          </div>
          {!s.feeling ? (
            <div className="empty small">Demande un ressenti dans une campagne pour voir les freins.</div>
          ) : s.feeling.blockers === null ? (
            <div className="empty small">Masqué : moins de 3 réponses.</div>
          ) : (
            <BarList rows={s.feeling.blockers.map((b) => ({ label: BLOCKERS[b.blocker] ?? b.blocker, value: b.count }))} format={(v) => `${v}`} />
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
              <div className="label">Temps gagné</div>
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
          <h3>Verbatims {s.feeling ? `— ${s.feeling.campaign}` : ""}</h3>
          {!s.feeling ? (
            <div className="empty small">Pas encore de ressenti collecté.</div>
          ) : s.feeling.comments === null ? (
            <div className="empty small">Masqué : moins de 3 réponses.</div>
          ) : s.feeling.comments.length === 0 ? (
            <div className="empty small">Aucun commentaire.</div>
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
        <span className="muted">· valeur = niveau moyen / 3</span>
      </div>
    </>
  );
}
