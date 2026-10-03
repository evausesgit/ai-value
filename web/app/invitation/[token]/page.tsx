"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLES } from "@/lib/catalog";

interface InviteInfo {
  org: string;
  team: string | null;
  role: string;
  email: string | null;
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
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
      await api(`/auth/invite/${token}`, { body: form });
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
          <h1>Lien invalide</h1>
          <p className="sub">{invalid} Demande un nouveau lien à ton team lead.</p>
        </div>
      </main>
    );
  }
  if (!info) return <main className="center-box muted">Chargement…</main>;

  return (
    <main className="center-box">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Bienvenue !</h1>
        <p className="sub" style={{ marginBottom: "1.25rem" }}>
          Tu rejoins <strong>{info.org}</strong>
          {info.team ? (
            <>
              {" "}— équipe <strong>{info.team}</strong>
            </>
          ) : null}{" "}
          en tant que {ROLES[info.role]?.toLowerCase()}.
        </p>
        {error ? <div className="error">{error}</div> : null}
        <div className="field">
          <label htmlFor="email">Email professionnel</label>
          <input id="email" type="email" required readOnly={!!info.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="name">Prénom et nom</label>
          <input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="job">
            Métier <span className="hint">(ex. Product manager, Comptable…)</span>
          </label>
          <input id="job" value={form.job} onChange={(e) => setForm({ ...form, job: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="password">
            Mot de passe <span className="hint">(10 caractères minimum)</span>
          </label>
          <input id="password" type="password" minLength={10} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
          {busy ? "Création…" : "Créer mon compte"}
        </button>
      </form>
    </main>
  );
}
