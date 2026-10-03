"use client";

// Internationalisation sans dépendance : dictionnaires typés (messages/*.ts),
// langue = profil de l'utilisateur, sinon choix mémorisé, sinon navigateur.
// Ajouter une langue : créer messages/xx.ts (type Messages) et l'ajouter à DICTS
// (et côté API : app/i18n.py, app/quiz_i18n.py).

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import en from "@/messages/en";
import fr, { type Messages } from "@/messages/fr";

export type Lang = "fr" | "en";
const DICTS: Record<Lang, Messages> = { fr, en };
export const LANGS = (Object.keys(DICTS) as Lang[]).map((code) => ({ code, name: DICTS[code].meta.name }));
const STORAGE_KEY = "aivalue_lang";

// Valeurs courantes lisibles hors React (formateurs de dates, client API).
let current: Lang = "fr";
export function currentLang(): Lang {
  return current;
}
export function currentLocale(): string {
  return DICTS[current].meta.locale;
}

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in DICTS) return saved as Lang;
  } catch {}
  const nav = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "fr";
  return nav in DICTS ? (nav as Lang) : "fr";
}

interface I18nValue {
  lang: Lang;
  m: Messages;
  setLang: (lang: Lang) => void;
}

const Ctx = createContext<I18nValue>({ lang: "fr", m: fr, setLang: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  const setLang = useCallback((l: Lang) => {
    if (!(l in DICTS)) return;
    current = l;
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  useEffect(() => {
    setLang(detect());
  }, [setLang]);

  return <Ctx.Provider value={{ lang, m: DICTS[lang], setLang }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
