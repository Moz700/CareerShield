import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { animate, m as motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { IArrow } from './Icons';

// The mark: a shield with one move rising out of it, from where you are to where you could go.
export const LOGO_SHIELD = 'M6 6.2C6 5 7 4 8.2 4h15.6C25 4 26 5 26 6.2v9.3c0 6.1-4.1 10.9-10 13.1C10.1 26.4 6 21.6 6 15.5Z';
export const LOGO_MOVE = 'M11 22.5C11 16.5 15 13.5 21 11.5';
export const LOGO_HEAD = 'M17.6 9.4 21.6 11.2 19.9 15.2';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d={LOGO_SHIELD} className="fill-brand" />
      <g fill="none" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand-ink">
        <path d={LOGO_MOVE} />
        <path d={LOGO_HEAD} />
      </g>
    </svg>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="relative inline-flex rounded-md border border-line bg-raised p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const k = options.findIndex((x) => x.value === value);
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(options[(k + 1) % options.length].value);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                onChange(options[(k - 1 + options.length) % options.length].value);
              }
            }}
            tabIndex={on ? 0 : -1}
            className={`relative z-10 rounded font-semibold transition-colors ${size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} ${
              on ? 'text-brand-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {on && <motion.span layoutId={id} className="absolute inset-0 -z-10 rounded bg-brand" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Reveal({ children, delay = 0, className = '', as = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'li' }) {
  const M = as === 'li' ? motion.li : motion.div;
  const { reduced } = useApp();
  // with reduced motion the content is simply there; print styles also override the hidden state,
  // so sections that were never scrolled into view still print
  return (
    <M
      data-reveal=""
      className={className}
      initial={reduced ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </M>
  );
}

export function CountUp({ value, decimals = 0, className = '', duration = 1.1 }: { value: number; decimals?: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const { reduced } = useApp();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced || !inView) {
      el.textContent = value.toLocaleString('en-MY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      if (!inView) return;
      return;
    }
    const c = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = v.toLocaleString('en-MY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      },
    });
    return () => c.stop();
  }, [value, decimals, inView, reduced, duration]);
  return (
    <span ref={ref} className={`num ${className}`}>
      {value.toLocaleString('en-MY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}

export type Tone = 'brand' | 'risk' | 'safe' | 'warn' | 'muted' | 'CONV' | 'v1' | 'v2';
export function Meter({ value, max = 100, tone = 'brand', label, height = 8 }: { value: number; max?: number; tone?: Tone; label?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  const color = { brand: 'bg-brand', risk: 'bg-risk', safe: 'bg-safe', warn: 'bg-warn', muted: 'bg-muted', CONV: 'bg-pol-conv', v1: 'bg-pol-v1', v2: 'bg-pol-v2' }[tone];
  return (
    <div className="w-full rounded-sm bg-line/70 overflow-hidden" style={{ height }} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label}>
      <motion.div className={`h-full rounded-sm ${color}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

export function SectionHead({ eyebrow, title, lead, id }: { eyebrow?: string; title: string; lead?: string; id?: string }) {
  return (
    <div className="mb-6 max-w-3xl">
      {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
      <h2 id={id} className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      {lead && <p className="mt-2 text-muted leading-relaxed">{lead}</p>}
    </div>
  );
}

export function PageHead({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <h1 className="font-display text-3xl sm:text-[2.6rem] leading-tight font-semibold tracking-tight">{title}</h1>
        {lead && <p className="mt-3 text-muted text-base sm:text-lg leading-relaxed">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

export function Loader({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <div className="flex items-end gap-1.5 h-10">
        {[0, 1, 2, 3].map((k) => (
          <motion.span
            key={k}
            className="w-2.5 rounded-sm bg-gold"
            animate={{ height: [10, 36, 10] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: k * 0.14, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

/**
 * Placeholder layout shown while a page or its data loads. With a title (and lead) it shows the
 * page's real heading straight away, in the same place the page will put it.
 */
export function PageSkeleton({ label, title, lead }: { label: string; title?: string; lead?: string }) {
  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:px-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {title ? (
        <PageHead title={title} lead={lead} />
      ) : (
        <>
          <div className="skel h-10 w-2/3 max-w-md rounded-xl" />
          <div className="skel mt-4 h-5 w-full max-w-xl rounded-lg" />
        </>
      )}
      <div className={`${title ? '' : 'mt-10 '}grid gap-5 md:grid-cols-3`}>
        {[0, 1, 2].map((k) => (
          <div key={k} className="card p-6">
            <div className="skel h-4 w-1/2 rounded" />
            <div className="skel mt-4 h-24 rounded-xl" />
            <div className="skel mt-4 h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>
      <div className="card mt-6 p-6">
        <div className="skel h-48 rounded-xl" />
      </div>
    </div>
  );
}

export function NeedOrigin() {
  const { t } = useApp();
  return (
    <div className="card p-8 sm:p-12 text-center max-w-xl mx-auto">
      <p className="font-display text-xl">{t('res.none')}</p>
      <p className="mt-2 text-sm text-muted">{t('res.noneLead')}</p>
      <Link to="/analyse" className="btn-primary mt-6">
        {t('res.noneCta')} <IArrow />
      </Link>
    </div>
  );
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'risk' | 'safe' | 'warn' | 'brand' }) {
  const c = {
    muted: 'bg-raised text-muted border-line',
    risk: 'bg-risk/10 text-risk border-risk/25',
    safe: 'bg-safe/10 text-safe border-safe/25',
    warn: 'bg-warn/10 text-warn border-warn/25',
    brand: 'bg-brand/10 text-brand border-brand/25',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[0.72rem] font-semibold ${c}`}>{children}</span>;
}

export function useCopy(): [boolean, (s: string) => void] {
  const [ok, setOk] = useState(false);
  const copy = (s: string) => {
    const done = () => {
      setOk(true);
      setTimeout(() => setOk(false), 1600);
    };
    try {
      navigator.clipboard.writeText(s).then(done, () => fallback(s, done));
    } catch {
      fallback(s, done);
    }
  };
  return [ok, copy];
}

function fallback(s: string, done: () => void) {
  const ta = document.createElement('textarea');
  ta.value = s;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* ignore */
  }
  ta.remove();
  done();
}

export const toneFor = (p: number | null) => (p == null ? 'muted' : p >= 70 ? 'risk' : p >= 40 ? 'warn' : 'safe') as 'risk' | 'warn' | 'safe' | 'muted';
