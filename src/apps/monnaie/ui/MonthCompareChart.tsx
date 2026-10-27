"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatSigned, monthShortName, type Cents, type MonthDaily } from "../money";

const METRICS = [
  { key: "plaisir", label: "Plaisir", verb: "cramés" },
  { key: "charges", label: "Charges", verb: "de charges" },
  { key: "depenses", label: "Tout dépensé", verb: "dépensés" },
  { key: "garde", label: "Gardé", verb: "gardés" },
] as const;
type Metric = (typeof METRICS)[number]["key"];

const W = 900;
const H = 340;
const PAD = 78;
const RIGHT = 48;
const DAYS = 31;

const short = (month: string) => monthShortName(month).replace(".", "");

/**
 * The month day by day against the previous ones: pick what to compare, hover a day to read every month,
 * click a month in the legend to hide or show it. `today` stops the current month's line.
 */
export function MonthCompareChart({ current, others, today }: { current: MonthDaily; others: MonthDaily[]; today?: number }) {
  const [metric, setMetric] = useState<Metric>("plaisir");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const visible = others.filter((m) => !hidden.has(m.month));
  const at = (values: Cents[], i: number) => values[Math.min(i, values.length - 1)] ?? 0;
  const currentValues = today ? current[metric].slice(0, today) : current[metric];
  const average = useMemo(
    () => (visible.length ? Array.from({ length: DAYS }, (_, i) => Math.round(visible.reduce((n, m) => n + at(m[metric], i), 0) / visible.length)) : []),
    [visible, metric],
  );

  const all = [...currentValues, ...visible.flatMap((m) => m[metric]), ...average];
  const top = Math.max(1, ...all);
  const bottom = Math.min(0, ...all);
  const x = (i: number) => PAD + (i / (DAYS - 1)) * (W - PAD - RIGHT);
  const y = (cents: number) => 8 + (1 - (cents - bottom) / (top - bottom)) * (H - 16);
  const path = (values: Cents[]) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  const lastDay = currentValues.length - 1;
  const day = hover ?? lastDay;
  const verb = METRICS.find((m) => m.key === metric)!.verb;
  const now = currentValues[Math.min(day, lastDay)];
  const usual = average[day];
  // For spending, more is worse; for "gardé", more is better.
  const better = (a: number, b: number) => (metric === "garde" ? a >= b : a <= b);

  const labels = visible.map((m) => ({ month: m.month, y: y(at(m[metric], DAYS)) + 4 })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 13);

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    setHover(Math.max(0, Math.min(DAYS - 1, Math.round(((px - PAD) / (W - PAD - RIGHT)) * (DAYS - 1)))));
  };

  // Values of the hovered day, highest first.
  const tooltip = [
    ...(day <= lastDay ? [{ key: current.month, label: `${short(current.month)} (ce mois)`, value: now, color: "var(--mn-accent)" }] : []),
    ...(average.length ? [{ key: "avg", label: "Moyenne", value: usual, color: "#fff" }] : []),
    ...visible.map((m) => ({ key: m.month, label: short(m.month), value: at(m[metric], day), color: "#8f93a5" })),
  ].sort((a, b) => b.value - a.value);
  const tipLeft = x(day) / W > 0.62;

  return (
    <figure>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ce qu'on compare">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              className={`mn-punch px-3 pb-1 pt-2 text-base transition ${metric === m.key ? "-rotate-2 bg-[var(--mn-accent)] text-[var(--mn-ink)] shadow-[3px_3px_0_var(--mn-ink)]" : "mn-ghost"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {now !== undefined && usual !== undefined && (
          <p className="text-[var(--mn-muted)]">
            Jour {Math.min(day, lastDay) + 1} : <b className="text-white">{formatMoney(now)}</b> {verb} · moy. <b className="text-white">{formatMoney(average[Math.min(day, lastDay)])}</b>
            {average[Math.min(day, lastDay)] !== 0 && (
              <b className={better(now, average[Math.min(day, lastDay)]) ? "text-emerald-400" : "text-[var(--mn-red)]"}>
                {" "}
                ({formatSigned(now - average[Math.min(day, lastDay)])})
              </b>
            )}
          </p>
        )}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H + 26}`}
          className="w-full touch-none overflow-visible"
          role="img"
          aria-label={`${METRICS.find((m) => m.key === metric)!.label} cumulé jour par jour, comparé aux mois précédents`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 0.5, 1].map((f) => {
            const v = Math.round(bottom + (top - bottom) * f);
            return (
              <g key={f}>
                <line x1={PAD} x2={W - RIGHT} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.07)" />
                <text x={PAD - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#7b7c86">
                  {formatMoney(v)}
                </text>
              </g>
            );
          })}
          {bottom < 0 && <line x1={PAD} x2={W - RIGHT} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 5" />}
          {[1, 10, 20, 31].map((d) => (
            <text key={d} x={x(d - 1)} y={H + 20} textAnchor="middle" fontSize="12" fill="#7b7c86">
              {d}
            </text>
          ))}

          {visible.map((m) => (
            <path
              key={`${m.month}-${metric}`}
              d={path(m[metric])}
              pathLength={1}
              fill="none"
              stroke={focus === m.month ? "#fff" : "#5b5e75"}
              strokeWidth={focus === m.month ? 3 : 2}
              className="mn-draw"
              onPointerEnter={() => setFocus(m.month)}
              onPointerLeave={() => setFocus(null)}
            />
          ))}
          {labels.map((l) => (
            <text key={l.month} x={x(DAYS - 1) + 8} y={l.y} fontSize="12" fill={focus === l.month ? "#fff" : "#7b7c86"}>
              {short(l.month)}
            </text>
          ))}
          {average.length > 0 && <path d={path(average)} fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="7 7" opacity={0.85} />}
          {currentValues.length > 0 && (
            <>
              <path d={`${path(currentValues)}L${x(lastDay).toFixed(1)},${y(Math.max(bottom, 0))}L${x(0)},${y(Math.max(bottom, 0))}Z`} fill="rgba(255,122,47,0.14)" />
              <path key={`current-${metric}`} d={path(currentValues)} pathLength={1} fill="none" stroke="var(--mn-accent)" strokeWidth="4" strokeLinejoin="round" className="mn-draw" />
              <circle cx={x(lastDay)} cy={y(currentValues[lastDay])} r="6" fill="var(--mn-accent)" stroke="var(--mn-ink)" strokeWidth="3" />
            </>
          )}

          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="#fff" strokeWidth="1.5" strokeDasharray="2 4" />
              {hover <= lastDay && <circle cx={x(hover)} cy={y(currentValues[hover])} r="5" fill="#fff" stroke="var(--mn-ink)" strokeWidth="2" />}
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-48 border-[3px] border-[var(--mn-ink)] bg-white px-3 py-2 text-sm text-[var(--mn-ink)] shadow-[4px_4px_0_var(--mn-ink)]"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: tipLeft ? "translateX(calc(-100% - 14px)) rotate(-1deg)" : "translateX(14px) rotate(1deg)" }}
          >
            <p className="mn-punch mb-1 text-base">Jour {hover + 1}</p>
            {tooltip.map((t) => (
              <p key={t.key} className="flex items-center justify-between gap-4 font-semibold">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5" style={{ background: t.color === "#fff" ? "var(--mn-ink)" : t.color }} />
                  {t.label}
                </span>
                <span>{formatMoney(t.value)}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--mn-muted)]">
        <span className="flex items-center gap-2">
          <span className="h-1 w-6 bg-[var(--mn-accent)]" /> {short(current.month)} (ce mois)
        </span>
        {average.length > 0 && (
          <span className="flex items-center gap-2">
            <span className="h-0 w-6 border-t-[3px] border-dashed border-white" /> Moyenne
          </span>
        )}
        {others.map((m) => (
          <button
            key={m.month}
            type="button"
            onClick={() => setHidden((set) => (set.has(m.month) ? new Set([...set].filter((v) => v !== m.month)) : new Set(set).add(m.month)))}
            onPointerEnter={() => setFocus(m.month)}
            onPointerLeave={() => setFocus(null)}
            aria-pressed={!hidden.has(m.month)}
            title={hidden.has(m.month) ? "Afficher" : "Masquer"}
            className={`flex items-center gap-2 font-semibold transition ${hidden.has(m.month) ? "opacity-40 line-through" : "hover:text-white"}`}
          >
            <span className="h-0.5 w-5 bg-[#8f93a5]" /> {short(m.month)}
          </button>
        ))}
      </figcaption>
    </figure>
  );
}
