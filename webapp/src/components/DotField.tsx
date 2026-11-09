import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { useApp } from '../state/AppState';
import { INext, IPause, IPlay } from './Icons';

interface Dot {
  i: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  p: number;
  ph: number;
}

function rgbVar(name: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map(Number);
  return v.length === 3 ? v : [128, 128, 128];
}

function mix(a: number[], b: number[], t: number) {
  return a.map((x, k) => Math.round(x + (b[k] - x) * t));
}

const LO = Math.log(1500);
const HI = Math.log(13000);
const PAD = { l: 46, r: 10, t: 10, b: 24 };
const X_TICKS = [0, 25, 50, 75, 100];
const Y_TICKS = [2000, 4000, 8000];
const SETTLE = 2.6; // seconds for the dots to reach their places
const FADE = 3; // seconds over which the gentle drift then dies away
const CYCLE = 5600; // milliseconds each example stays on screen
const DRAW = 1100; // milliseconds to draw an example's three moves
const OUT = 200; // milliseconds for the previous example to fade out (exits are quicker than entrances)
const GAP = 140; // milliseconds between the old example leaving and the new one starting

const xOf = (p: number, W: number) => PAD.l + (p / 100) * (W - PAD.l - PAD.r);
const yOf = (sal: number, H: number) => H - PAD.b - ((Math.log(sal) - LO) / (HI - LO)) * (H - PAD.t - PAD.b);

/**
 * Hero visual. Every occupation is a dot, placed by AI exposure (x) and Malaysian monthly salary
 * (y, log scale). Once the dots have settled it walks through a few example occupations and draws
 * the first three moves that CareerShield v2 suggests for each, so the chart shows what the tool
 * does: from where a worker is to where they could go.
 */
