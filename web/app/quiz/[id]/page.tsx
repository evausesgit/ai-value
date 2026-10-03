"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface QuizData {
  id: number;
  title: string;
  description: string;
  domain: string;
  questions: { prompt: string; options: string[] }[];
}
interface Result {
  score: number;
  total: number;
  corrections: { correct: number; explanation: string }[];
}

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { m } = useI18n();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<QuizData>(`/quizzes/${id}`).then((q) => {
      setQuiz(q);
      setAnswers(q.questions.map(() => -1));
    });
  }, [id]);

  async function submit() {
    if (answers.includes(-1)) {
      setError(m.quiz.answerAll);
      return;
    }
    setError("");
    setResult(await api<Result>(`/quizzes/${id}/attempt`, { body: { answers } }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function retry() {
    setResult(null);
    setAnswers(quiz!.questions.map(() => -1));
  }

  if (!quiz) return <main className="page narrow muted">{m.common.loading}</main>;
  const pct = result ? Math.round((100 * result.score) / result.total) : 0;

  return (
    <main className="page narrow">
      <p>
        <Link href="/competences#quiz" className="small">
          {m.quiz.back}
        </Link>
      </p>
      <div className="page-head">
        <div>
          <span className="pill blue">{m.catalog.domains[quiz.domain]?.label}</span>
          <h1 style={{ marginTop: "0.5rem" }}>{quiz.title}</h1>
          <p className="sub">{quiz.description}</p>
        </div>
      </div>

      {result ? (
        <div className={pct >= 80 ? "success" : "card"} style={{ fontSize: "1rem" }}>
          <strong>
            {m.quiz.score(result.score, result.total, pct)}
          </strong>{" "}
          {pct >= 80 ? m.quiz.bravo : pct >= 50 ? m.quiz.notBad : m.quiz.help}
          <div className="row" style={{ marginTop: "0.6rem" }}>
            <button className="ghost small" onClick={retry}>
              {m.quiz.redo}
            </button>
          </div>
        </div>
      ) : null}

      {quiz.questions.map((q, i) => {
        const corr = result?.corrections[i];
        return (
          <div className="card" key={i}>
            <h3>
              {i + 1}. {q.prompt}
            </h3>
            <div style={{ display: "grid", gap: "0.4rem" }}>
              {q.options.map((o, j) => {
                const chosen = answers[i] === j;
                let style: React.CSSProperties = {};
                let mark = "";
                if (corr) {
                  if (j === corr.correct) {
                    style = { borderColor: "var(--good)", background: "var(--good-bg)", color: "var(--good-text)" };
                    mark = "✓ ";
                  } else if (chosen) {
                    style = { borderColor: "var(--critical)", background: "var(--crit-bg)", color: "var(--critical)" };
                    mark = "✗ ";
                  }
                }
                return (
                  <button
                    key={j}
                    type="button"
                    disabled={!!result}
                    className={`ghost ${chosen && !corr ? "on" : ""}`}
                    style={{ justifyContent: "flex-start", textAlign: "left", opacity: 1, ...style }}
                    onClick={() => setAnswers((a) => a.map((v, k) => (k === i ? j : v)))}
                  >
                    {mark}
                    {o}
                  </button>
                );
              })}
            </div>
            {corr?.explanation ? (
              <p className="small" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                💡 {corr.explanation}
              </p>
            ) : null}
          </div>
        );
      })}

      {!result ? (
        <>
          {error ? <div className="error" style={{ marginTop: "1rem" }}>{error}</div> : null}
          <button onClick={submit} style={{ marginTop: "1rem" }}>
            {m.quiz.submit}
          </button>
        </>
      ) : null}
    </main>
  );
}
