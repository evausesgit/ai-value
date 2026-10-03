"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { BarList, Delta, Kpi } from "@/components/charts";
import SkillsEditor from "@/components/SkillsEditor";
import ToolsEditor from "@/components/ToolsEditor";
import { api, type Campaign, type CampaignItem, type CampaignSummary, type UseCase } from "@/lib/api";
import { BLOCKERS, CAMPAIGN_ITEMS, DOMAINS, USAGE_LEVELS, fmtDay, fmtMinutes, fmtNum } from "@/lib/catalog";
import { hasRole, useSession } from "@/lib/session";

interface Results {
  campaign: Campaign;
  summary: CampaignSummary;
  previous: (CampaignSummary & { id: number; title: string }) | null;
  by_team: (CampaignSummary & { team: string })[];
  pending: { name: string; team: string }[];
  can_manage: boolean;
}

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useSession();
  const [mine, setMine] = useState<Campaign | null>(null);
  const [notMine, setNotMine] = useState(false);
  const [tab, setTab] = useState<"update" | "results" | null>(null);

  useEffect(() => {
    api<Campaign>(`/campaigns/${id}/me`)
      .then(setMine)
      .catch(() => setNotMine(true));
  }, [id]);

  const isLead = hasRole(me, "lead");
  useEffect(() => {
    if (tab !== null || !me) return;
    if (mine) setTab(isLead && mine.me?.completed_at ? "results" : "update");
    else if (notMine) setTab(isLead ? "results" : "update");
  }, [mine, notMine, me, isLead, tab]);

  if (!me || tab === null) return <main className="page narrow muted">Chargement…</main>;
  if (!mine && !isLead)
    return (
      <main className="page narrow">
        <div className="card empty">Cette campagne ne te concerne pas.</div>
      </main>
    );

  return (
    <main className="page">
      <p>
        <Link href={isLead ? "/campagnes" : "/"} className="small">
          ← {isLead ? "Campagnes" : "Mon espace"}
        </Link>
      </p>
      {isLead && mine ? (
        <div className="tabs">
          <button className={tab === "update" ? "on" : ""} onClick={() => setTab("update")}>
            Ma mise à jour
          </button>
          <button className={tab === "results" ? "on" : ""} onClick={() => setTab("results")}>
            Résultats
          </button>
        </div>
      ) : null}
      {tab === "update" && mine ? <MyUpdate initial={mine} /> : null}
      {tab === "results" ? <ResultsView id={id} /> : null}
    </main>
  );
}

// --- Côté collaborateur -----------------------------------------------------------

