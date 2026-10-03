"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Tool } from "@/lib/api";
import { FREQUENCIES } from "@/lib/catalog";

const CATEGORY_LABELS: Record<string, string> = {
  assistant: "Assistants",
  code: "Code",
  recherche: "Recherche",
  image: "Images",
  productivite: "Productivité",
};

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [usages, setUsages] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Tool[]>("/tools").then(setTools);
    api<Record<string, string>>("/me/tools").then(setUsages);
  }, []);

  async function setFreq(toolId: number, freq: string | null) {
    setSaved(false);
    setError("");
    const prev = usages;
    const next = { ...usages };
    if (freq) next[String(toolId)] = freq;
    else delete next[String(toolId)];
    setUsages(next);
    try {
      await api("/me/tools", { method: "PUT", body: { usages: { [toolId]: freq } } });
      setSaved(true);
    } catch (e) {
      setUsages(prev);
      setError((e as Error).message);
    }
  }

  const groups = tools.reduce<Record<string, Tool[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>Mes outils IA</h1>
          <p className="sub">Indique ceux que tu utilises et à quelle fréquence. Enregistré automatiquement.</p>
        </div>
        <Link href="/" className="btn ghost">
          ← Mon espace
        </Link>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {saved ? <div className="success">Enregistré.</div> : null}
      {Object.entries(groups).map(([cat, list]) => (
        <div className="card" key={cat}>
          <h2>{CATEGORY_LABELS[cat] ?? cat}</h2>
          {list.map((t) => {
            const cur = usages[String(t.id)] ?? null;
            return (
              <div key={t.id} style={{ padding: "0.6rem 0", borderTop: "1px solid var(--grid)" }}>
                <div style={{ fontWeight: 600, marginBottom: "0.4rem" }}>{t.name}</div>
                <div className="pills">
                  <button className={`ghost small ${cur === null ? "on" : ""}`} onClick={() => setFreq(t.id, null)}>
                    Jamais
                  </button>
                  {Object.entries(FREQUENCIES)
                    .reverse()
                    .map(([k, l]) => (
                      <button key={k} className={`ghost small ${cur === k ? "on" : ""}`} onClick={() => setFreq(t.id, k)}>
                        {l}
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <p className="muted small" style={{ marginTop: "1rem" }}>
        Un outil manque ? Signale-le via le <Link href="/feedback">feedback</Link>, ton admin pourra l&apos;ajouter.
      </p>
    </main>
  );
}
