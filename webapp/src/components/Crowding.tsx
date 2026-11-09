// Unit chart of crowding: each dot is one of the 820 evaluated origin occupations. Under the chosen
// policy, origins whose first recommendation is one of the ten most recommended destinations stack
// in that destination's column; every other origin sits in the grid on the right. Switching policy
// moves each dot to where that policy sends it. First recommendations are the paper's: O*NET's
// first related occupation (CONV), the v1 ranking, and the joint v2 plan.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { useApp } from '../state/AppState';
import { Bundle, loadBundle } from '../lib/data';
import { firstRecommendationsAsync, PolicyKey } from '../lib/ranking';
import { Segmented } from './ui';

// Two geometries: side by side on wide screens, columns above the grid on phones.
interface Geo {
  W: number;
  H: number;
  colX0: number;
  colStep: number;
  stack: number;
  base: number; // baseline of the columns
  gridX0: number;
  gridBase: number; // baseline of the grid
  gridCols: number;
  gridStepX: number;
  gridStepY: number;
  othersLabel: [number, number];
}
const R = 2.5;
const WIDE: Geo = { W: 640, H: 322, colX0: 14, colStep: 24, stack: 5.9, base: 308, gridX0: 290, gridBase: 308, gridCols: 29, gridStepX: (640 - 290 - 6) / 28, gridStepY: 10.4, othersLabel: [282, 12] };
const NARROW: Geo = { W: 360, H: 612, colX0: 16, colStep: 36.5, stack: 5.6, base: 284, gridX0: 8, gridBase: 600, gridCols: 31, gridStepX: (360 - 16) / 30, gridStepY: 10.6, othersLabel: [0, 326] };

interface Layout {
  pos: [number, number][]; // per origin
  inTop: boolean[];
  cols: { soc6: string; title: string; n: number }[];
  share: number;
}

function layout(b: Bundle, dest: number[], G: Geo): Layout {
  const count = new Map<string, number>();
  dest.forEach((j) => j >= 0 && count.set(b.occ[j].soc6, (count.get(b.occ[j].soc6) ?? 0) + 1));
  const ranked = Array.from(count.entries()).sort((a, z) => z[1] - a[1] || (a[0] < z[0] ? -1 : 1));
  const top = ranked.slice(0, 10);
  const colOf = new Map(top.map(([s], k) => [s, k]));
  const stack = new Array(10).fill(0);
  let g = 0;
  const pos: [number, number][] = [];
  const inTop: boolean[] = [];
  dest.forEach((j) => {
    const c = j >= 0 ? colOf.get(b.occ[j].soc6) : undefined;
    if (c != null) {
      pos.push([G.colX0 + c * G.colStep, G.base - stack[c]++ * G.stack]);
      inTop.push(true);
    } else {
      pos.push([G.gridX0 + (g % G.gridCols) * G.gridStepX, G.gridBase - Math.floor(g / G.gridCols) * G.gridStepY]);
      inTop.push(false);
      g++;
    }
  });
  const title = (s: string) => b.occ.find((o) => o.soc6 === s)!.title;
  return { pos, inTop, cols: top.map(([s, n]) => ({ soc6: s, title: title(s), n })), share: (top.reduce((a, z) => a + z[1], 0) / dest.length) * 100 };
}

const COLOR: Record<PolicyKey, string> = { CONV: 'rgb(var(--pol-conv))', v1: 'rgb(var(--pol-v1))', v2: 'rgb(var(--pol-v2))' };

