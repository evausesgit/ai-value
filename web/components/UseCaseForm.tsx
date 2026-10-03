"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Tool, type UseCase } from "@/lib/api";
import { CATEGORIES, RISKS } from "@/lib/catalog";

const EMPTY = {
  title: "",
  category: "redaction",
  problem: "",
  solution: "",
  prompt: "",
  tools: [] as string[],
  minutes_saved_per_week: 30,
  risk: "low" as UseCase["risk"],
};

export default function UseCaseForm({ initial, id }: { initial?: UseCase; id?: number }) {
  const router = useRouter();
  const [tools, setTools] = useState<Tool[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Tool[]>("/tools").then(setTools);
  }, []);
  useEffect(() => {
    if (initial)
      setForm({
        title: initial.title,
        category: initial.category,
        problem: initial.problem,
        solution: initial.solution ?? "",
        prompt: initial.prompt ?? "",
        tools: initial.tools,
        minutes_saved_per_week: initial.minutes_saved_per_week,
        risk: initial.risk,
      });
  }, [initial]);

  const toggleTool = (name: string) =>
    setForm((f) => ({ ...f, tools: f.tools.includes(name) ? f.tools.filter((t) => t !== name) : [...f.tools, name] }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ id: number }>(id ? `/usecases/${id}` : "/usecases", {
        method: id ? "PUT" : "POST",
        body: form,
      });
      router.push(`/usages/${r.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      {error ? <div className="error">{error}</div> : null}
      <div className="field">
        <label htmlFor="title">Titre</label>
        <input id="title" required minLength={3} maxLength={160} placeholder="Ex. Résumer mes réunions clients en 5 minutes" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="row">
        <div className="field grow">
          <label htmlFor="cat">Catégorie</label>
          <select id="cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(CATEGORIES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field grow">
          <label htmlFor="min">
            Temps gagné <span className="hint">(minutes par semaine)</span>
          </label>
          <input id="min" type="number" min={0} max={2400} step={15} value={form.minutes_saved_per_week} onChange={(e) => setForm({ ...form, minutes_saved_per_week: Number(e.target.value) })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="problem">Le problème</label>
        <textarea id="problem" placeholder="Qu'est-ce qui prenait du temps ou posait problème avant ?" value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="solution">Comment je m&apos;y prends</label>
        <textarea id="solution" placeholder="Les étapes, ce que tu donnes à l'IA, comment tu vérifies le résultat…" value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} style={{ minHeight: 120 }} />
      </div>
      <div className="field">
        <label htmlFor="prompt">
          Le prompt <span className="hint">(facultatif — sans donnée confidentielle)</span>
        </label>
        <textarea id="prompt" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.85rem" }} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
      </div>
      <div className="field">
        <label>Outils utilisés</label>
        <div className="pills">
          {tools.map((t) => (
            <button key={t.id} type="button" className={`ghost small ${form.tools.includes(t.name) ? "on" : ""}`} onClick={() => toggleTool(t.name)}>
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Niveau de risque <span className="hint">(données sensibles, impact d&apos;une erreur)</span></label>
        <div className="pills">
          {Object.entries(RISKS).map(([k, l]) => (
            <button key={k} type="button" className={`ghost small ${form.risk === k ? "on" : ""}`} onClick={() => setForm({ ...form, risk: k as UseCase["risk"] })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? "Enregistrement…" : id ? "Enregistrer" : "Publier"}
        </button>
        <button type="button" className="ghost" onClick={() => router.back()}>
          Annuler
        </button>
      </div>
    </form>
  );
}
