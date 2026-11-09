import { useEffect, useState } from 'react';
import { animate, m as motion } from 'framer-motion';
import { useApp } from '../state/AppState';

// Semicircular exposure gauge. The arc runs from low (left) to high (right) exposure percentile.
export function Gauge({ value, label, sub }: { value: number | null; label: string; sub: string }) {
  const { reduced, t } = useApp();
  const v = value ?? 0;
  const [shown, setShown] = useState(reduced ? v : 0);
  useEffect(() => {
    if (reduced) {
      setShown(v);
      return;
    }
    const c = animate(0, v, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: setShown });
    return () => c.stop();
  }, [v, reduced]);

  const R = 92;
  const cx = 120;
  const cy = 116;
  const angle = (p: number) => Math.PI * (1 - p / 100);
  const pt = (p: number, r = R) => [cx + r * Math.cos(angle(p)), cy - r * Math.sin(angle(p))];
  const arc = (a: number, b: number, r = R) => {
    const [x1, y1] = pt(a, r);
    const [x2, y2] = pt(b, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const [nx, ny] = pt(shown, R - 26);
  const ticks = [0, 25, 50, 75, 100];
  return (
    <figure className="relative mx-auto w-full max-w-[300px]" aria-label={`${label}: ${Math.round(v)}`}>
      <svg viewBox="0 0 240 140" className="w-full overflow-visible">
        <defs>
          <linearGradient id="gauge-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgb(var(--safe))" />
            <stop offset="50%" stopColor="rgb(var(--warn))" />
            <stop offset="100%" stopColor="rgb(var(--risk))" />
          </linearGradient>
        </defs>
        <path d={arc(0, 100)} stroke="rgb(var(--line))" strokeWidth="16" fill="none" strokeLinecap="round" />
        <motion.path
          d={arc(0, 100)}
          stroke="url(#gauge-grad)"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: reduced ? v / 100 : 0 }}
          animate={{ pathLength: Math.max(0.001, v / 100) }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
        {ticks.map((p) => {
          const [x1, y1] = pt(p, R + 13);
          const [x2, y2] = pt(p, R + 18);
          return <line key={p} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(var(--muted))" strokeWidth="1.5" />;
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="rgb(var(--ink))" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="7" fill="rgb(var(--ink))" />
        <circle cx={cx} cy={cy} r="2.5" fill="rgb(var(--surface))" />
      </svg>
      <figcaption className="-mt-3 text-center">
        <div className="font-display text-5xl font-semibold num leading-none">{value == null ? t('shell.na') : Math.round(shown)}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">{sub}</div>
      </figcaption>
    </figure>
  );
}
