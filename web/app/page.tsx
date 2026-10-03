"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Kpi, Meter } from "@/components/charts";
import { api, type Pulse } from "@/lib/api";
import { BLOCKERS, DOMAINS, SKILL_LEVELS, USAGE_LEVELS, fmtNum, fmtWeek } from "@/lib/catalog";
import { useSession } from "@/lib/session";

interface MeDash {
  week: string;
  pulse_done: boolean;
  streak: number;
  tools: { active: number; declared: number };
  skills: { domain: string; mine: number | null; org_avg: number | null }[];
  quiz_avg_pct: number | null;
  quizzes_done: number;
  usecases: { count: number; adopters: number };
  todo: { key: string; done: boolean; label: string }[];
}

const TODO_LINKS: Record<string, string> = {
  pulse: "#pulse",
  tools: "/outils",
  skills: "/competences",
  quiz: "/competences#quiz",
  usecase: "/usages/nouveau",
};

export default function Home() {
  const { me } = useSession();
  const [dash, setDash] = useState<MeDash | null>(null);

  const load = useCallback(() => {
    api<MeDash>("/dashboard/me").then(setDash).catch(() => {});
  }, []);
  useEffect(load, [load]);

  if (!me || !dash) return <main className="page muted">Chargement…</main>;
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
        <div className="card span2" id="pulse">
          <PulseCard week={dash.week} onSaved={load} />
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
                {t.done ? (
                  <span className="txt">{t.label}</span>
                ) : (
                  <Link href={TODO_LINKS[t.key]}>{t.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid g4 section">
        <Kpi
          label="Pulses d'affilée"
          value={dash.streak}
          unit={dash.streak > 1 ? " semaines" : " semaine"}
          foot={dash.pulse_done ? "Pulse de la semaine envoyé ✓" : "Pense au pulse de cette semaine"}
        />
        <Kpi
          label="Outils IA utilisés"
          value={dash.tools.active}
          foot={<Link href="/outils">{dash.tools.declared ? "Mettre à jour mes outils" : "Déclarer mes outils"}</Link>}
        />
        <Kpi
          label="Use cases partagés"
          value={dash.usecases.count}
          foot={`${dash.usecases.adopters} personne${dash.usecases.adopters > 1 ? "s les ont adoptés" : " l'a adopté"}`}
        />
        <Kpi
          label="Score moyen aux quiz"
          value={dash.quiz_avg_pct}
          unit=" %"
          foot={`${dash.quizzes_done} quiz réalisé${dash.quizzes_done > 1 ? "s" : ""}`}
        />
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

function PulseCard({ week, onSaved }: { week: string; onSaved: () => void }) {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ usage_level: -1, hours_saved: 0, satisfaction: 0, blockers: [] as string[], comment: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ week: string; pulse: Pulse | null }>("/me/pulse").then((r) => {
      setPulse(r.pulse);
      if (r.pulse) setForm({ ...r.pulse });
      setEditing(!r.pulse);
      setLoaded(true);
    });
  }, []);

  async function save() {
    if (form.usage_level < 0 || form.satisfaction < 1) {
      setError("Réponds aux deux premières questions.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<{ pulse: Pulse }>("/me/pulse", { method: "PUT", body: form });
      setPulse(r.pulse);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <div className="muted">Chargement…</div>;

  if (pulse && !editing) {
    return (
      <>
        <div className="card-head">
          <h2>Pulse de la semaine du {fmtWeek(week)}</h2>
          <button className="ghost small" onClick={() => setEditing(true)}>
            Modifier
          </button>
        </div>
        <p className="success">Merci ! Ta réponse compte pour le suivi de ton équipe (agrégé et anonymisé).</p>
        <div className="grid g3">
          <div>
            <div className="muted small">Usage de l&apos;IA</div>
            <strong>{USAGE_LEVELS[pulse.usage_level]}</strong>
          </div>
          <div>
            <div className="muted small">Temps gagné</div>
            <strong>{fmtNum(pulse.hours_saved, 1)} h</strong>
          </div>
          <div>
            <div className="muted small">Satisfaction</div>
            <strong>{"★".repeat(pulse.satisfaction)}{"☆".repeat(5 - pulse.satisfaction)}</strong>
          </div>
        </div>
      </>
    );
  }

  const toggleBlocker = (b: string) =>
    setForm((f) => ({ ...f, blockers: f.blockers.includes(b) ? f.blockers.filter((x) => x !== b) : [...f.blockers, b] }));

  return (
    <>
      <div className="card-head">
        <h2>Pulse de la semaine du {fmtWeek(week)}</h2>
        <span className="muted small">1 minute · anonymisé</span>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="field">
        <label>Cette semaine, tu as utilisé l&apos;IA…</label>
        <div className="scale">
          {USAGE_LEVELS.map((l, i) => (
            <button key={l} type="button" className={form.usage_level === i ? "on" : ""} onClick={() => setForm({ ...form, usage_level: i })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Es-tu satisfait·e de ce que l&apos;IA t&apos;apporte ?</label>
        <div className="scale">
          {["Pas du tout", "Peu", "Moyennement", "Plutôt", "Très"].map((l, i) => (
            <button key={l} type="button" className={form.satisfaction === i + 1 ? "on" : ""} onClick={() => setForm({ ...form, satisfaction: i + 1 })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="hours">
          Temps gagné cette semaine <span className="hint">(estimation en heures)</span>
        </label>
        <div className="row">
          <input id="hours" type="number" min={0} max={40} step={0.5} value={form.hours_saved} onChange={(e) => setForm({ ...form, hours_saved: Number(e.target.value) })} style={{ maxWidth: 110 }} />
          {[0.5, 1, 2, 4].map((h) => (
            <button key={h} type="button" className={`ghost small ${form.hours_saved === h ? "on" : ""}`} onClick={() => setForm({ ...form, hours_saved: h })}>
              {fmtNum(h, h % 1 ? 1 : 0)} h
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Qu&apos;est-ce qui te freine ? <span className="hint">(facultatif, plusieurs choix)</span></label>
        <div className="pills">
          {Object.entries(BLOCKERS).map(([k, l]) => (
            <button key={k} type="button" className={`ghost small ${form.blockers.includes(k) ? "on" : ""}`} onClick={() => toggleBlocker(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="comment">Un mot ? <span className="hint">(facultatif)</span></label>
        <textarea id="comment" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Une réussite, une difficulté, une idée…" style={{ minHeight: 60 }} />
      </div>
      <div className="row">
        <button onClick={save} disabled={busy}>
          {busy ? "Envoi…" : "Envoyer mon pulse"}
        </button>
        {pulse ? (
          <button className="ghost" onClick={() => setEditing(false)}>
            Annuler
          </button>
        ) : null}
      </div>
    </>
  );
}
