"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/login", { body: { email, password } });
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={submit}>
      <h1>Connexion</h1>
      <p className="sub" style={{ marginBottom: "1.25rem" }}>
        Suis l&apos;adoption de l&apos;IA dans ton équipe.
      </p>
      {error ? <div className="error">{error}</div> : null}
      <div className="field">
        <label htmlFor="email">Email professionnel</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
        {busy ? "Connexion…" : "Se connecter"}
      </button>
      <p className="muted small" style={{ marginTop: "1rem", marginBottom: 0 }}>
        Pas encore de compte ? Demande un lien d&apos;invitation à ton team lead.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="center-box">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
