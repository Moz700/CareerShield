import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, m as motion } from 'framer-motion';
import { useApp } from '../state/AppState';
import { Badge, PageHead, Segmented, toneFor } from '../components/ui';
import { IClose, ISearch, IArrow } from '../components/Icons';
import { Scatter } from '../components/charts';
import { fmt, fmtRM } from '../lib/format';
import { ISCO_MS, Key } from '../i18n';
import { Occupation } from '../lib/data';
import { Gate } from '../components/Gate';

export const GROUP_COLORS: Record<string, string> = {
  '1': '#d9480f',
  '2': '#1c7ed6',
  '3': '#0ca678',
  '4': '#7048e8',
  '5': '#e64980',
  '6': '#74b816',
  '7': '#a0785a',
  '8': '#5c6670',
  '9': '#15aabf',
  '0': '#868e96',
  x: '#b8bec4',
};

type SortKey = 'title' | 'pctl' | 'sal' | 'dem';

// A component of its own so the text is read when it mounts, after the descriptions have loaded.
function Description({ o }: { o: Occupation }) {
  return <p className="mt-4 text-sm leading-relaxed text-ink/80">{o.desc}</p>;
}

function Drawer({ o, onClose }: { o: Occupation; onClose: () => void }) {
  const { data, t, lang, selectOrigin } = useApp();
  const nav = useNavigate();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const g = o.isco1 != null ? (lang === 'ms' ? ISCO_MS[String(o.isco1)] : data!.meta.iscoNames[String(o.isco1)]) : t('res.notChained');
  const rows: [string, string][] = [
    [t('res.exposure'), o.pctl == null ? t('shell.na') : `${Math.round(o.pctl)} / 100`],
    [t('res.salary'), `${fmtRM(o.sal)}${o.salObs ? '' : ' (' + t('mv.estimate') + ')'}`],
    [t('res.demand'), `${Math.round(o.dem)} / 100`],
    [t('res.growth'), o.tier ? t(('res.tier.' + o.tier) as Key).split(':')[0] : t('shell.na')],
    [t('res.jobZone'), `${o.jz} / 5`],
    [t('res.masco'), g],
    [t('at.postings'), `MY ${fmt(o.nMy ?? 0)} · US ${fmt(o.nUs ?? 0)}`],
    [t('at.empUs'), fmt(o.emp24)],
    [t('at.trend'), o.trend == null ? t('shell.na') : `${o.trend > 0 ? '+' : ''}${o.trend.toFixed(1)} ${t('at.logPts')}`],
    [t('at.observed'), o.ms == null ? t('shell.na') : o.ms.toFixed(1)],
  ];
  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={t('at.detail')}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="relative h-full w-full max-w-md overflow-y-auto border-l border-line bg-surface p-6 shadow-lift"
      >
        <button autoFocus className="absolute right-4 top-4 rounded-md border border-line p-2 hover:bg-raised" onClick={onClose} aria-label={t('nav.close')}>
          <IClose size={16} />
        </button>
        <div className="eyebrow">{t('at.detail')}</div>
        <h2 className="mt-2 pr-10 font-display text-2xl font-semibold leading-tight">{o.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>O*NET {o.soc}</Badge>
          <Badge tone={toneFor(o.pctl) as 'risk'}>
            {t('res.exposure')} {o.pctl == null ? t('shell.na') : Math.round(o.pctl)}
          </Badge>
        </div>
        <Gate need={['desc']} fallback={<div className="skel mt-4 h-16 rounded-lg" role="status" aria-label={t('shell.loading')} />}>
          <Description o={o} />
        </Gate>
        <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted">{k}</dt>
              <dd className="num text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] text-muted">{t('at.observedNote')}</p>
        <button
          className="btn-primary mt-6 w-full"
          onClick={() => {
            selectOrigin(o.i, 'manual');
            nav('/analyse');
          }}
        >
          {t('at.analyse')} <IArrow />
        </button>
      </motion.aside>
    </motion.div>
  );
}