function MyUpdate({ initial }: { initial: Campaign }) {
  const [c, setC] = useState(initial);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const done = new Set(c.me?.done_items ?? []);
  const allDone = c.items.every((i) => done.has(i));
  const readOnly = !c.open;

  async function toggle(item: CampaignItem) {
    const next = done.has(item) ? [...done].filter((x) => x !== item) : [...done, item];
    setC(await api<Campaign>(`/campaigns/${c.id}/me`, { method: "PUT", body: { done_items: next } }));
  }

  async function submit() {
    setError("");
    try {
      setC(await api<Campaign>(`/campaigns/${c.id}/me/submit`, { method: "POST" }));
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div>
          <h1>{c.title}</h1>
          <p className="sub">
            Demandé par {c.author ?? "ton équipe de pilotage"} · {c.open ? `à faire avant le ${fmtDay(c.closes_on)}` : "campagne close"}
          </p>
        </div>
      </div>
      {c.message ? (
        <div className="card" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.message}</p>
        </div>
      ) : null}
      {sent ? <div className="success" style={{ marginTop: "1rem" }}>Merci ! Ta mise à jour est envoyée.</div> : null}
      {c.me?.completed_at && !sent ? (
        <div className="success" style={{ marginTop: "1rem" }}>
          Envoyée le {fmtDay(c.me.completed_at)}.{c.open ? " Tu peux encore modifier puis renvoyer jusqu'à la date limite." : ""}
        </div>
      ) : null}

      {c.items.map((item, i) => (
        <div className="card" key={item} style={{ marginTop: "1rem" }}>
          <div className="card-head">
            <h2>
              {i + 1}. {CAMPAIGN_ITEMS[item].label}
              <span className="muted small" style={{ fontWeight: 400 }}> — {CAMPAIGN_ITEMS[item].hint}</span>
            </h2>
            {done.has(item) ? <span className="pill good">✓ Fait</span> : null}
          </div>
          {item === "tools" ? <ToolsEditor compact /> : null}
          {item === "skills" ? <SkillsEditor /> : null}
          {item === "usecases" ? <MyUseCases /> : null}
          {item === "checkin" ? (
            <Checkin campaign={c} onSaved={setC} disabled={readOnly} />
          ) : (
            !readOnly && (
              <div className="row" style={{ marginTop: "0.75rem" }}>
                <button className={done.has(item) ? "on" : ""} onClick={() => toggle(item)}>
                  {done.has(item) ? "✓ C'est à jour" : "C'est à jour"}
                </button>
              </div>
            )
          )}
        </div>
      ))}

      {!readOnly ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          {error ? <div className="error">{error}</div> : null}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted small">
              {done.size} / {c.items.length} étapes validées
            </span>
            <button onClick={submit} disabled={!allDone}>
              {c.me?.completed_at ? "Renvoyer ma mise à jour" : "Envoyer ma mise à jour"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MyUseCases() {
  const [items, setItems] = useState<UseCase[] | null>(null);
  useEffect(() => {
    api<UseCase[]>("/usecases?mine=true").then(setItems);
  }, []);
  const total = (items ?? []).reduce((a, u) => a + u.minutes_saved_per_week, 0);
  return (
    <div>
      <p className="small muted">
        Vérifie que tes use cases sont à jour, et surtout le <strong>temps gagné par semaine</strong> : c&apos;est ce qui permet
        de mesurer l&apos;impact. Si tu utilises le use case d&apos;un collègue, clique « Je l&apos;utilise aussi » dans le{" "}
        <Link href="/usages" target="_blank">
          catalogue
        </Link>
        .
      </p>
      {items === null ? (
        <p className="muted">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="empty small">Tu n&apos;as pas encore partagé de use case.</div>
      ) : (
        <table>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.title}</td>
                <td className="num">{fmtMinutes(u.minutes_saved_per_week)} / sem.</td>
                <td className="num">
                  <Link href={`/usages/${u.id}/modifier`} target="_blank" className="small">
                    Modifier
                  </Link>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td className="num">
                <strong>{fmtMinutes(total)} / sem.</strong>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      )}
      <div className="row" style={{ marginTop: "0.6rem" }}>
        <Link href="/usages/nouveau" target="_blank" className="btn ghost small">
          + Ajouter un use case
        </Link>
        <button className="ghost small" onClick={() => api<UseCase[]>("/usecases?mine=true").then(setItems)}>
          Rafraîchir
        </button>
      </div>
    </div>
  );
}

function Checkin({ campaign, onSaved, disabled }: { campaign: Campaign; onSaved: (c: Campaign) => void; disabled: boolean }) {
  const m = campaign.me;
  const [form, setForm] = useState({
    usage_level: m?.usage_level ?? -1,
    satisfaction: m?.satisfaction ?? 0,
    blockers: m?.blockers ?? [],
    comment: m?.comment ?? "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    if (form.usage_level < 0 || form.satisfaction < 1) {
      setError("Réponds aux deux premières questions.");
      return;
    }
    setError("");
    onSaved(await api<Campaign>(`/campaigns/${campaign.id}/me`, { method: "PUT", body: { checkin: form } }));
    setSaved(true);
  }
  const toggleBlocker = (b: string) =>
    setForm((f) => ({ ...f, blockers: f.blockers.includes(b) ? f.blockers.filter((x) => x !== b) : [...f.blockers, b] }));

  return (
    <fieldset disabled={disabled} style={{ border: "none", padding: 0, margin: 0 }}>
      <p className="small muted">Anonymisé : seuls des agrégats d&apos;au moins 3 personnes sont montrés.</p>
      {error ? <div className="error">{error}</div> : null}
      <div className="field">
        <label>En ce moment, tu utilises l&apos;IA…</label>
        <div className="scale">
          {USAGE_LEVELS.map((l, i) => (
            <button key={l} type="button" className={form.usage_level === i ? "on" : ""} onClick={() => setForm({ ...form, usage_level: i })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Es-tu satisfait·e de ce que l&apos;IA t&apos;apporte ?</label>
        <div className="scale">
          {["Pas du tout", "Peu", "Moyennement", "Plutôt", "Très"].map((l, i) => (
            <button key={l} type="button" className={form.satisfaction === i + 1 ? "on" : ""} onClick={() => setForm({ ...form, satisfaction: i + 1 })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>
          Qu&apos;est-ce qui te freine ? <span className="hint">(facultatif)</span>
        </label>
        <div className="pills">
          {Object.entries(BLOCKERS).map(([k, l]) => (
            <button key={k} type="button" className={`ghost small ${form.blockers.includes(k) ? "on" : ""}`} onClick={() => toggleBlocker(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="comment">
          Un mot ? <span className="hint">(facultatif)</span>
        </label>
        <textarea id="comment" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Une réussite, une difficulté, une idée…" style={{ minHeight: 60 }} />
      </div>
      <div className="row">
        <button onClick={save}>{m?.satisfaction ? "Mettre à jour mon ressenti" : "Enregistrer mon ressenti"}</button>
        {saved ? <span className="pill good">✓ Enregistré</span> : null}
      </div>
    </fieldset>
  );
}

// --- Côté demandeur ----------------------------------------------------------------

function ResultsView({ id }: { id: string }) {
  const router = useRouter();
  const [r, setR] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [extendTo, setExtendTo] = useState("");

  const load = useCallback(() => {
    api<Results>(`/campaigns/${id}/results`).then(setR).catch((e) => setError((e as Error).message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <div className="error">{error}</div>;
  if (!r) return <p className="muted">Chargement…</p>;
  const { campaign: c, summary: s, previous: p } = r;

  async function close() {
    if (!confirm("Clore la campagne ? Plus personne ne pourra répondre.")) return;
    await api(`/campaigns/${id}/close`, { method: "POST" });
    load();
  }
  async function extend() {
    if (!extendTo) return;
    await api(`/campaigns/${id}/extend`, { body: { closes_on: extendTo } });
    setExtendTo("");
    load();
  }
  async function remove() {
    if (!confirm("Supprimer la campagne et toutes ses réponses ?")) return;
    await api(`/campaigns/${id}`, { method: "DELETE" });
    router.push("/campagnes");
  }
  async function copyReminder() {
    const url = `${window.location.origin}/campagnes/${id}`;
    const text = `Petit rappel : « ${c.title} » — 5 minutes pour mettre à jour tes outils IA, ton auto-évaluation et tes use cases, avant le ${fmtDay(c.closes_on)}. ${url}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="pills" style={{ marginBottom: "0.4rem" }}>
            {c.open ? <span className="pill blue">● En cours</span> : <span className="pill">■ Close</span>}
          </div>
          <h1>{c.title}</h1>
          <p className="sub">
            Lancée le {c.opens_at ? fmtDay(c.opens_at) : "—"} par {c.author ?? "—"} · {c.open ? `jusqu'au ${fmtDay(c.closes_on)}` : `clôture le ${fmtDay(c.closes_on)}`}
            {p ? ` · comparée à « ${p.title} »` : ""}
          </p>
        </div>
        {r.can_manage ? (
          <div className="row">
            <input type="date" value={extendTo} onChange={(e) => setExtendTo(e.target.value)} style={{ width: "auto" }} aria-label="Nouvelle date limite" />
            <button className="ghost small" onClick={extend} disabled={!extendTo}>
              {c.open ? "Prolonger" : "Rouvrir"}
            </button>
            {c.open ? (
              <button className="ghost small" onClick={close}>
                Clore
              </button>
            ) : null}
            <button className="danger small" onClick={remove}>
              Supprimer
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid g4">
        <Kpi label="Participation" value={s.participation} unit=" %" foot={`${s.respondents} / ${s.targeted} ont répondu`} />
        <Kpi
          label="Adoption"
          value={s.adoption_pct}
          unit=" %"
          foot={<>répondants utilisant un outil chaque semaine {p ? <Delta now={s.adoption_pct} before={p.adoption_pct} unit=" pts" /> : null}</>}
        />
        <Kpi
          label="Temps gagné"
          value={s.hours_saved}
          unit=" h/sem."
          foot={<>soit {fmtNum(s.hours_saved_avg, 1)} h par personne {p ? <Delta now={s.hours_saved_avg} before={p.hours_saved_avg} unit=" h" digits={1} /> : null}</>}
        />
        <Kpi
          label="Satisfaction"
          value={s.satisfaction}
          unit=" / 5"
          digits={1}
          foot={s.satisfaction === null ? (c.items.includes("checkin") ? "Masqué : moins de 3 réponses" : "Non demandé") : p ? <Delta now={s.satisfaction} before={p.satisfaction} digits={1} /> : `${s.checkin_respondents} réponses`}
        />
      </div>

      <div className="grid g2 section">
        <div className="card">
          <div className="card-head">
            <h2>Compétences déclarées</h2>
            <span className="muted small">niveau moyen {fmtNum(s.skills_avg, 1)} / 3 {p ? <Delta now={s.skills_avg} before={p.skills_avg} digits={1} /> : null}</span>
          </div>
          <BarList
            rows={Object.entries(s.skills)
              .filter(([, v]) => v !== null)
              .map(([d, v]) => ({ label: DOMAINS[d]?.label ?? d, value: v as number }))}
            max={3}
            format={(v) => `${fmtNum(v, 1)} / 3`}
          />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Freins remontés</h2>
          </div>
          {s.blockers === null ? (
            <div className="empty small">{c.items.includes("checkin") ? "Masqué : moins de 3 réponses." : "Ressenti non demandé."}</div>
          ) : (
            <BarList rows={s.blockers.map((b) => ({ label: BLOCKERS[b.blocker] ?? b.blocker, value: b.count }))} format={(v) => `${v}`} />
          )}
          {s.comments && s.comments.length ? (
            <>
              <h3 style={{ marginTop: "1rem" }}>Verbatims</h3>
              <ul style={{ paddingLeft: "1.1rem", margin: 0 }}>
                {s.comments.slice(0, 8).map((t, i) => (
                  <li key={i} className="small" style={{ marginBottom: "0.35rem" }}>
                    « {t} »
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>

      {r.by_team.length ? (
        <div className="card section">
          <h2>Par équipe</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Équipe</th>
                  <th className="num">Réponses</th>
                  <th className="num">Adoption</th>
                  <th className="num">Temps gagné</th>
                  <th className="num">Compétences</th>
                  <th className="num">Satisf.</th>
                </tr>
              </thead>
              <tbody>
                {r.by_team.map((t) => (
                  <tr key={t.team}>
                    <td>
                      <strong>{t.team}</strong>
                    </td>
                    <td className="num">
                      {t.respondents} / {t.targeted}
                    </td>
                    <td className="num">{fmtNum(t.adoption_pct, 0, " %")}</td>
                    <td className="num">{fmtNum(t.hours_saved, 0, " h/sem.")}</td>
                    <td className="num">{fmtNum(t.skills_avg, 1)}</td>
                    <td className="num" title={t.satisfaction === null ? "Masqué : moins de 3 réponses" : ""}>
                      {fmtNum(t.satisfaction, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="card section">
        <div className="card-head">
          <h2>En attente ({r.pending.length})</h2>
          {c.open && r.pending.length ? (
            <button className="ghost small" onClick={copyReminder}>
              {copied ? "Copié ✓" : "Copier un message de relance"}
            </button>
          ) : null}
        </div>
        {r.pending.length === 0 ? (
          <div className="empty small">Tout le monde a répondu 🎉</div>
        ) : (
          <div className="pills">
            {r.pending.map((x) => (
              <span key={`${x.team}-${x.name}`} className="pill">
                {x.name} <span className="muted">· {x.team}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
