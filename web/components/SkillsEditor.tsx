"use client";

// Auto-évaluation sur les 6 domaines (enregistrée à chaque clic).

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DOMAINS, DOMAIN_KEYS, SKILL_HINTS, SKILL_LEVELS } from "@/lib/catalog";

export default function SkillsEditor({ onSaved }: { onSaved?: () => void }) {
  const [levels, setLevels] = useState<Record<string, number>>({});

  useEffect(() => {
    api<Record<string, number>>("/skills").then(setLevels);
  }, []);

  async function setLevel(domain: string, level: number) {
    setLevels((l) => ({ ...l, [domain]: level }));
    await api("/skills", { method: "PUT", body: { [domain]: level } });
    onSaved?.();
  }

  return (
    <div>
      <div className="legend" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
        {SKILL_LEVELS.map((l, i) => (
          <span key={l}>
            <strong>{l}</strong> : {SKILL_HINTS[i]}
          </span>
        ))}
      </div>
      {DOMAIN_KEYS.map((d) => (
        <div key={d} style={{ padding: "0.6rem 0", borderTop: "1px solid var(--grid)" }}>
          <div style={{ marginBottom: "0.4rem" }}>
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
  );
}
