"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import SkillsEditor from "@/components/SkillsEditor";
import { useI18n } from "@/lib/i18n";
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
  const { m } = useI18n();
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<QuizItem[]>("/quizzes").then(setQuizzes);
  }, []);

  async function removeQuiz(id: number) {
    if (!confirm(m.skills.confirmRemove)) return;
    await api(`/quizzes/${id}`, { method: "DELETE" });
    setQuizzes((qs) => qs.filter((q) => q.id !== id));
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{m.skills.title}</h1>
          <p className="sub">{m.skills.subtitle}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{m.skills.myAssessment}</h2>
          {saved ? <span className="pill good">{m.skills.savedPill}</span> : null}
        </div>
        <SkillsEditor onSaved={() => setSaved(true)} />
      </div>

      <div className="section" id="quiz">
        <div className="page-head" style={{ marginBottom: "0.85rem" }}>
          <h2 style={{ margin: 0 }}>{m.skills.quiz}</h2>
          {hasRole(me, "lead") ? (
            <Link href="/quiz/nouveau" className="btn ghost small">
              {m.skills.createQuiz}
            </Link>
          ) : null}
        </div>
        <div className="grid g3">
          {quizzes.map((q) => (
            <div key={q.id} className="card uc-card">
              <div className="pills">
                <span className="pill blue">{m.catalog.domains[q.domain]?.label ?? q.domain}</span>
                {!q.library ? <span className="pill">{m.skills.homemade}</span> : null}
                {q.best_pct !== null ? (
                  <span className={`pill ${q.best_pct >= 80 ? "good" : q.best_pct >= 50 ? "warn" : "crit"}`}>
                    {m.skills.best(Math.round(q.best_pct))}
                  </span>
                ) : null}
              </div>
              <h3>{q.title}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {q.description}
              </p>
              <div className="row" style={{ marginTop: "auto" }}>
                <Link href={`/quiz/${q.id}`} className="btn small">
                  {q.best_pct === null ? m.skills.start : m.skills.redo} · {m.skills.questions(q.questions)}
                </Link>
                {q.can_delete ? (
                  <button className="danger small" onClick={() => removeQuiz(q.id)}>
                    {m.skills.remove}
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