export function DotField({ examples = [] }: { examples?: number[] }) {
  const { data, dark, reduced, selectOrigin, t } = useApp();
  const nav = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dots = useRef<Dot[]>([]);
  const hover = useRef<number>(-1);
  const redraw = useRef<() => void>(() => undefined);
  const shown = useRef({ ex: -1, at: 0, first: -1, prev: -1, prevAt: 0 });
  const [tip, setTip] = useState<{ x: number; y: number; title: string; p: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [ex, setEx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(true);

  // examples whose origin and three moves can all be placed on the chart
  const list = useMemo(() => {
    if (!data) return [];
    return examples
      .map((o) => ({ o, d: (data.occ[o]?.v2 ?? []).slice(0, 3) }))
      .filter(
        (e) =>
          data.occ[e.o]?.pctl != null &&
          data.occ[e.o]?.sal != null &&
          e.d.length === 3 &&
          e.d.every((j) => data.occ[j].pctl != null && data.occ[j].sal != null),
      );
  }, [data, examples]);
  const listRef = useRef(list);
  listRef.current = list;

  useEffect(() => {
    const cv = canvas.current;
    const el = wrap.current;
    if (!cv || !el || !data) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const pts = data.occ.filter((o) => o.pctl != null && o.sal != null);
    let W = 0;
    let H = 0;
    const byOcc = new Map<number, number>();
    const layout = () => {
      const r = el.getBoundingClientRect();
      W = r.width;
      H = r.height;
      setSize((s) => (s.w === W && s.h === H ? s : { w: W, h: H }));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fresh = dots.current.length === 0;
      dots.current = pts.map((o, k) => {
        const tx = xOf(o.pctl as number, W);
        const ty = yOf(o.sal as number, H);
        const prev = dots.current[k];
        const ang = (k * 2.399963) % (Math.PI * 2);
        const rad = Math.sqrt(k / pts.length) * Math.min(W, H) * 0.42;
        const sx = W / 2 + Math.cos(ang) * rad;
        const sy = H / 2 + Math.sin(ang) * rad;
        byOcc.set(o.i, k);
        return {
          i: o.i,
          tx,
          ty,
          x: fresh ? (reduced ? tx : sx) : prev?.x ?? tx,
          y: fresh ? (reduced ? ty : sy) : prev?.y ?? ty,
          sx,
          sy,
          p: o.pctl as number,
          ph: (k * 0.61803) % 1,
        };
      });
    };
    layout();
    const safe = rgbVar('--safe');
    const warn = rgbVar('--warn');
    const risk = rgbVar('--risk');
    const ink = rgbVar('--ink');
    const brand = rgbVar('--brand');
    const surface = rgbVar('--surface');
    const colorOf = (p: number) => (p < 50 ? mix(safe, warn, p / 50) : mix(warn, risk, (p - 50) / 50));
    // 40 colour bands look continuous. Each band's dot is drawn once into a small sprite and then
    // copied at whole device pixels, which is cheaper per frame than filling hundreds of arcs. The
    // dots start moving only once the page has finished its start-up work, at about 30 frames a
    // second; the loop stops whenever nothing moves, so the hero costs nothing at rest. It also
    // pauses while off screen or in a hidden tab, and draws still frames when motion is reduced.
    const BANDS = 40;
    const R = 2.5;
    const alpha = dark ? 0.85 : 0.8;
    const fills = Array.from({ length: BANDS }, (_, k) => {
      const c = colorOf(((k + 0.5) / BANDS) * 100);
      return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
    });
    const sdpr = Math.min(window.devicePixelRatio || 1, 2);
    const SZ = Math.ceil((R * 2 + 2) * sdpr);
    const sprites = fills.map((f) => {
      const s = document.createElement('canvas');
      s.width = SZ;
      s.height = SZ;
      const sc = s.getContext('2d');
      if (sc) {
        sc.scale(sdpr, sdpr);
        sc.beginPath();
        sc.arc(SZ / sdpr / 2, SZ / sdpr / 2, R, 0, Math.PI * 2);
        sc.fillStyle = f;
        sc.fill();
      }
      return s;
    });
    const half = SZ / 2;
    const bandOf = (p: number) => Math.min(BANDS - 1, Math.floor((p / 100) * BANDS));
    const band: number[][] = Array.from({ length: BANDS }, () => []);
    dots.current.forEach((d, k) => band[bandOf(d.p)].push(k));
    const inkRgb = `rgb(${ink.join(',')})`;
    const brandRgba = (a: number) => `rgba(${brand.join(',')},${a})`;
    const surfaceRgb = `rgb(${surface.join(',')})`;
    let raf = 0;
    let visible = true;
    let tabShown = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    let last = 0;
    let t0 = -1; // set when the dots start to move
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);

    // a quadratic curve from a to b that bows to the left of the direction of travel
    const curve = (ax: number, ay: number, bx: number, by: number) => {
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const bow = Math.min(46, len * 0.28);
      return { cx: mx + (dy / len) * bow, cy: my - (dx / len) * bow };
    };
    const at = (ax: number, ay: number, cx: number, cy: number, bx: number, by: number, u: number) => {
      const v = 1 - u;
      return [v * v * ax + 2 * v * u * cx + u * u * bx, v * v * ay + 2 * v * u * cy + u * u * by];
    };

    const frame = (now: number) => {
      raf = 0;
      const tt = t0 < 0 ? 0 : Math.max(0, now - t0) / 1000;
      const settle = reduced ? 1 : Math.min(1, tt / SETTLE);
      const drift = reduced ? 0 : Math.max(0, 1 - Math.max(0, tt - SETTLE) / FADE);
      const sh = shown.current;
      const hl = sh.ex >= 0 ? listRef.current[sh.ex] : undefined;
      const prog = !hl ? 0 : reduced ? 1 : Math.max(0, Math.min(1, (now - sh.at) / DRAW));
      const old = !reduced && sh.prev >= 0 && sh.prev !== sh.ex ? listRef.current[sh.prev] : undefined;
      const outT = old ? Math.min(1, (now - sh.prevAt) / OUT) : 1;
      const dimIn = !hl ? 0 : reduced ? 1 : Math.min(1, (now - sh.first) / 700);
      const moving = !reduced && ((t0 >= 0 && drift > 0) || (hl != null && (prog < 1 || dimIn < 1)) || outT < 1);
      // about 30 frames a second is plenty for motion this slow
      if (moving && now - last < 30) {
        raf = requestAnimationFrame(frame);
        return;
      }
      last = now;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const e = ease(settle);
      const amp = 1.6 * e * drift;
      const ds = dots.current;
      for (let k = 0; k < ds.length; k++) {
        const d = ds[k];
        d.x = d.sx + (d.tx - d.sx) * e + Math.sin(tt * 0.7 + d.ph * 6.28) * amp;
        d.y = d.sy + (d.ty - d.sy) * e + Math.cos(tt * 0.55 + d.ph * 9.1) * amp;
      }
      ctx.globalAlpha = 1 - 0.5 * dimIn;
      for (let b = 0; b < BANDS; b++) {
        const sp = sprites[b];
        for (const k of band[b]) {
          const d = ds[k];
          ctx.drawImage(sp, Math.round(d.x * sdpr) - half, Math.round(d.y * sdpr) - half);
        }
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);

      // one example: the origin ring scales in first, then the three moves draw out of it in turn
      // (eased out, no overshoot) and each destination lands as its line arrives
      const drawExample = (ex: { o: number; d: number[] }, p: number, fade: number, ringIn: number) => {
        const ko = byOcc.get(ex.o);
        const o = ko != null ? ds[ko] : undefined;
        if (!o) return;
        ctx.globalAlpha = fade;
        ex.d.forEach((j, k) => {
          const kd = byOcc.get(j);
          const d = kd != null ? ds[kd] : undefined;
          if (!d) return;
          const pk = ease(Math.max(0, Math.min(1, (p - 0.12 - k * 0.12) / 0.6)));
          if (pk <= 0) return;
          const { cx, cy } = curve(o.x, o.y, d.x, d.y);
          ctx.beginPath();
          ctx.moveTo(o.x, o.y);
          const steps = 28;
          for (let s = 1; s <= steps; s++) {
            const [px, py] = at(o.x, o.y, cx, cy, d.x, d.y, (s / steps) * pk);
            ctx.lineTo(px, py);
          }
          ctx.strokeStyle = brandRgba(0.9);
          ctx.lineWidth = 1.6;
          ctx.stroke();
          if (pk > 0.9) {
            const a = ease(Math.min(1, (pk - 0.9) / 0.1));
            ctx.beginPath();
            ctx.arc(d.x, d.y, 4.6 * a, 0, Math.PI * 2);
            ctx.fillStyle = brandRgba(1);
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = surfaceRgb;
            ctx.stroke();
            ctx.globalAlpha = fade * a;
            ctx.font = '600 10px "Red Hat Mono Variable", ui-monospace, monospace';
            ctx.fillStyle = inkRgb;
            ctx.textBaseline = 'middle';
            ctx.textAlign = d.x > W - 24 ? 'right' : 'left';
            ctx.fillText(String(k + 1), d.x + (d.x > W - 24 ? -8 : 8), d.y - 8);
            ctx.globalAlpha = fade;
          }
        });
        const r = ease(ringIn);
        if (r > 0) {
          ctx.beginPath();
          ctx.arc(o.x, o.y, 6.5 * r, 0, Math.PI * 2);
          ctx.fillStyle = surfaceRgb;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = inkRgb;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(o.x, o.y, 3 * r, 0, Math.PI * 2);
          ctx.fillStyle = inkRgb;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      // the previous example leaves quickly (eased in) before the next one starts
      if (old && outT < 1) drawExample(old, 1, 1 - outT * outT, 1);
      if (hl) drawExample(hl, prog, 1, reduced ? 1 : Math.max(0, Math.min(1, (now - sh.at) / 220)));

      const h = hover.current;
      if (h >= 0 && ds[h]) {
        const d = ds[h];
        ctx.beginPath();
        ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = fills[bandOf(d.p)];
        ctx.fill();
        ctx.strokeStyle = inkRgb;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (moving && visible && tabShown) raf = requestAnimationFrame(frame);
    };
    // draws one frame, and the loop continues from there while anything is moving
    const kick = () => {
      if (!raf && visible && tabShown) raf = requestAnimationFrame(frame);
    };
    redraw.current = () => {
      last = 0;
      kick();
    };
    // the first frame is a still one; the dots start to settle when the main thread is idle
    kick();
    let settled = 0;
    const go = () => {
      if (t0 >= 0) return;
      t0 = performance.now();
      kick();
      settled = window.setTimeout(() => setReady(true), SETTLE * 1000);
    };
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const idle = reduced ? 0 : hasIdle ? window.requestIdleCallback(go, { timeout: 2500 }) : window.setTimeout(go, 800);
    if (reduced) setReady(true);
    const vis = () => {
      const was = tabShown;
      tabShown = document.visibilityState !== 'hidden';
      setOnScreen(tabShown && visible);
      if (tabShown && !was) kick();
    };
    document.addEventListener('visibilitychange', vis);
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([en]) => {
            const was = visible;
            visible = en.isIntersecting;
            setOnScreen(tabShown && visible);
            if (visible && !was) kick();
          });
    io?.observe(el);
    const ro = new ResizeObserver(() => {
      layout();
      last = 0; // the canvas was cleared, so the next frame must draw
      kick();
    });
    ro.observe(el);
    const move = (ev: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      let best = -1;
      let bd = 144;
      dots.current.forEach((d, k) => {
        const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
        if (dd < bd) {
          bd = dd;
          best = k;
        }
      });
      if (best !== hover.current) {
        hover.current = best;
        last = 0;
        kick();
      }
      if (best >= 0) {
        const d = dots.current[best];
        setTip({ x: d.x, y: d.y, title: data.occ[d.i].title, p: d.p });
      } else setTip(null);
    };
    const leave = () => {
      hover.current = -1;
      last = 0;
      kick();
      setTip(null);
    };
    const click = () => {
      if (hover.current >= 0) {
        selectOrigin(dots.current[hover.current].i, 'manual');
        nav('/analyse');
      }
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerleave', leave);
    cv.addEventListener('click', click);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settled);
      if (idle) {
        if (hasIdle) window.cancelIdleCallback(idle);
        else window.clearTimeout(idle);
      }
      redraw.current = () => undefined;
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', vis);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerleave', leave);
      cv.removeEventListener('click', click);
    };
  }, [data, dark, reduced, nav, selectOrigin]);

  // put the current example on screen and draw its moves from the start
  useEffect(() => {
    if (!ready || !list.length) return;
    const now = performance.now();
    const sh = shown.current;
    if (sh.first < 0) sh.first = now;
    const next = ex % list.length;
    const switching = sh.ex >= 0 && sh.ex !== next && !reduced;
    sh.prev = switching ? sh.ex : -1;
    sh.prevAt = now;
    sh.ex = next;
    sh.at = switching ? now + OUT + GAP : now;
    redraw.current();
  }, [ex, ready, list.length, reduced]);

  // move on to the next example after a while, unless paused, off screen or motion is reduced
  useEffect(() => {
    if (!ready || reduced || !playing || !onScreen || list.length < 2) return;
    const id = window.setTimeout(() => setEx((e) => (e + 1) % list.length), CYCLE);
    return () => window.clearTimeout(id);
  }, [ex, ready, reduced, playing, onScreen, list.length]);

  const cur = list.length ? list[ex % list.length] : undefined;
  const W = size.w;
  const H = size.h;
  const tool = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-raised';

  return (
    <div className="flex h-full flex-col">
      <div ref={wrap} className="relative min-h-0 flex-1">
        {W > 0 && (
          <svg className="pointer-events-none absolute inset-0" width={W} height={H} aria-hidden="true">
            {Y_TICKS.map((s) => (
              <g key={s}>
                <line x1={PAD.l} x2={W - PAD.r} y1={yOf(s, H)} y2={yOf(s, H)} className="stroke-line" strokeDasharray="2 4" />
                <text x={PAD.l - 8} y={yOf(s, H)} dy="0.32em" textAnchor="end" className="fill-muted font-mono text-[10px]">
                  {s / 1000}k
                </text>
              </g>
            ))}
            <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="stroke-line" />
            {X_TICKS.map((p) => (
              <text key={p} x={xOf(p, W)} y={H - PAD.b + 15} textAnchor={p === 0 ? 'start' : p === 100 ? 'end' : 'middle'} className="fill-muted font-mono text-[10px]">
                {p}
              </text>
            ))}
          </svg>
        )}
        <canvas ref={canvas} className="absolute inset-0 cursor-crosshair" aria-hidden="true" />
        {tip && (
          <div
            className="pointer-events-none absolute z-10 max-w-[220px] -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lift"
            style={{ left: Math.min(Math.max(tip.x, 110), (wrap.current?.clientWidth ?? 300) - 110), top: tip.y - 10 }}
          >
            <div className="font-semibold leading-snug">{tip.title}</div>
            <div className="num text-muted">
              {t('res.exposure')} {Math.round(tip.p)}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 min-h-[8.5rem] border-t border-line pt-3">
        {cur && data && (
          <div className="flex items-start gap-3">
            <motion.div
              key={ex % list.length}
              className="min-w-0 flex-1"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: OUT / 1000, ease: [0, 0, 0.2, 1] }}
            >
              <div className="text-xs text-muted">
                <span className="font-semibold text-brand">
                  {t('home.exLabel')} {(ex % list.length) + 1}/{list.length}
                </span>
                {': '}
                {t('home.exMoves')}
              </div>
              <div className="mt-1.5 flex items-baseline gap-3 text-sm">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-semibold">{data.occ[cur.o].title}</span>
                <span className="shrink-0 font-mono text-xs text-muted">
                  <span className="hidden sm:inline">{t('res.exposure')} </span>
                  {Math.round(data.occ[cur.o].pctl as number)}
                </span>
              </div>
              <ol className="mt-1 grid gap-0.5 text-sm">
                {cur.d.map((j, k) => (
                  <li key={j} className="flex items-baseline gap-3">
                    <span className="w-2.5 shrink-0 text-center font-mono text-xs text-brand">{k + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-ink/85">{data.occ[j].title}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">{Math.round(data.occ[j].pctl as number)}</span>
                  </li>
                ))}
              </ol>
            </motion.div>
            <div className="flex shrink-0 gap-1">
              {!reduced && list.length > 1 && (
                <button className={tool} onClick={() => setPlaying((p) => !p)} aria-label={playing ? t('home.exPause') : t('home.exPlay')} title={playing ? t('home.exPause') : t('home.exPlay')}>
                  {playing ? <IPause size={14} /> : <IPlay size={14} />}
                </button>
              )}
              {list.length > 1 && (
                <button className={tool} onClick={() => setEx((e) => (e + 1) % list.length)} aria-label={t('home.exNext')} title={t('home.exNext')}>
                  <INext size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
