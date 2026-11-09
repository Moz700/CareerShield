import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear, scaleLog } from 'd3-scale';
import { line, curveStepAfter, curveMonotoneX } from 'd3-shape';
import { m as motion } from 'framer-motion';

export function useWidth<T extends HTMLElement>(initial = 320): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  // measured before the first paint, so a chart never renders at a placeholder size and then jumps
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(el);
    setW(Math.max(260, el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function AxisX({ scale, y, ticks, label, fmt = String, width }: { scale: (v: number) => number; y: number; ticks: number[]; label?: string; fmt?: (v: number) => string; width: number }) {
  return (
    <g>
      {ticks.map((v) => (
        <g key={v} transform={`translate(${scale(v)},${y})`}>
          <line y2="5" stroke="rgb(var(--muted))" strokeOpacity={0.6} />
          <text y="18" textAnchor="middle" className="fill-muted text-[11px] num">
            {fmt(v)}
          </text>
        </g>
      ))}
      {label && (
        <text x={width / 2} y={y + 36} textAnchor="middle" className="fill-muted text-[11.5px]">
          {label}
        </text>
      )}
    </g>
  );
}

function AxisY({ scale, x, ticks, label, fmt = String, height, top, gridTo }: { scale: (v: number) => number; x: number; ticks: number[]; label?: string; fmt?: (v: number) => string; height: number; top: number; gridTo?: number }) {
  return (
    <g>
      {ticks.map((v) => (
        <g key={v} transform={`translate(${x},${scale(v)})`}>
          {gridTo != null && <line x2={gridTo - x} stroke="rgb(var(--line))" strokeDasharray="2 4" />}
          <text x="-8" dy="0.32em" textAnchor="end" className="fill-muted text-[11px] num">
            {fmt(v)}
          </text>
        </g>
      ))}
      {label && (
        <text transform={`translate(${x - 44},${top + height / 2}) rotate(-90)`} textAnchor="middle" className="fill-muted text-[11.5px]">
          {label}
        </text>
      )}
    </g>
  );
}

export const POLICY_COLORS: Record<string, string> = {
  CONV: 'rgb(var(--pol-conv))',
  SIM: '#8b7fd1',
  'v1-BLIND': 'rgb(var(--pol-v1))',
  v1: 'rgb(var(--pol-v1))',
  'v1+guards': '#4aa3b8',
  'v2-BLIND': 'rgb(var(--pol-v2))',
  v2: 'rgb(var(--pol-v2))',
};

// ---------------------------------------------------------------- concentration curves
export function ConcentrationChart({ curves, labels, xLabel, yLabel, tenLabel, topLabel }: { curves: Record<string, number[]>; labels: Record<string, string>; xLabel: string; yLabel: string; tenLabel: string; topLabel: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hx, setHx] = useState<number | null>(null);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const h = Math.min(380, Math.max(260, w * 0.55));
  const m = { l: 56, r: 16, t: 14, b: 50 };
  const x = scaleLinear().domain([1, 40]).range([m.l, w - m.r]);
  const y = scaleLinear().domain([0, 60]).range([h - m.b, m.t]);
  const order = ['v1', 'v1-BLIND', 'v2', 'CONV'];
  const path = (vals: number[]) => line<number>().x((_, k) => x(k + 1)).y((v) => y(v)).curve(curveStepAfter)(vals) ?? '';
  return (
    <div ref={ref} className="w-full">
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Series">
        {order.map((k) => (
          <button
            key={k}
            aria-pressed={!off[k]}
            onClick={() => setOff((o) => ({ ...o, [k]: !o[k] }))}
            className={`chip transition-opacity ${off[k] ? 'opacity-40' : ''}`}
          >
            <svg width="22" height="6" aria-hidden="true">
              <line x1="1" x2="21" y1="3" y2="3" stroke={POLICY_COLORS[k]} strokeWidth="3" strokeDasharray={k === 'v1-BLIND' ? '5 3' : undefined} />
            </svg>
            {labels[k]}
          </button>
        ))}
      </div>
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={yLabel}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const v = Math.round(x.invert(e.clientX - r.left));
          setHx(v >= 1 && v <= 40 ? v : null);
        }}
        onPointerLeave={() => setHx(null)}
      >
        <AxisY scale={y} x={m.l} ticks={[0, 10, 20, 30, 40, 50, 60]} height={h - m.t - m.b} top={m.t} label={yLabel} gridTo={w - m.r} />
        <AxisX scale={x} y={h - m.b} ticks={[1, 5, 10, 15, 20, 25, 30, 35, 40]} label={xLabel} width={w} />
        <line x1={x(10)} x2={x(10)} y1={m.t} y2={h - m.b} stroke="rgb(var(--muted))" strokeDasharray="3 3" strokeOpacity={0.6} />
        <text x={x(10) + 6} y={h - m.b - 8} className="fill-muted text-[11px]">
          {tenLabel}
        </text>
        {order.map((k) =>
          off[k] ? null : (
            <motion.path
              key={k}
              d={path(curves[k])}
              fill="none"
              stroke={POLICY_COLORS[k]}
              strokeWidth={k === 'CONV' ? 2.5 : 3}
              strokeDasharray={k === 'v1-BLIND' ? '7 5' : undefined}
              initial={k === 'v1-BLIND' ? { opacity: 0 } : { pathLength: 0 }}
              whileInView={k === 'v1-BLIND' ? { opacity: 1 } : { pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
            />
          ),
        )}
        {hx != null && (
          <g>
            <line x1={x(hx)} x2={x(hx)} y1={m.t} y2={h - m.b} stroke="rgb(var(--ink))" strokeOpacity={0.35} />
            {order
              .filter((k) => !off[k])
              .map((k) => (
                <circle key={k} cx={x(hx)} cy={y(curves[k][hx - 1])} r={4} fill={POLICY_COLORS[k]} stroke="rgb(var(--surface))" strokeWidth={1.5} />
              ))}
          </g>
        )}
      </svg>
      <div className="min-h-[2.5rem] text-sm text-muted num" aria-live="polite">
        {hx != null && (
          <span>
            <b className="text-ink">{topLabel.replace('{n}', String(hx))}</b>{' '}
            {order
              .filter((k) => !off[k])
              .map((k) => `${labels[k]} ${curves[k][hx - 1].toFixed(1)}%`)
              .join(' · ')}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- forest plot
export function ForestPlot({ rows, labels, unit }: { rows: { policy: string; diff: number; lo: number; hi: number }[]; labels: Record<string, string>; unit: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const rowH = 38;
  // on a phone the labels get a smaller font and a little more room, so none is cut off
  const narrow = w < 420;
  const m = { l: Math.min(170, w * (narrow ? 0.43 : 0.38)), r: narrow ? 12 : 20, t: 10, b: 40 };
  const h = m.t + m.b + rows.length * rowH;
  const lo = Math.min(0, ...rows.map((r) => r.lo));
  const hi = Math.max(0, ...rows.map((r) => r.hi));
  const padv = (hi - lo) * 0.08 || 1;
  const x = scaleLinear().domain([lo - padv, hi + padv]).nice().range([m.l, w - m.r]);
  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={h} role="img" aria-label={unit}>
        {x.ticks(6).map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={m.t} y2={h - m.b} stroke="rgb(var(--line))" strokeDasharray={v === 0 ? undefined : '2 4'} strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={x(v)} y={h - m.b + 18} textAnchor="middle" className="fill-muted text-[11px] num">
              {v}
            </text>
          </g>
        ))}
        <text x={(m.l + w - m.r) / 2} y={h - 6} textAnchor="middle" className="fill-muted text-[11.5px]">
          {unit}
        </text>
        {rows.map((r, k) => {
          const cy = m.t + rowH * k + rowH / 2;
          const blind = r.policy.includes('BLIND');
          const c = POLICY_COLORS[r.policy];
          return (
            <g key={r.policy}>
              <text x={m.l - 8} y={cy} dy="0.32em" textAnchor="end" className={`fill-ink ${narrow ? 'text-[10.5px]' : 'text-[12px]'}`}>
                {labels[r.policy]}
              </text>
              <motion.line
                x1={x(r.lo)}
                x2={x(r.hi)}
                y1={cy}
                y2={cy}
                stroke={c}
                strokeWidth={2.5}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 * k }}
              />
              <motion.circle
                cx={x(r.diff)}
                cy={cy}
                r={6}
                fill={blind ? 'rgb(var(--surface))' : c}
                stroke={c}
                strokeWidth={2.5}
                initial={{ cx: x(0) }}
                animate={{ cx: x(r.diff) }}
                transition={{ duration: 0.6, delay: 0.05 * k }}
              >
                <title>{`${labels[r.policy]}: ${r.diff.toFixed(2)} (${r.lo.toFixed(2)} to ${r.hi.toFixed(2)})`}</title>
              </motion.circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- capacity curve
export function CapacityChart({ pts, v1, xLabel, yLabel, hover }: { pts: { k: number; top10: number; msReduction: number }[]; v1: { top10: number; red: number }; xLabel: string; yLabel: string; hover: (k: number, share: number, red: number) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hk, setHk] = useState<number | null>(8);
  const h = Math.min(340, Math.max(240, w * 0.5));
  const m = { l: 56, r: 20, t: 16, b: 50 };
  const x = scaleLinear().domain([0, 30]).range([m.l, w - m.r]);
  const y = scaleLinear().domain([0, 3.6]).range([h - m.b, m.t]);
  const d = line<{ top10: number; msReduction: number }>().x((p) => x(p.top10)).y((p) => y(p.msReduction)).curve(curveMonotoneX)(pts) ?? '';
  const sel = pts.find((p) => p.k === hk);
  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={h} role="img" aria-label={yLabel}>
        <AxisY scale={y} x={m.l} ticks={[0, 1, 2, 3]} height={h - m.t - m.b} top={m.t} label={yLabel} gridTo={w - m.r} />
        <AxisX scale={x} y={h - m.b} ticks={[0, 5, 10, 15, 20, 25, 30]} label={xLabel} width={w} />
         <motion.path d={d} fill="none" stroke="rgb(var(--pol-v2))" strokeWidth={2.5} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.2 }} />
        {pts.map((p) => (
          <g key={p.k} onPointerEnter={() => setHk(p.k)} onFocus={() => setHk(p.k)} tabIndex={0} role="button" aria-label={`k = ${p.k}`} className="cursor-pointer outline-none">
            <circle cx={x(p.top10)} cy={y(p.msReduction)} r={p.k === 8 ? 7 : 4.5} fill={p.k === 8 ? 'rgb(var(--pol-v2))' : 'rgb(var(--surface))'} stroke="rgb(var(--pol-v2))" strokeWidth={2} />
            <circle cx={x(p.top10)} cy={y(p.msReduction)} r={12} fill="transparent" />
          </g>
        ))}
        <circle cx={x(v1.top10)} cy={y(v1.red)} r={7} fill="rgb(var(--pol-v1))" />
        <text x={x(v1.top10) - 10} y={y(v1.red) - 12} textAnchor="end" className="fill-brand text-[11.5px] font-semibold">
          v1
        </text>
        <text x={x(pts.find((p) => p.k === 8)!.top10) + 10} y={y(pts.find((p) => p.k === 8)!.msReduction) + 18} className="fill-risk text-[11.5px] font-semibold">
          v2 (k = 8)
        </text>
      </svg>
      <div className="min-h-[1.5rem] text-sm text-muted num" aria-live="polite">
        {sel && (
          <span>{hover(sel.k, sel.top10, sel.msReduction)}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- generic scatter
export interface ScatterPoint {
  i: number;
  x: number;
  y: number;
  color: string;
  dim?: boolean;
  r?: number;
  ring?: boolean;
  label?: string;
}

export function Scatter({
  points,
  xDomain,
  yDomain,
  yLog = false,
  xLabel,
  yLabel,
  xFmt,
  yFmt,
  xTicks,
  yTicks,
  height,
  onHover,
  onPick,
  selected,
  hline,
  tooltip,
  ariaLabel,
}: {
  points: ScatterPoint[];
  xDomain: [number, number];
  yDomain: [number, number];
  yLog?: boolean;
  xLabel: string;
  yLabel: string;
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
  xTicks: number[];
  yTicks: number[];
  height?: number;
  onHover?: (i: number | null) => void;
  onPick?: (i: number) => void;
  selected?: number | null;
  hline?: { y: number; label: string };
  tooltip?: (i: number) => ReactNode;
  ariaLabel: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hov, setHov] = useState<number | null>(null);
  const h = height ?? Math.min(460, Math.max(300, w * 0.6));
  const m = { l: 64, r: 16, t: 14, b: 50 };
  // keyed on the domain values, since callers pass new arrays on every render
  const x = useMemo(() => scaleLinear().domain(xDomain).range([m.l, w - m.r]), [xDomain[0], xDomain[1], w]); // eslint-disable-line react-hooks/exhaustive-deps
  const y = useMemo(() => (yLog ? scaleLog().domain(yDomain) : scaleLinear().domain(yDomain)).range([h - m.b, m.t]), [yDomain[0], yDomain[1], yLog, h]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useMemo(() => points.filter((p) => !p.dim), [points]);
  const find = (px: number, py: number) => {
    let best: ScatterPoint | null = null;
    let bd = 196;
    for (const p of live) {
      const d = (x(p.x) - px) ** 2 + (y(p.y) - py) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };
  // the points only re-render when the data or the size changes, not on every hover
  const dots = useMemo(
    () => (
      <>
        {points
          .filter((p) => p.dim)
          .map((p) => (
            <circle key={p.i} cx={x(p.x)} cy={y(p.y)} r={2.2} fill="rgb(var(--muted))" fillOpacity={0.18} />
          ))}
        {live.map((p) => (
          <circle
            key={p.i}
            cx={x(p.x)}
            cy={y(p.y)}
            r={p.r ?? 3.4}
            fill={p.color}
            fillOpacity={p.ring ? 1 : 0.75}
            stroke={p.ring ? 'rgb(var(--ink))' : 'none'}
            strokeWidth={p.ring ? 1.5 : 0}
          />
        ))}
        {live
          .filter((p) => p.label)
          .map((p) => (
            <text key={'l' + p.i} x={x(p.x)} y={y(p.y) - 10} textAnchor="middle" className="fill-ink text-[11px] font-bold num">
              {p.label}
            </text>
          ))}
      </>
    ),
    [points, live, x, y],
  );
  const hp = hov != null ? points.find((p) => p.i === hov) : null;
  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={ariaLabel}
        className="touch-pan-y"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const p = find(e.clientX - r.left, e.clientY - r.top);
          setHov(p ? p.i : null);
          onHover?.(p ? p.i : null);
        }}
        onPointerLeave={() => {
          setHov(null);
          onHover?.(null);
        }}
        onClick={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const p = find(e.clientX - r.left, e.clientY - r.top);
          if (p) onPick?.(p.i);
        }}
      >
        <AxisY scale={y} x={m.l} ticks={yTicks.filter((v) => v >= Math.min(...yDomain) && v <= Math.max(...yDomain))} height={h - m.t - m.b} top={m.t} label={yLabel} fmt={yFmt} gridTo={w - m.r} />
        <AxisX scale={x} y={h - m.b} ticks={xTicks.filter((v) => v >= Math.min(...xDomain) && v <= Math.max(...xDomain))} label={xLabel} fmt={xFmt} width={w} />
        {hline && (
          <g>
            <line x1={m.l} x2={w - m.r} y1={y(hline.y)} y2={y(hline.y)} stroke="rgb(var(--ink))" strokeDasharray="5 4" strokeOpacity={0.55} />
            <text x={w - m.r - 4} y={y(hline.y) - 6} textAnchor="end" className="fill-ink text-[11px] font-semibold">
              {hline.label}
            </text>
          </g>
        )}
        {dots}
        {selected != null && points.find((p) => p.i === selected) && (
          <circle cx={x(points.find((p) => p.i === selected)!.x)} cy={y(points.find((p) => p.i === selected)!.y)} r={9} fill="none" stroke="rgb(var(--ink))" strokeWidth={2} />
        )}
        {hp && <circle cx={x(hp.x)} cy={y(hp.y)} r={7} fill="none" stroke="rgb(var(--ink))" strokeWidth={1.5} />}
      </svg>
      {hp && tooltip && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[240px] -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface/95 px-3 py-2 text-xs shadow-lift backdrop-blur"
          style={{ left: Math.min(Math.max(x(hp.x), 120), w - 120), top: y(hp.y) - 12 }}
        >
          {tooltip(hp.i)}
        </div>
      )}
    </div>
  );
}
