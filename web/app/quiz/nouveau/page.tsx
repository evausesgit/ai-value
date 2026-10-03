"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { DOMAINS } from "@/lib/catalog";

interface Q {
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
}
const blank = (): Q => ({ prompt: "", options: ["", "", ""], correct: 0, explanation: "" });

export default function NewQuizPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("metier");
  const [questions, setQuestions] = useState<Q[]>([blank()]);
  const [error, setError] = useState("");

  const upd = (i: number, patch: Partial<Q>) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/quizzes", { body: { title, description, domain, questions } });
      router.push("/competences#quiz");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>Créer un quiz</h1>
          <p className="sub">Un quiz adapté à vos métiers et à vos règles internes. Visible par toute l&apos;organisation.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        {error ? <div className="error">{error}</div> : null}
        <div className="card">
          <div className="field">
            <label htmlFor="t">Titre</label>
            <input id="t" required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="d">Description</label>
            <input id="d" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="dom">Domaine</label>
            <select id="dom" value={domain} onChange={(e) => setDomain(e.target.value)}>
              {Object.entries(DOMAINS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {questions.map((q, i) => (
          <div className="card" key={i}>
            <div className="card-head">
              <h3>Question {i + 1}</h3>
              {questions.length > 1 ? (
                <button type="button" className="danger small" onClick={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}>
                  Supprimer
                </button>
              ) : null}
            </div>
            <div className="field">
              <input required placeholder="Intitulé de la question" value={q.prompt} onChange={(e) => upd(i, { prompt: e.target.value })} />
            </div>
            <label>Réponses (coche la bonne)</label>
            {q.options.map((o, j) => (
              <div className="row" key={j} style={{ marginBottom: "0.4rem", flexWrap: "nowrap" }}>
                <input type="radio" name={`c${i}`} checked={q.correct === j} onChange={() => upd(i, { correct: j })} style={{ width: "auto" }} aria-label="Bonne réponse" />
                <input required placeholder={`Réponse ${j + 1}`} value={o} onChange={(e) => upd(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />
              </div>
            ))}
            {q.options.length < 6 ? (
              <button type="button" className="ghost small" onClick={() => upd(i, { options: [...q.options, ""] })}>
                + Réponse
              </button>
            ) : null}
            <div className="field" style={{ marginTop: "0.75rem" }}>
              <input placeholder="Explication affichée après la réponse (facultatif)" value={q.explanation} onChange={(e) => upd(i, { explanation: e.target.value })} />
            </div>
          </div>
        ))}
        <div className="row" style={{ marginTop: "1rem" }}>
          <button type="button" className="ghost" onClick={() => setQuestions((qs) => [...qs, blank()])}>
            + Question
          </button>
          <button type="submit">Publier le quiz</button>
        </div>
      </form>
    </main>
  );
}
