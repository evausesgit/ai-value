"use client";

// Graphiques maison en SVG/HTML, selon la méthode dataviz :
// une teinte (series-1) pour les grandeurs, rampe séquentielle bleue pour les
// valeurs ordonnées (fréquences, heatmap), libellés en encre de texte, survol
// avec infobulle, jamais de double axe.

import { useEffect, useRef, useState } from "react";
import { fmtNum } from "@/lib/catalog";

export function Kpi({
  label,
  value,
  unit,
  foot,
  digits = 0,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  foot?: React.ReactNode;
  digits?: number;
}) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">
        {fmtNum(value, digits)}
        {value !== null && value !== undefined && unit ? <span className="unit">{unit}</span> : null}
      </div>
      {foot ? <div className="foot">{foot}</div> : null}
    </div>
  );
}

export function Delta({ now, before, unit = "", digits = 0 }: { now: number | null; before: number | null; unit?: string; digits?: number }) {
  if (now === null || before === null) return null;
  const d = now - before;
  if (Math.abs(d) < 10 ** -digits / 2) return <span className="muted">stable</span>;
  return (
    <span className={d > 0 ? "delta-up" : "delta-down"}>
      {d > 0 ? "▲ +" : "▼ "}
      {fmtNum(d, digits)}
      {unit}
    </span>
  );
}

/** Barres horizontales, une seule série. */
export function BarList({
  rows,
  max,
  format = (v) => fmtNum(v),
}: {
  rows: { label: string; value: number; title?: string }[];
  max?: number;
  format?: (v: number) => string;
}) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <div className="empty small">Pas encore de données.</div>;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label} title={r.title ?? `${r.label} : ${format(r.value)}`}>
          <span className="name">{r.label}</span>
          <span className="bar-track">
            <span className="bar-seg" style={{ width: `${(100 * r.value) / m}%`, background: "var(--series-1)" }} />
          </span>
          <span className="val">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

const FREQ_SERIES = [
  { key: "daily", label: "Tous les jours", color: "var(--seq-600)" },
  { key: "weekly", label: "Chaque semaine", color: "var(--seq-400)" },
  { key: "monthly", label: "De temps en temps", color: "var(--seq-200)" },
] as const;

