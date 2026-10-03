"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DOMAINS, DOMAIN_KEYS, SKILL_HINTS, SKILL_LEVELS } from "@/lib/catalog";
import { hasRole, useSession } from "@/lib/session";

interface QuizItem {
  id: number;
  title: string;
  description: string;
  domain: string;
  library: boolean;
  questions: number;
  best_pct: number | null;
  can_delete: boolean;
}

export default function SkillsPage() {
  const { me } = useSession();
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<Record<string, number>>("/skills").then(setLevels);
    api<QuizItem[]>("/quizzes").then(setQuizzes);
  }, []);

  async function setLevel(domain: string, level: number) {
    setLevels((l) => ({ ...l, [domain]: level }));
    setSaved(false);
    await api("/skills", { method: "PUT", body: { [domain]: level } });
    setSaved(true);
  }

  async function removeQuiz(id: number) {
    if (!confirm("Retirer ce quiz ?")) return;
    await api(`/quizzes/${id}`, { method: "DELETE" });
    setQuizzes((qs) => qs.filter((q) => q.id !== id));
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Compétences IA</h1>
          <p className="sub">Où en es-tu ? L&apos;auto-évaluation aide ton équipe à cibler les formations.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Mon auto-évaluation</h2>
          {saved ? <span className="pill good">✓ Enregistré</span> : null}
        </div>
        <div className="legend" style={{ marginTop: 0, marginBottom: "1rem" }}>
          {SKILL_LEVELS.map((l, i) => (
            <span key={l}>
              <strong>{l}</strong> : {SKILL_HINTS[i]}
            </span>
          ))}
        </div>
        {DOMAIN_KEYS.map((d) => (
          <div key={d} style={{ padding: "0.7rem 0", borderTop: "1px solid var(--grid)" }}>
            <div style={{ marginBottom: "0.45rem" }}>
              <strong>{DOMAINS[d].label}</strong> <span className="muted small">— {DOMAINS[d].hint}</span>
            </div>
            <div className="scale s4">
              {SKILL_LEVELS.map((l, i) => (
                <button key={l} type="button" className={levels[d] === i ? "on" : ""} onClick={() => setLevel(d, i)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="section" id="quiz">
        <div className="page-head" style={{ marginBottom: "0.85rem" }}>
          <h2 style={{ margin: 0 }}>Quiz</h2>
          {hasRole(me, "lead") ? (
            <Link href="/quiz/nouveau" className="btn ghost small">
              + Créer un quiz
            </Link>
          ) : null}
        </div>
        <div className="grid g3">
          {quizzes.map((q) => (
            <div key={q.id} className="card uc-card">
              <div className="pills">
                <span className="pill blue">{DOMAINS[q.domain]?.label ?? q.domain}</span>
                {!q.library ? <span className="pill">Maison</span> : null}
                {q.best_pct !== null ? (
                  <span className={`pill ${q.best_pct >= 80 ? "good" : q.best_pct >= 50 ? "warn" : "crit"}`}>
                    Meilleur score {Math.round(q.best_pct)} %
                  </span>
                ) : null}
              </div>
              <h3>{q.title}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {q.description}
              </p>
              <div className="row" style={{ marginTop: "auto" }}>
                <Link href={`/quiz/${q.id}`} className="btn small">
                  {q.best_pct === null ? "Commencer" : "Refaire"} · {q.questions} questions
                </Link>
                {q.can_delete ? (
                  <button className="danger small" onClick={() => removeQuiz(q.id)}>
                    Retirer
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
