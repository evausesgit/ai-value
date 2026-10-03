// Clés des listes fermées (cf. app/catalog.py) et formateurs selon la langue courante.
// Les libellés sont dans messages/*.ts.

import { currentLocale } from "./i18n";

export const DOMAIN_KEYS = ["prompting", "outils", "limites", "donnees", "automatisation", "metier"];

export function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(currentLocale(), { day: "numeric", month: "short", year: "numeric" });
}

export function fmtNum(v: number | null | undefined, digits = 0, suffix = ""): string {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString(currentLocale(), { maximumFractionDigits: digits, minimumFractionDigits: digits })}${suffix}`;
}

export function fmtDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(currentLocale(), { day: "numeric", month: "long" });
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return `${h.toLocaleString(currentLocale(), { maximumFractionDigits: 1 })} h`;
}
