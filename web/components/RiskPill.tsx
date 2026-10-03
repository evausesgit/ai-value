"use client";

import { useI18n } from "@/lib/i18n";

const CLS: Record<string, string> = { low: "good", medium: "warn", high: "crit" };
const ICON: Record<string, string> = { low: "●", medium: "▲", high: "■" };

export default function RiskPill({ risk }: { risk: string }) {
  const { m } = useI18n();
  return (
    <span className={`pill ${CLS[risk] ?? ""}`}>
      {ICON[risk]} {m.catalog.risks[risk] ?? risk}
    </span>
  );
}
