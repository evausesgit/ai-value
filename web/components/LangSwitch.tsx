"use client";

import { api } from "@/lib/api";
import { LANGS, type Lang, useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/** Sélecteur de langue : mémorisé dans le navigateur, et dans le profil si connecté. */
export default function LangSwitch() {
  const { lang, setLang, m } = useI18n();
  const { me } = useSession();

  function change(l: Lang) {
    setLang(l);
    if (me) api("/auth/me/lang", { method: "PUT", body: { lang: l } }).catch(() => {});
  }

  return (
    <div className="lang-switch" role="group" aria-label={m.nav.language}>
      {LANGS.map((l) => (
        <button key={l.code} type="button" className={lang === l.code ? "on" : ""} title={l.name} onClick={() => change(l.code)}>
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
