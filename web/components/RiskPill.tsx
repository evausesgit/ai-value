import { RISKS } from "@/lib/catalog";

const CLS: Record<string, string> = { low: "good", medium: "warn", high: "crit" };
const ICON: Record<string, string> = { low: "●", medium: "▲", high: "■" };

export default function RiskPill({ risk }: { risk: string }) {
  return (
    <span className={`pill ${CLS[risk] ?? ""}`}>
      {ICON[risk]} {RISKS[risk] ?? risk}
    </span>
  );
}