export function Crowding() {
  const { data, t, reduced } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-80px' });
  // the skill profiles load and the first recommendations are computed once, the first time the
  // chart comes near the screen
  const seen = useInView(ref, { once: true, margin: '200px' });
  const [policy, setPolicy] = useState<PolicyKey>('CONV');
  const [touched, setTouched] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 500));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const G = narrow ? NARROW : WIDE;
  const [moves, setMoves] = useState<Awaited<ReturnType<typeof firstRecommendationsAsync>> | null>(null);
  useEffect(() => {
    if (!data || !seen || moves) return;
    let live = true;
    loadBundle(['skills'])
      .then((b) => firstRecommendationsAsync(b))
      .then((m) => live && setMoves(m))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [data, seen, moves]);
  const layouts = useMemo(
    () => (moves && data ? ({ CONV: layout(data, moves.dest.CONV, G), v1: layout(data, moves.dest.v1, G), v2: layout(data, moves.dest.v2, G) } as Record<PolicyKey, Layout>) : null),
    [moves, data, G],
  );

  // cycle through the three policies while the chart is on screen, until the reader takes over
  useEffect(() => {
    if (!inView || touched || reduced) return;
    const order: PolicyKey[] = ['CONV', 'v1', 'v2'];
    const id = window.setInterval(() => setPolicy((p) => order[(order.indexOf(p) + 1) % 3]), 3600);
    return () => window.clearInterval(id);
  }, [inView, touched, reduced]);

  const L = layouts?.[policy];
  const max = L?.cols[0];
  const ease = reduced ? 'none' : 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1), fill 0.5s ease';
  return (
    <div ref={ref}>
      <Segmented<PolicyKey>
        label={t('home.crowdToggle')}
        value={policy}
        size="sm"
        onChange={(p) => {
          setTouched(true);
          setPolicy(p);
        }}
        options={[
          { value: 'CONV', label: t('mv.convLabel') },
          { value: 'v1', label: t('mv.v1') },
          { value: 'v2', label: t('mv.v2') },
        ]}
      />
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1" aria-live="polite">
        <span className="font-display text-4xl font-semibold num" style={{ color: COLOR[policy] }}>
          {L ? L.share.toFixed(1) : '0.0'}%
        </span>
        <span className="text-sm text-muted">{t('home.crowdShare')}</span>
      </div>
      <svg viewBox={`0 0 ${G.W} ${G.H}`} className="mt-3 w-full" role="img" aria-label={t('home.crowdAria', { p: L ? L.share.toFixed(1) : '', n: max?.n ?? '', dest: max?.title ?? '' })}>
        <line x1={G.colX0 - 8} x2={G.colX0 + 9 * G.colStep + 8} y1={G.base + 6} y2={G.base + 6} stroke="rgb(var(--line))" />
        <line x1={G.gridX0 - 4} x2={G.W} y1={G.gridBase + 6} y2={G.gridBase + 6} stroke="rgb(var(--line))" />
        <text x={Math.max(0, G.colX0 - 8)} y={12} className="fill-muted" fontSize={narrow ? 12.5 : 10.5} fontWeight="600">
          {t('home.crowdTop')}
        </text>
        <text x={G.othersLabel[0]} y={G.othersLabel[1]} className="fill-muted" fontSize={narrow ? 12.5 : 10.5} fontWeight="600">
          {t('home.crowdOthers')}
        </text>
        {L?.cols.map((c, k) => (
          <g key={k} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
            <rect x={G.colX0 + k * G.colStep - 9} y={20} width={18} height={G.base - 14} fill="transparent" />
            <text x={G.colX0 + k * G.colStep} y={G.base - c.n * G.stack - 4} textAnchor="middle" fontSize={narrow ? 11 : 9.5} fontWeight="700" className="fill-ink num">
              {c.n}
            </text>
          </g>
        ))}
        {layouts &&
          L &&
          L.pos.map(([x, y], k) => (
            <circle
              key={k}
              cx={0}
              cy={0}
              r={R}
              style={{ transform: `translate(${x}px, ${y}px)`, transition: ease, transitionDelay: reduced ? undefined : `${(k % 37) * 6}ms` }}
              fill={L.inTop[k] ? COLOR[policy] : 'rgb(var(--muted) / 0.25)'}
            />
          ))}
      </svg>
      <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-muted">
        {hover != null && L?.cols[hover]
          ? t('home.crowdCol', { dest: L.cols[hover].title, n: L.cols[hover].n })
          : max
            ? t('home.crowdMax', { dest: max.title, n: max.n })
            : t('home.crowdLead')}
      </p>
    </div>
  );
}

