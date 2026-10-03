"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLES } from "@/lib/catalog";
import { useSession } from "@/lib/session";

export default function ProfilePage() {
  const { me, refresh } = useSession();
  const [profile, setProfile] = useState({ name: "", job: "" });
  const [pwd, setPwd] = useState({ current: "", new: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (me) setProfile({ name: me.name, job: me.job });
  }, [me]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/auth/me", { method: "PUT", body: profile });
      await refresh();
      setMsg({ ok: true, text: "Profil enregistré." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/auth/password", { body: pwd });
      setPwd({ current: "", new: "" });
      setMsg({ ok: true, text: "Mot de passe modifié." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  if (!me) return <main className="page muted">Chargement…</main>;
  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>Mon profil</h1>
          <p className="sub">
            {me.email} · {ROLES[me.role]}
            {me.team ? ` · ${me.team.name}` : ""} · {me.org.name}
          </p>
        </div>
      </div>
      {msg ? <div className={msg.ok ? "success" : "error"}>{msg.text}</div> : null}
      <form className="card" onSubmit={saveProfile}>
        <h2>Informations</h2>
        <div className="field">
          <label htmlFor="name">Prénom et nom</label>
          <input id="name" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="job">Métier</label>
          <input id="job" value={profile.job} onChange={(e) => setProfile({ ...profile, job: e.target.value })} />
        </div>
        <button type="submit">Enregistrer</button>
      </form>
      <form className="card" onSubmit={savePassword}>
        <h2>Mot de passe</h2>
        <div className="field">
          <label htmlFor="cur">Mot de passe actuel</label>
          <input id="cur" type="password" required autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="new">
            Nouveau mot de passe <span className="hint">(10 caractères minimum)</span>
          </label>
          <input id="new" type="password" minLength={10} required autoComplete="new-password" value={pwd.new} onChange={(e) => setPwd({ ...pwd, new: e.target.value })} />
        </div>
        <button type="submit">Changer le mot de passe</button>
      </form>
    </main>
  );
}
