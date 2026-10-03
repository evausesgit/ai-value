"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LANGS, type Lang, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export default function ProfilePage() {
  const { me, refresh } = useSession();
  const { m, lang, setLang } = useI18n();
  const [profile, setProfile] = useState({ name: "", job: "" });
  const [pwd, setPwd] = useState({ current: "", new: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (me) setProfile({ name: me.name, job: me.job });
  }, [me]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/auth/me", { method: "PUT", body: { ...profile, lang } });
      await refresh();
      setMsg({ ok: true, text: m.profile.saved });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  async function changeLang(l: Lang) {
    setLang(l);
    await api("/auth/me/lang", { method: "PUT", body: { lang: l } }).catch(() => {});
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/auth/password", { body: pwd });
      setPwd({ current: "", new: "" });
      setMsg({ ok: true, text: m.profile.changed });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  if (!me) return <main className="page muted">{m.common.loading}</main>;
  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>{m.profile.title}</h1>
          <p className="sub">
            {me.email} · {m.catalog.roles[me.role]}
            {me.team ? ` · ${me.team.name}` : ""} · {me.org.name}
          </p>
        </div>
      </div>
      {msg ? <div className={msg.ok ? "success" : "error"}>{msg.text}</div> : null}
      <form className="card" onSubmit={saveProfile}>
        <h2>{m.profile.info}</h2>
        <div className="field">
          <label htmlFor="name">{m.profile.name}</label>
          <input id="name" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="job">{m.profile.job}</label>
          <input id="job" value={profile.job} onChange={(e) => setProfile({ ...profile, job: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="lang">{m.profile.language}</label>
          <select id="lang" value={lang} onChange={(e) => changeLang(e.target.value as Lang)} style={{ maxWidth: 220 }}>
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">{m.common.save}</button>
      </form>
      <form className="card" onSubmit={savePassword}>
        <h2>{m.profile.password}</h2>
        <div className="field">
          <label htmlFor="cur">{m.profile.current}</label>
          <input id="cur" type="password" required autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="new">
            {m.profile.newPassword} <span className="hint">{m.profile.newHint}</span>
          </label>
          <input id="new" type="password" minLength={10} required autoComplete="new-password" value={pwd.new} onChange={(e) => setPwd({ ...pwd, new: e.target.value })} />
        </div>
        <button type="submit">{m.profile.change}</button>
      </form>
    </main>
  );
}
