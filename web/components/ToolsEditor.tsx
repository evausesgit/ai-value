"use client";

// Déclaration des outils IA (enregistrée à chaque clic). Utilisé sur « Mes outils »
// et dans une campagne de mise à jour.

import { useEffect, useState } from "react";
import { api, type Tool } from "@/lib/api";
import { FREQUENCIES } from "@/lib/catalog";

const CATEGORY_LABELS: Record<string, string> = {
  assistant: "Assistants",
  code: "Code",
  recherche: "Recherche",
  image: "Images",
  productivite: "Productivité",
  interne: "Outils internes",
};

export default function ToolsEditor({ compact = false }: { compact?: boolean }) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [usages, setUsages] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    api<Tool[]>("/tools").then(setTools);
    api<Record<string, string>>("/me/tools").then(setUsages);
  }, []);

  async function setFreq(toolId: number, freq: string | null) {
    setError("");
    const prev = usages;
    const next = { ...usages };
    if (freq) next[String(toolId)] = freq;
    else delete next[String(toolId)];
    setUsages(next);
    try {
      await api("/me/tools", { method: "PUT", body: { usages: { [toolId]: freq } } });
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
    <div>
      {error ? <div className="error">{error}</div> : null}
      {Object.entries(groups).map(([cat, list]) => (
        <div key={cat} style={{ marginBottom: compact ? "0.5rem" : "1rem" }}>
          <h3 className="muted small" style={{ textTransform: "uppercase", letterSpacing: "0.04em", margin: "0.5rem 0 0.25rem" }}>
            {CATEGORY_LABELS[cat] ?? cat}
          </h3>
          {list.map((t) => {
            const cur = usages[String(t.id)] ?? null;
            return (
              <div key={t.id} className="row" style={{ padding: "0.45rem 0", borderTop: "1px solid var(--grid)", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600, minWidth: 140 }}>{t.name}</div>
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
    </div>
  );
}
