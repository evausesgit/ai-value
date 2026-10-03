"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type CampaignItem, type Team } from "@/lib/api";
import { currentLocale, useI18n } from "@/lib/i18n";
import { hasRole, useSession } from "@/lib/session";

function currentMonth() {
  return new Date().toLocaleDateString(currentLocale(), { month: "long" });
}
function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function NewCampaignPage() {
  const router = useRouter();
  const { me } = useSession();
  const { m, lang } = useI18n();
  const c_ = m.campaigns;
  const isManager = hasRole(me, "manager");
  const [teams, setTeams] = useState<Team[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [items, setItems] = useState<CampaignItem[]>(["tools", "skills", "usecases", "checkin"]);
  const [teamIds, setTeamIds] = useState<number[]>([]);
  const [closesOn, setClosesOn] = useState(inDays(14));
  const [error, setError] = useState("");

  useEffect(() => {
    api<Team[]>("/teams").then(setTeams);
  }, []);
  // Titre et message proposés dans la langue de l'interface, tant qu'on n'y a pas touché.
  useEffect(() => {
    if (touched) return;
    setTitle(c_.defaultTitle(currentMonth()));
    setMessage(c_.defaultMessage);
  }, [lang, touched, c_]);

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
          <h1>{c_.newTitle}</h1>
          <p className="sub">{c_.newSubtitle}</p>
        </div>
      </div>
      <form className="card" onSubmit={submit}>
        {error ? <div className="error">{error}</div> : null}
        <div className="field">
          <label htmlFor="t">{c_.fTitle}</label>
          <input id="t" required minLength={3} value={title} onChange={(e) => { setTouched(true); setTitle(e.target.value); }} />
        </div>
        <div className="field">
          <label htmlFor="m">{c_.fMessage}</label>
          <textarea id="m" value={message} onChange={(e) => { setTouched(true); setMessage(e.target.value); }} />
        </div>
        <div className="field">
          <label>{c_.fItems}</label>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            {(Object.keys(m.catalog.campaignItems) as CampaignItem[]).map((i) => (
              <label key={i} className="check" style={{ fontWeight: 500 }}>
                <input type="checkbox" checked={items.includes(i)} onChange={() => toggleItem(i)} />
                {m.catalog.campaignItems[i].label} <span className="muted small">— {m.catalog.campaignItems[i].hint}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>{c_.fWho}</label>
          {isManager ? (
            <>
              <div className="pills">
                <button type="button" className={`ghost small ${teamIds.length === 0 ? "on" : ""}`} onClick={() => setTeamIds([])}>
                  {c_.wholeOrg}
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
              {c_.yourTeam} <strong>{me?.team?.name ?? "—"}</strong>
            </p>
          )}
          <p className="muted small" style={{ margin: "0.4rem 0 0" }}>
            {c_.concerned(targeted)}
          </p>
        </div>
        <div className="field">
          <label htmlFor="d">{c_.fDeadline}</label>
          <input id="d" type="date" required value={closesOn} onChange={(e) => setClosesOn(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
        <div className="row">
          <button type="submit" disabled={items.length === 0}>
            {c_.launch}
          </button>
          <button type="button" className="ghost" onClick={() => router.back()}>
            {m.common.cancel}
          </button>
        </div>
      </form>
    </main>
  );
}
