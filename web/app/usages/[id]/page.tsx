"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import RiskPill from "@/components/RiskPill";
import { api, type UseCase } from "@/lib/api";
import { fmtDate, fmtNum } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";

export default function UseCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { m } = useI18n();
  const [uc, setUc] = useState<UseCase | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<UseCase>(`/usecases/${id}`).then(setUc).catch((e) => setError((e as Error).message));
  }, [id]);

  async function react(kind: "like" | "adopt") {
    setUc(await api<UseCase>(`/usecases/${id}/react`, { body: { kind } }));
  }
  async function validate() {
    setUc(await api<UseCase>(`/usecases/${id}/validate`, { method: "POST" }));
  }
  async function remove() {
    if (!confirm(m.usecases.confirmDelete)) return;
    await api(`/usecases/${id}`, { method: "DELETE" });
    router.push("/usages");
  }
  async function copy() {
    if (!uc?.prompt) return;
    await navigator.clipboard.writeText(uc.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (error) return <main className="page narrow"><div className="error">{error}</div></main>;
  if (!uc) return <main className="page narrow muted">{m.common.loading}</main>;

  const hours = uc.minutes_saved_per_week / 60;
  return (
    <main className="page narrow">
      <p>
        <Link href="/usages" className="small">
          {m.usecases.all}
        </Link>
      </p>
      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="pills" style={{ marginBottom: "0.5rem" }}>
            <span className="pill blue">{m.catalog.categories[uc.category] ?? uc.category}</span>
            {uc.status === "validated" ? <span className="pill good">{m.usecases.validated}</span> : null}
            <RiskPill risk={uc.risk} />
          </div>
          <h1>{uc.title}</h1>
          <p className="sub">
            {uc.author ?? m.usecases.formerMember}
            {uc.team ? ` · ${uc.team}` : ""} · {fmtDate(uc.created_at)}
          </p>
        </div>
        <div className="row">
          {uc.can_edit ? (
            <>
              <Link href={`/usages/${uc.id}/modifier`} className="btn ghost small">
                {m.common.edit}
              </Link>
              <button className="danger small" onClick={remove}>
                {m.common.delete}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: "1rem" }}>
        <div className="card kpi">
          <div className="label">{m.usecases.timeSaved}</div>
          <div className="value">
            {hours >= 1 ? fmtNum(hours, 1) : uc.minutes_saved_per_week}
            <span className="unit">{hours >= 1 ? m.usecases.hPerWeek : m.usecases.minPerWeekUnit}</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">{m.usecases.alsoUse}</div>
          <div className="value">{uc.adopters}</div>
        </div>
        <div className="card kpi">
          <div className="label">{m.usecases.findUseful}</div>
          <div className="value">{uc.likes}</div>
        </div>
      </div>

      {!uc.mine ? (
        <div className="row" style={{ marginBottom: "1rem" }}>
          <button className={uc.adopted ? "on" : "ghost"} onClick={() => react("adopt")}>
            {uc.adopted ? m.usecases.iUseItTooOn : m.usecases.iUseItToo}
          </button>
          <button className={uc.liked ? "on" : "ghost"} onClick={() => react("like")}>
            {uc.liked ? m.usecases.usefulOn : m.usecases.useful}
          </button>
          {uc.can_validate ? (
            <button className="ghost" onClick={validate}>
              {uc.status === "validated" ? m.usecases.unvalidate : m.usecases.validate}
            </button>
          ) : null}
        </div>
      ) : uc.can_validate ? (
        <div className="row" style={{ marginBottom: "1rem" }}>
          <button className="ghost" onClick={validate}>
            {uc.status === "validated" ? m.usecases.unvalidate : m.usecases.validate}
          </button>
        </div>
      ) : null}

      {uc.problem ? (
        <div className="card">
          <h2>{m.usecases.problem}</h2>
          <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{uc.problem}</p>
        </div>
      ) : null}
      {uc.solution ? (
        <div className="card">
          <h2>{m.usecases.howTo}</h2>
          <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{uc.solution}</p>
        </div>
      ) : null}
      {uc.prompt ? (
        <div className="card">
          <div className="card-head">
            <h2>{m.usecases.prompt}</h2>
            <button className="ghost small" onClick={copy}>
              {copied ? m.common.copied : m.common.copy}
            </button>
          </div>
          <pre className="prompt">{uc.prompt}</pre>
        </div>
      ) : null}
      {uc.tools.length ? (
        <div className="card">
          <h2>{m.usecases.toolsTitle}</h2>
          <div className="pills">
            {uc.tools.map((t) => (
              <Link key={t} href={`/usages?tool=${encodeURIComponent(t)}`} className="pill">
                {t}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
