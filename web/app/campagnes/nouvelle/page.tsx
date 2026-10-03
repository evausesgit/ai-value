"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type CampaignItem, type Team } from "@/lib/api";
import { CAMPAIGN_ITEMS } from "@/lib/catalog";
import { hasRole, useSession } from "@/lib/session";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function defaultTitle() {
  const m = MONTHS[new Date().getMonth()];
  return "aeiou".includes(m[0]) ? `Point IA d'${m}` : `Point IA de ${m}`;
}
function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function NewCampaignPage() {
  const router = useRouter();
  const { me } = useSession();
  const isManager = hasRole(me, "manager");
  const [teams, setTeams] = useState<Team[]>([]);
  const [title, setTitle] = useState(defaultTitle());
  const [message, setMessage] = useState(
    "Prends 5 minutes pour mettre à jour tes outils IA, ton auto-évaluation et tes use cases (avec le temps gagné). C'est ce qui nous permet de mesurer l'impact et de cibler les formations. Merci !",
  );
  const [items, setItems] = useState<CampaignItem[]>(["tools", "skills", "usecases", "checkin"]);
  const [teamIds, setTeamIds] = useState<number[]>([]);
  const [closesOn, setClosesOn] = useState(inDays(14));
  const [error, setError] = useState("");

  useEffect(() => {
    api<Team[]>("/teams").then(setTeams);
  }, []);

  const toggleItem = (i: CampaignItem) => setItems((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));
  const toggleTeam = (id: number) => setTeamIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const targeted = isManager
    ? teamIds.length
      ? teams.filter((t) => teamIds.includes(t.id)).reduce((a, t) => a + t.members, 0)
      : teams.reduce((a, t) => a + t.members, 0)
    : teams.find((t) => t.id === me?.team?.id)?.members ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api<{ id: number }>("/campaigns", {
        body: { title, message, items, team_ids: isManager ? teamIds : [], closes_on: closesOn },
      });
      router.push(`/campagnes/${r.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>Nouvelle campagne</h1>
          <p className="sub">Les personnes visées verront la demande sur leur espace et la feront en quelques minutes.</p>
        </div>
      </div>
      <form className="card" onSubmit={submit}>
        {error ? <div className="error">{error}</div> : null}
        <div className="field">
          <label htmlFor="t">Titre</label>
          <input id="t" required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="m">Message aux équipes</label>
          <textarea id="m" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="field">
          <label>Ce que tu demandes de mettre à jour</label>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            {(Object.keys(CAMPAIGN_ITEMS) as CampaignItem[]).map((i) => (
              <label key={i} className="check" style={{ fontWeight: 500 }}>
                <input type="checkbox" checked={items.includes(i)} onChange={() => toggleItem(i)} />
                {CAMPAIGN_ITEMS[i].label} <span className="muted small">— {CAMPAIGN_ITEMS[i].hint}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Qui ?</label>
          {isManager ? (
            <>
              <div className="pills">
                <button type="button" className={`ghost small ${teamIds.length === 0 ? "on" : ""}`} onClick={() => setTeamIds([])}>
                  Toute l&apos;organisation
                </button>
                {teams.map((t) => (
                  <button key={t.id} type="button" className={`ghost small ${teamIds.includes(t.id) ? "on" : ""}`} onClick={() => toggleTeam(t.id)}>
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="small" style={{ margin: 0 }}>
              Ton équipe : <strong>{me?.team?.name ?? "—"}</strong>
            </p>
          )}
          <p className="muted small" style={{ margin: "0.4rem 0 0" }}>
            {targeted} personne{targeted > 1 ? "s" : ""} concernée{targeted > 1 ? "s" : ""}.
          </p>
        </div>
        <div className="field">
          <label htmlFor="d">Date limite</label>
          <input id="d" type="date" required value={closesOn} onChange={(e) => setClosesOn(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
        <div className="row">
          <button type="submit" disabled={items.length === 0}>
            Lancer la campagne
          </button>
          <button type="button" className="ghost" onClick={() => router.back()}>
            Annuler
          </button>
        </div>
      </form>
    </main>
  );
}
