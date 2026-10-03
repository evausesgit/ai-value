// Libellés d'affichage des listes fermées définies dans app/catalog.py
// (modifier les deux en même temps).

export const ROLES: Record<string, string> = {
  member: "Membre",
  lead: "Team lead",
  manager: "Management",
  admin: "Admin",
};

export const FREQUENCIES: Record<string, string> = {
  daily: "Tous les jours",
  weekly: "Chaque semaine",
  monthly: "De temps en temps",
  tried: "Juste essayé",
};

export const USAGE_LEVELS = ["Jamais", "Rarement", "Chaque semaine", "Tous les jours", "Plusieurs fois par jour"];

export const CAMPAIGN_ITEMS: Record<string, { label: string; hint: string }> = {
  tools: { label: "Mes outils IA", hint: "Quels outils, à quelle fréquence" },
  skills: { label: "Mon auto-évaluation", hint: "Mon niveau sur les 6 domaines" },
  usecases: { label: "Mes use cases", hint: "Ce que je fais avec l'IA et le temps gagné" },
  checkin: { label: "Mon ressenti", hint: "Satisfaction, freins, un mot (anonymisé)" },
};

export const BLOCKERS: Record<string, string> = {
  acces: "Pas d'accès / de licence",
  formation: "Je ne sais pas bien m'en servir",
  securite: "Doute sur la confidentialité",
  qualite: "Résultats pas assez fiables",
  temps: "Pas le temps d'explorer",
  pertinence: "Pas adapté à mon métier",
  regles: "Règles internes floues",
};

export const DOMAINS: Record<string, { label: string; hint: string }> = {
  prompting: { label: "Prompting", hint: "Formuler, itérer, donner du contexte" },
  outils: { label: "Outils", hint: "Connaître les outils et quand utiliser lequel" },
  limites: { label: "Limites & vérification", hint: "Hallucinations, biais, sources" },
  donnees: { label: "Données & confidentialité", hint: "RGPD, données sensibles, règles internes" },
  automatisation: { label: "Automatisation", hint: "Workflows, agents, intégrations" },
  metier: { label: "IA dans mon métier", hint: "Appliquer l'IA à mes propres tâches" },
};
export const DOMAIN_KEYS = Object.keys(DOMAINS);

export const SKILL_LEVELS = ["Découverte", "Usage", "Maîtrise", "Référent"];
export const SKILL_HINTS = [
  "J'ai entendu parler, j'ai peu essayé",
  "Je m'en sers pour des tâches simples",
  "Je m'en sers efficacement et je sais vérifier",
  "Je forme les autres et je crée des usages",
];

export const CATEGORIES: Record<string, string> = {
  redaction: "Rédaction",
  code: "Code",
  analyse: "Analyse de données",
  recherche: "Recherche & veille",
  synthese: "Synthèse & réunions",
  support: "Support client",
  automatisation: "Automatisation",
  creatif: "Créatif & visuels",
  autre: "Autre",
};

export const RISKS: Record<string, string> = {
  low: "Risque faible",
  medium: "Risque moyen",
  high: "Risque élevé",
};

export const FEEDBACK_KINDS: Record<string, string> = {
  frein: "Un frein",
  idee: "Une idée",
  formation: "Un besoin de formation",
  outil: "Un outil à demander",
  autre: "Autre",
};

export const FEEDBACK_STATUSES: Record<string, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  done: "Traité",
};

export function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtNum(v: number | null | undefined, digits = 0, suffix = ""): string {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits })}${suffix}`;
}

export function fmtDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return `${h.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}
