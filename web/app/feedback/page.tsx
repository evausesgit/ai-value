"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type FeedbackItem } from "@/lib/api";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, fmtDate } from "@/lib/catalog";
import { hasRole, useSession } from "@/lib/session";

const STATUS_CLS: Record<string, string> = { new: "blue", in_progress: "warn", done: "good" };

export default function FeedbackPage() {
  const { me } = useSession();
  const isLead = hasRole(me, "lead");
  const [tab, setTab] = useState<"write" | "inbox">("write");

  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>Feedback</h1>
          <p className="sub">Un frein, une idée, un besoin ? Ton retour arrive directement à ton équipe de pilotage.</p>
        </div>
      </div>
      {isLead ? (
        <div className="tabs">
          <button className={tab === "write" ? "on" : ""} onClick={() => setTab("write")}>
            Donner un feedback
          </button>
          <button className={tab === "inbox" ? "on" : ""} onClick={() => setTab("inbox")}>
            Boîte de réception {hasRole(me, "manager") ? "(organisation)" : "(mon équipe)"}
          </button>
        </div>
      ) : null}
      {tab === "write" ? <Write /> : <Inbox />}
    </main>
  );
}

function Write() {
  const [kind, setKind] = useState("idee");
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [mine, setMine] = useState<FeedbackItem[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<FeedbackItem[]>("/feedback/mine").then(setMine);
  }, []);
  useEffect(load, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api("/feedback", { body: { kind, text, anonymous } });
    setText("");
    setMsg(anonymous ? "Merci ! Feedback envoyé anonymement : il n'est rattaché à aucun compte." : "Merci ! Tu verras la réponse ici.");
    load();
  }

  return (
    <>
      <form className="card" onSubmit={submit}>
        {msg ? <div className="success">{msg}</div> : null}
        <div className="field">
          <label>C&apos;est…</label>
          <div className="pills">
            {Object.entries(FEEDBACK_KINDS).map(([k, l]) => (
              <button key={k} type="button" className={`ghost small ${kind === k ? "on" : ""}`} onClick={() => setKind(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="txt">Ton message</label>
          <textarea id="txt" required minLength={3} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Envoyer anonymement
          </label>
          <div className="hint small muted">
            Anonyme = ton nom n&apos;est enregistré nulle part (seule ton équipe l&apos;est). Tu ne pourras pas suivre la réponse.
          </div>
        </div>
        <button type="submit">Envoyer</button>
      </form>
      {mine.length ? (
        <div className="section">
          <h2>Mes feedbacks</h2>
          {mine.map((f) => (
            <FeedbackCard key={f.id} f={f} />
          ))}
        </div>
      ) : null}
    </>
  );
}

function FeedbackCard({ f, children }: { f: FeedbackItem; children?: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="pills">
          <span className="pill">{FEEDBACK_KINDS[f.kind] ?? f.kind}</span>
          <span className={`pill ${STATUS_CLS[f.status]}`}>{FEEDBACK_STATUSES[f.status]}</span>
        </div>
        <span className="muted tiny">
          {f.anonymous ? "Anonyme" : f.author}
          {f.team ? ` · ${f.team}` : ""} · {fmtDate(f.created_at)}
        </span>
      </div>
      <p style={{ whiteSpace: "pre-wrap" }}>{f.text}</p>
      {f.response && !children ? (
        <p className="small" style={{ background: "var(--surface-2)", padding: "0.6rem 0.8rem", borderRadius: 10, marginBottom: 0 }}>
          <strong>Réponse :</strong> {f.response}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function Inbox() {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [status, setStatus] = useState("");

  const load = useCallback(() => {
    api<FeedbackItem[]>(`/feedback/inbox${status ? `?status=${status}` : ""}`).then(setItems);
  }, [status]);
  useEffect(load, [load]);

  return (
    <>
      <div className="pills" style={{ marginBottom: "1rem" }}>
        {[["", "Tous"], ...Object.entries(FEEDBACK_STATUSES)].map(([k, l]) => (
          <button key={k} className={`ghost small ${status === k ? "on" : ""}`} onClick={() => setStatus(k)}>
            {l}
          </button>
        ))}
      </div>
      {items === null ? (
        <p className="muted">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="card empty">Rien ici pour l&apos;instant.</div>
      ) : (
        items.map((f) => <InboxItem key={f.id} f={f} onSaved={load} />)
      )}
    </>
  );
}

function InboxItem({ f, onSaved }: { f: FeedbackItem; onSaved: () => void }) {
  const [status, setStatus] = useState(f.status);
  const [response, setResponse] = useState(f.response);
  const [saved, setSaved] = useState(false);
  const dirty = status !== f.status || response !== f.response;

  async function save() {
    await api(`/feedback/${f.id}`, { method: "PATCH", body: { status, response } });
    setSaved(true);
    onSaved();
  }

  return (
    <FeedbackCard f={f}>
      <div className="field" style={{ marginTop: "0.5rem" }}>
        <textarea placeholder="Répondre (visible par l'auteur s'il n'est pas anonyme)" value={response} onChange={(e) => setResponse(e.target.value)} style={{ minHeight: 60 }} />
      </div>
      <div className="row">
        <select value={status} onChange={(e) => setStatus(e.target.value as FeedbackItem["status"])} style={{ width: "auto" }}>
          {Object.entries(FEEDBACK_STATUSES).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <button className="small" disabled={!dirty} onClick={save}>
          Enregistrer
        </button>
        {saved && !dirty ? <span className="pill good">✓</span> : null}
      </div>
    </FeedbackCard>
  );
}
