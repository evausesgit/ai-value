"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { BarList, Delta, Kpi } from "@/components/charts";
import SkillsEditor from "@/components/SkillsEditor";
import ToolsEditor from "@/components/ToolsEditor";
import { api, type Campaign, type CampaignItem, type CampaignSummary, type UseCase } from "@/lib/api";
import { fmtDay, fmtMinutes, fmtNum } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";
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
  const { m } = useI18n();
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

  if (!me || tab === null) return <main className="page narrow muted">{m.common.loading}</main>;
  if (!mine && !isLead)
    return (
      <main className="page narrow">
        <div className="card empty">{m.campaigns.notForYou}</div>
      </main>
    );

  return (
    <main className="page">
      <p>
        <Link href={isLead ? "/campagnes" : "/"} className="small">
          {isLead ? m.campaigns.backList : m.campaigns.backHome}
        </Link>
      </p>
      {isLead && mine ? (
        <div className="tabs">
          <button className={tab === "update" ? "on" : ""} onClick={() => setTab("update")}>
            {m.campaigns.myUpdate}
          </button>
          <button className={tab === "results" ? "on" : ""} onClick={() => setTab("results")}>
            {m.campaigns.results}
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
  const { m } = useI18n();
  const t = m.campaigns;
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
            {t.requestedBy(c.author)} · {c.open ? t.beforeDate(fmtDay(c.closes_on)) : t.closedLabel}
          </p>
        </div>
      </div>
      {c.message ? (
        <div className="card" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.message}</p>
        </div>
      ) : null}
      {sent ? <div className="success" style={{ marginTop: "1rem" }}>{t.thanksSent}</div> : null}
      {c.me?.completed_at && !sent ? (
        <div className="success" style={{ marginTop: "1rem" }}>
          {t.sentOn(fmtDay(c.me.completed_at))}
          {c.open ? t.canResend : ""}
        </div>
      ) : null}

      {c.items.map((item, i) => (
        <div className="card" key={item} style={{ marginTop: "1rem" }}>
          <div className="card-head">
            <h2>
              {i + 1}. {m.catalog.campaignItems[item].label}
              <span className="muted small" style={{ fontWeight: 400 }}> — {m.catalog.campaignItems[item].hint}</span>
            </h2>
            {done.has(item) ? <span className="pill good">{t.done}</span> : null}
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
                  {done.has(item) ? t.upToDateOn : t.upToDate}
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
              {t.stepsDone(done.size, c.items.length)}
            </span>
            <button onClick={submit} disabled={!allDone}>
              {c.me?.completed_at ? t.resend : t.send}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MyUseCases() {
  const { m } = useI18n();
  const t = m.campaigns;
  const [items, setItems] = useState<UseCase[] | null>(null);
  useEffect(() => {
    api<UseCase[]>("/usecases?mine=true").then(setItems);
  }, []);
  const total = (items ?? []).reduce((a, u) => a + u.minutes_saved_per_week, 0);
  return (
    <div>
      <p className="small muted">
        {t.ucIntro1}
        <strong>{t.ucIntroStrong}</strong>
        {t.ucIntro2}
        <Link href="/usages" target="_blank">
          {t.catalogLink}
        </Link>
        .
      </p>
      {items === null ? (
        <p className="muted">{m.common.loading}</p>
      ) : items.length === 0 ? (
        <div className="empty small">{t.noUseCase}</div>
      ) : (
        <table>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.title}</td>
                <td className="num">{fmtMinutes(u.minutes_saved_per_week)} {m.common.perWeek}</td>
                <td className="num">
                  <Link href={`/usages/${u.id}/modifier`} target="_blank" className="small">
                    {m.common.edit}
                  </Link>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>{t.total}</strong>
              </td>
              <td className="num">
                <strong>{fmtMinutes(total)} {m.common.perWeek}</strong>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      )}
      <div className="row" style={{ marginTop: "0.6rem" }}>
        <Link href="/usages/nouveau" target="_blank" className="btn ghost small">
          {t.addUseCase}
        </Link>
        <button className="ghost small" onClick={() => api<UseCase[]>("/usecases?mine=true").then(setItems)}>
          {t.refresh}
        </button>
      </div>
    </div>
  );
}

function Checkin({ campaign, onSaved, disabled }: { campaign: Campaign; onSaved: (c: Campaign) => void; disabled: boolean }) {
  const { m } = useI18n();
  const t = m.campaigns;
  const mine = campaign.me;
  const [form, setForm] = useState({
    usage_level: mine?.usage_level ?? -1,
    satisfaction: mine?.satisfaction ?? 0,
    blockers: mine?.blockers ?? [],
    comment: mine?.comment ?? "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    if (form.usage_level < 0 || form.satisfaction < 1) {
      setError(t.checkinRequired);
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
      <p className="small muted">{t.checkinAnon}</p>
      {error ? <div className="error">{error}</div> : null}
      <div className="field">
        <label>{t.checkinUsage}</label>
        <div className="scale">
          {m.catalog.usageLevels.map((l, i) => (
            <button key={l} type="button" className={form.usage_level === i ? "on" : ""} onClick={() => setForm({ ...form, usage_level: i })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>{t.checkinSatisfaction}</label>
        <div className="scale">
          {m.catalog.satisfaction.map((l, i) => (
            <button key={l} type="button" className={form.satisfaction === i + 1 ? "on" : ""} onClick={() => setForm({ ...form, satisfaction: i + 1 })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>
          {t.checkinBlockers} <span className="hint">{t.optional}</span>
        </label>
        <div className="pills">
          {Object.entries(m.catalog.blockers).map(([k, l]) => (
            <button key={k} type="button" className={`ghost small ${form.blockers.includes(k) ? "on" : ""}`} onClick={() => toggleBlocker(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="comment">
          {t.checkinComment} <span className="hint">{t.optional}</span>
        </label>
        <textarea id="comment" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder={t.checkinCommentPh} style={{ minHeight: 60 }} />
      </div>
      <div className="row">
        <button onClick={save}>{mine?.satisfaction ? t.checkinUpdate : t.checkinSave}</button>
        {saved ? <span className="pill good">✓ {m.common.saved}</span> : null}
      </div>
    </fieldset>
  );
}

// --- Côté demandeur ----------------------------------------------------------------

function ResultsView({ id }: { id: string }) {
  const { m } = useI18n();
  const t = m.campaigns;
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
  if (!r) return <p className="muted">{m.common.loading}</p>;
  const { campaign: c, summary: s, previous: p } = r;

  async function close() {
    if (!confirm(t.confirmClose)) return;
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
    if (!confirm(t.confirmDelete)) return;
    await api(`/campaigns/${id}`, { method: "DELETE" });
    router.push("/campagnes");
  }
  async function copyReminder() {
    const url = `${window.location.origin}/campagnes/${id}`;
    const text = t.reminder(c.title, fmtDay(c.closes_on), url);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="pills" style={{ marginBottom: "0.4rem" }}>
            {c.open ? <span className="pill blue">{t.open}</span> : <span className="pill">{t.closed}</span>}
          </div>
          <h1>{c.title}</h1>
          <p className="sub">
            {t.launchedOn(c.opens_at ? fmtDay(c.opens_at) : "—", c.author ?? "—")} · {c.open ? t.until(fmtDay(c.closes_on)) : t.closesOn(fmtDay(c.closes_on))}
            {p ? ` · ${t.comparedTo(p.title)}` : ""}
          </p>
        </div>
        {r.can_manage ? (
          <div className="row">
            <input type="date" value={extendTo} onChange={(e) => setExtendTo(e.target.value)} style={{ width: "auto" }} aria-label={t.newDeadline} />
            <button className="ghost small" onClick={extend} disabled={!extendTo}>
              {c.open ? t.extend : t.reopen}
            </button>
            {c.open ? (
              <button className="ghost small" onClick={close}>
                {t.close}
              </button>
            ) : null}
            <button className="danger small" onClick={remove}>
              {m.common.delete}
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid g4">
        <Kpi label={t.participation} value={s.participation} unit=" %" foot={t.respondedFoot(s.respondents, s.targeted)} />
        <Kpi
          label={t.adoption}
          value={s.adoption_pct}
          unit=" %"
          foot={<>{t.adoptionFoot} {p ? <Delta now={s.adoption_pct} before={p.adoption_pct} unit=" pts" /> : null}</>}
        />
        <Kpi
          label={t.timeSaved}
          value={s.hours_saved}
          unit={` h ${m.common.perWeek}`}
          foot={<>{t.timeSavedFoot(fmtNum(s.hours_saved_avg, 1))} {p ? <Delta now={s.hours_saved_avg} before={p.hours_saved_avg} unit=" h" digits={1} /> : null}</>}
        />
        <Kpi
          label={t.satisfaction}
          value={s.satisfaction}
          unit=" / 5"
          digits={1}
          foot={s.satisfaction === null ? (c.items.includes("checkin") ? m.common.hiddenSmall : t.notAsked) : p ? <Delta now={s.satisfaction} before={p.satisfaction} digits={1} /> : m.common.answers(s.checkin_respondents)}
        />
      </div>

      <div className="grid g2 section">
        <div className="card">
          <div className="card-head">
            <h2>{t.declaredSkills}</h2>
            <span className="muted small">{t.avgLevel(fmtNum(s.skills_avg, 1))} {p ? <Delta now={s.skills_avg} before={p.skills_avg} digits={1} /> : null}</span>
          </div>
          <BarList
            rows={Object.entries(s.skills)
              .filter(([, v]) => v !== null)
              .map(([d, v]) => ({ label: m.catalog.domains[d]?.label ?? d, value: v as number }))}
            max={3}
            format={(v) => `${fmtNum(v, 1)} / 3`}
          />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>{t.blockers}</h2>
          </div>
          {s.blockers === null ? (
            <div className="empty small">{c.items.includes("checkin") ? m.common.hiddenSmallDot : t.checkinNotAsked}</div>
          ) : (
            <BarList rows={s.blockers.map((b) => ({ label: m.catalog.blockers[b.blocker] ?? b.blocker, value: b.count }))} format={(v) => `${v}`} />
          )}
          {s.comments && s.comments.length ? (
            <>
              <h3 style={{ marginTop: "1rem" }}>{t.verbatims}</h3>
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
          <h2>{t.byTeam}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.team}</th>
                  <th className="num">{t.responses}</th>
                  <th className="num">{t.adoption}</th>
                  <th className="num">{t.timeSaved}</th>
                  <th className="num">{t.skillsCol}</th>
                  <th className="num">{t.satisfactionShort}</th>
                </tr>
              </thead>
              <tbody>
                {r.by_team.map((row) => (
                  <tr key={row.team}>
                    <td>
                      <strong>{row.team}</strong>
                    </td>
                    <td className="num">
                      {row.respondents} / {row.targeted}
                    </td>
                    <td className="num">{fmtNum(row.adoption_pct, 0, " %")}</td>
                    <td className="num">{fmtNum(row.hours_saved, 0, ` h ${m.common.perWeek}`)}</td>
                    <td className="num">{fmtNum(row.skills_avg, 1)}</td>
                    <td className="num" title={row.satisfaction === null ? m.common.hiddenSmall : ""}>
                      {fmtNum(row.satisfaction, 1)}
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
          <h2>{t.pending(r.pending.length)}</h2>
          {c.open && r.pending.length ? (
            <button className="ghost small" onClick={copyReminder}>
              {copied ? m.common.copied : t.copyReminder}
            </button>
          ) : null}
        </div>
        {r.pending.length === 0 ? (
          <div className="empty small">{t.allAnswered}</div>
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
