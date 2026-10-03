"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface InviteInfo {
  org: string;
  team: string | null;
  role: string;
  email: string | null;
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { m, lang } = useI18n();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [invalid, setInvalid] = useState("");
  const [form, setForm] = useState({ email: "", name: "", job: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<InviteInfo>(`/auth/invite/${token}`)
      .then((i) => {
        setInfo(i);
        if (i.email) setForm((f) => ({ ...f, email: i.email as string }));
      })
      .catch((e) => setInvalid((e as Error).message));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/auth/invite/${token}`, { body: { ...form, lang } });
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (invalid) {
    return (
      <main className="center-box">
        <div className="card auth-card">
          <h1>{m.invite.invalidTitle}</h1>
          <p className="sub">{invalid} {m.invite.invalidHelp}</p>
        </div>
      </main>
    );
  }
  if (!info) return <main className="center-box muted">{m.common.loading}</main>;

  return (
    <main className="center-box">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{m.invite.welcome}</h1>
        <p className="sub" style={{ marginBottom: "1.25rem" }}>
          {m.invite.joining(info.org, info.team, m.catalog.roles[info.role] ?? info.role)}
        </p>
        {error ? <div className="error">{error}</div> : null}
        <div className="field">
          <label htmlFor="email">{m.login.email}</label>
          <input id="email" type="email" required readOnly={!!info.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="name">{m.invite.name}</label>
          <input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="job">
            {m.invite.job} <span className="hint">{m.invite.jobHint}</span>
          </label>
          <input id="job" value={form.job} onChange={(e) => setForm({ ...form, job: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="password">
            {m.invite.password} <span className="hint">{m.invite.passwordHint}</span>
          </label>
          <input id="password" type="password" minLength={10} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
          {busy ? m.invite.submitting : m.invite.submit}
        </button>
      </form>
    </main>
  );
}