/** Outils : barres empilées par fréquence (rampe ordinale bleue, foncé = fréquent). */
export function ToolBars({
  rows,
  members,
}: {
  rows: { tool: string; daily: number; weekly: number; monthly: number }[];
  members: number;
}) {
  if (!rows.length) return <div className="empty small">Aucun outil déclaré pour l'instant.</div>;
  const max = Math.max(1, ...rows.map((r) => r.daily + r.weekly + r.monthly));
  return (
    <>
      <div className="bars">
        {rows.map((r) => {
          const total = r.daily + r.weekly + r.monthly;
          const title = `${r.tool} — ${r.daily} tous les jours, ${r.weekly} chaque semaine, ${r.monthly} de temps en temps (${fmtNum((100 * total) / Math.max(1, members))} % des membres)`;
          return (
            <div className="bar-row" key={r.tool} title={title}>
              <span className="name">{r.tool}</span>
              <span className="bar-track">
                {FREQ_SERIES.map((s) =>
                  r[s.key] > 0 ? (
                    <span
                      key={s.key}
                      className="bar-seg"
                      style={{ width: `${(100 * r[s.key]) / max}%`, background: s.color }}
                    />
                  ) : null,
                )}
              </span>
              <span className="val">{total}</span>
            </div>
          );
        })}
      </div>
      <div className="legend">
        {FREQ_SERIES.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </>
  );
}

/** Courbe (une série, un point par campagne) avec réticule et infobulle au survol. */
export function TrendChart({
  points,
  label,
  max,
  unit = "",
  digits = 0,
  height = 180,
}: {
  // label : texte court sous l'axe ; title : en-tête de l'infobulle.
  points: { key: string; label: string; title: string; value: number | null; note?: string }[];
  label: string;
  max?: number;
  unit?: string;
  digits?: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Largeur réelle du conteneur : le texte des axes garde sa taille (pas de mise à l'échelle).
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const pad = { l: 36, r: 12, t: 12, b: 26 };
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  const top = max ?? Math.max(1, ...vals) * 1.1;
  const x = (i: number) =>
    points.length === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const ticks = [0, top / 2, top];

  // Segments continus (une semaine sans données coupe la ligne).
  const paths: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur) paths.push(cur);
      cur = "";
    } else cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (cur) paths.push(cur);
  const area =
    vals.length === points.length && points.length > 1
      ? `${paths[0]}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
      : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  const h = hover !== null ? points[hover] : null;
  return (
    <div className="chart" aria-label={label} role="img" ref={box}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width={W} height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <g className="axis">
          {ticks.map((t) => (
            <g key={t}>
              <line className="gridline" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">
                {fmtNum(t, top < 10 ? 1 : 0)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            points.length <= (W < 520 ? 4 : 8) || (points.length - 1 - i) % (W < 520 ? 3 : 2) === 0 ? (
              <text key={p.key} x={x(i)} y={H - 6} textAnchor={points.length === 1 ? "middle" : i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
                {p.label}
              </text>
            ) : null,
          )}
        </g>
        {area ? <path d={area} fill="var(--series-1)" opacity={0.08} /> : null}
        {paths.map((d) => (
          <path key={d} d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        ))}
        {/* dernier point libellé directement */}
        {vals.length && points[points.length - 1].value !== null ? (
          <circle
            cx={x(points.length - 1)}
            cy={y(points[points.length - 1].value as number)}
            r={4}
            fill="var(--series-1)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ) : null}
        {h && hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeDasharray="3 3" />
            {h.value !== null ? (
              <circle cx={x(hover)} cy={y(h.value)} r={5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
            ) : null}
          </g>
        ) : null}
      </svg>
      {h && hover !== null ? (
        <div
          className="tooltip"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: `${((h.value !== null ? y(h.value) : pad.t) / H) * 100}%`,
          }}
        >
          <strong>{h.title}</strong>
          {label} : {h.value === null ? "masqué (moins de 3 réponses)" : `${fmtNum(h.value, digits)}${unit}`}
          {h.note ? <div className="muted">{h.note}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Mini-courbe sans axes pour les tableaux. */
export function Sparkline({ values, max = 100 }: { values: (number | null)[]; max?: number }) {
  const W = 90;
  const H = 24;
  const x = (i: number) => (i * W) / Math.max(1, values.length - 1);
  const y = (v: number) => 2 + (1 - v / max) * (H - 4);
  let d = "";
  values.forEach((v, i) => {
    if (v === null) return;
    d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  const last = [...values].reverse().find((v) => v !== null);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-label={`Tendance, dernière valeur ${fmtNum(last ?? null)} %`}>
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

const HEAT_STEPS = ["var(--seq-100)", "var(--seq-200)", "var(--seq-300)", "var(--seq-400)", "var(--seq-500)", "var(--seq-600)"];

/** Heatmap équipes × domaines (niveau moyen 0..3), valeurs écrites dans chaque case. */
export function Heatmap({
  columns,
  rows,
  max = 3,
}: {
  columns: { key: string; label: string }[];
  rows: { label: string; values: { avg: number | null; n: number }[] }[];
  max?: number;
}) {
  return (
    <div className="table-wrap">
      <table className="heat">
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th className="row-h">{r.label}</th>
              {r.values.map((v, i) => {
                if (v.avg === null)
                  return (
                    <td key={columns[i].key} style={{ background: "var(--seq-empty)", color: "var(--muted)" }} title="Aucune auto-évaluation">
                      —
                    </td>
                  );
                const step = Math.min(HEAT_STEPS.length - 1, Math.floor((v.avg / max) * HEAT_STEPS.length));
                return (
                  <td
                    key={columns[i].key}
                    style={{ background: HEAT_STEPS[step], color: `var(--heat-ink-${step})` }}
                    title={`${r.label} · ${columns[i].label} : ${fmtNum(v.avg, 1)} / ${max} (${v.n} réponses)`}
                  >
                    {fmtNum(v.avg, 1)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="legend">
        <span>Niveau moyen :</span>
        {["0", "1", "2", "3"].map((l, i) => (
          <span key={l}>
            <i style={{ background: HEAT_STEPS[Math.min(5, i * 2)] }} />
            {["Découverte", "Usage", "Maîtrise", "Référent"][i]}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Meter({ value, max = 100 }: { value: number | null; max?: number }) {
  return (
    <div className="meter" role="meter" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${value === null ? 0 : Math.min(100, (100 * value) / max)}%` }} />
    </div>
  );
}