export function Atlas() {
  const { data, t, lang } = useApp();
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState<string>('all');
  const [yv, setYv] = useState<'sal' | 'dem'>('sal');
  const [view, setView] = useState<'chart' | 'list'>('chart');
  const [open, setOpen] = useState<number | null>(null);
  const [sort, setSort] = useState<[SortKey, number]>(['pctl', -1]);
  const [page, setPage] = useState(0);
  const occ = data!.occ;
  const match = useMemo(() => {
    const s = q.toLowerCase().trim();
    return occ.map((o) => (grp === 'all' || String(o.isco1 ?? 'x') === grp) && (!s || o.title.toLowerCase().includes(s) || o.soc.startsWith(s)));
  }, [occ, q, grp]);
  const n = match.filter(Boolean).length;
  const points = useMemo(
    () =>
      occ
        .filter((o) => o.pctl != null && (yv === 'dem' || o.sal != null))
        .map((o) => ({ i: o.i, x: o.pctl as number, y: yv === 'sal' ? (o.sal as number) : o.dem, color: GROUP_COLORS[String(o.isco1 ?? 'x')], dim: !match[o.i] })),
    [occ, yv, match],
  );
  const groups = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const gname = (g: string) => (lang === 'ms' ? ISCO_MS[g] : data!.meta.iscoNames[g]);
  const rows = useMemo(() => {
    const r = occ.filter((_, k) => match[k]);
    const [key, dir] = sort;
    return r.sort((a, b) => {
      const va = a[key] ?? -1;
      const vb = b[key] ?? -1;
      return (typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)) * dir;
    });
  }, [occ, match, sort]);
  useEffect(() => setPage(0), [q, grp, sort]);
  const per = 25;
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const th = (k: SortKey, label: string) => (
    <th aria-sort={sort[0] === k ? (sort[1] > 0 ? 'ascending' : 'descending') : 'none'}>
      <button className="font-semibold uppercase hover:text-ink" onClick={() => setSort(([sk, d]) => [k, sk === k ? -d : k === 'title' ? 1 : -1])}>
        {label} {sort[0] === k ? (sort[1] > 0 ? '▲' : '▼') : ''}
      </button>
    </th>
  );
  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <PageHead title={t('at.title')} lead={t('at.lead')} />
      <div className="card mb-6 space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <ISearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <label htmlFor="atlas-q" className="sr-only">
              {t('at.search')}
            </label>
            <input id="atlas-q" className="input pl-11" placeholder={t('at.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented<'chart' | 'list'> size="sm" label={t('at.chart')} value={view} onChange={setView} options={[{ value: 'chart', label: t('at.chart') }, { value: 'list', label: t('at.table') }]} />
            {view === 'chart' && <Segmented<'sal' | 'dem'> size="sm" label={t('at.y')} value={yv} onChange={setYv} options={[{ value: 'sal', label: t('at.ySal') }, { value: 'dem', label: t('at.yDem') }]} />}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold text-muted">{t('at.group')}</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('at.group')}>
            <button aria-pressed={grp === 'all'} onClick={() => setGrp('all')} className={`chip ${grp === 'all' ? 'border-brand bg-brand text-brand-ink' : ''}`}>
              {t('at.all')}
            </button>
            {groups.map((g) => (
              <button key={g} aria-pressed={grp === g} onClick={() => setGrp(grp === g ? 'all' : g)} className={`chip ${grp === g ? 'border-brand bg-brand/10 text-brand' : ''}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP_COLORS[g] }} />
                {g}. {gname(g)}
              </button>
            ))}
            <button aria-pressed={grp === 'x'} onClick={() => setGrp(grp === 'x' ? 'all' : 'x')} className={`chip ${grp === 'x' ? 'border-brand bg-brand/10 text-brand' : ''}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP_COLORS.x }} />
              {t('at.notChained')}
            </button>
          </div>
        </div>
        <div className="text-xs text-muted num" aria-live="polite">
          {t('at.count', { n })}
        </div>
      </div>

      {view === 'chart' ? (
        <div className="card p-4 sm:p-6">
          <Scatter
            ariaLabel={t('at.title')}
            points={points}
            xDomain={[0, 100]}
            yDomain={yv === 'sal' ? [1500, 14000] : [0, 100]}
            yLog={yv === 'sal'}
            xTicks={[0, 20, 40, 60, 80, 100]}
            yTicks={yv === 'sal' ? [2000, 3000, 5000, 8000, 12000] : [0, 25, 50, 75, 100]}
            yFmt={yv === 'sal' ? (v) => (v >= 1000 ? `${v / 1000}k` : String(v)) : undefined}
            xLabel={t('at.x')}
            yLabel={yv === 'sal' ? t('at.ySal') : t('at.yDem')}
            onPick={(i) => setOpen(i)}
            selected={open}
            tooltip={(i) => (
              <div>
                <div className="font-semibold leading-snug">{occ[i].title}</div>
                <div className="num text-muted">
                  {t('res.exposure')} {Math.round(occ[i].pctl ?? 0)} · {fmtRM(occ[i].sal)} · {t('mv.demand')} {Math.round(occ[i].dem)}
                </div>
              </div>
            )}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  {th('title', t('at.col.title'))}
                  {th('pctl', t('at.col.exp'))}
                  {th('sal', t('at.col.sal'))}
                  {th('dem', t('at.col.dem'))}
                  <th>{t('at.col.tier')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(page * per, page * per + per).map((o) => (
                  <tr key={o.i} className="cursor-pointer hover:bg-raised" onClick={() => setOpen(o.i)}>
                    <td className="max-w-[18rem]">
                      <button className="text-left font-semibold hover:text-brand" onClick={() => setOpen(o.i)}>
                        {o.title}
                      </button>
                    </td>
                    <td>
                      <Badge tone={toneFor(o.pctl) as 'risk'}>{o.pctl == null ? t('shell.na') : Math.round(o.pctl)}</Badge>
                    </td>
                    <td className="whitespace-nowrap">{fmtRM(o.sal)}</td>
                    <td>{Math.round(o.dem)}</td>
                    <td className="text-muted">{o.tier ? t(('res.tier.' + o.tier) as Key).split(':')[0] : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line p-3 text-sm">
            <button className="btn-ghost px-3 py-1.5" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              {t('at.prev')}
            </button>
            <span className="text-muted num">{t('at.page', { a: page + 1, b: pages })}</span>
            <button className="btn-ghost px-3 py-1.5" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              {t('at.next')}
            </button>
          </div>
        </div>
      )}
      <AnimatePresence>{open != null && <Drawer o={occ[open]} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  );
}
