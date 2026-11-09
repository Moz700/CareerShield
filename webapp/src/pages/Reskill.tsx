import { useMemo } from 'react';
import { m as motion } from 'framer-motion';
import { useApp } from '../state/AppState';
import { Badge, NeedOrigin, PageHead } from '../components/ui';
import { IExternal, IBook } from '../components/Icons';
import { movesFor } from '../lib/ranking';
import { CourseHit, coursesFor } from '../lib/insight';

function CourseLink({ c, primary }: { c: CourseHit; primary?: boolean }) {
  const { t } = useApp();
  return (
    <a
      href={c.url}
      target="_blank"
      rel="noreferrer"
      className={`group flex items-start justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
        primary ? 'border-brand/30 bg-brand/5 hover:border-brand' : 'border-line bg-surface hover:border-brand/60'
      }`}
    >
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge tone={c.source === 'elatih' ? 'safe' : 'brand'}>{c.source === 'elatih' ? t('rs.elatih') : t('rs.coursera')}</Badge>
          <span className="num text-[11px] text-muted">
            {t('rs.relevance')} {c.relevance.toFixed(2)}
          </span>
        </div>
        <div className={`font-semibold leading-snug ${primary ? 'text-base' : 'text-sm'}`}>{c.name}</div>
        <div className="mt-0.5 text-xs text-muted">{[c.provider, c.extra].filter(Boolean).join(' · ')}</div>
      </div>
      <span className="mt-1 shrink-0 text-muted group-hover:text-brand" aria-label={t('rs.open')}>
        <IExternal size={16} />
      </span>
    </a>
  );
}

export function Reskill() {
  const { data, t, sel, selectDest, policy, weights } = useApp();
  const i = sel.origin;
  const moves = useMemo(() => (i == null ? [] : movesFor(data!, i, policy, weights).slice(0, 8)), [data, i, policy, weights]);
  const dest = sel.dest ?? moves[0]?.j ?? null;
  const plan = useMemo(() => (i == null || dest == null ? [] : coursesFor(data!, i, dest, 5)), [data, i, dest]);
  if (i == null) {
    return (
      <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
        <PageHead title={t('rs.title')} />
        <NeedOrigin />
      </div>
    );
  }
  const o = data!.occ[i];
  const options = Array.from(new Set([...(dest != null ? [dest] : []), ...moves.map((m) => m.j)]));
  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <PageHead title={t('rs.title')} lead={t('rs.lead', { from: o.title })} />
      <div className="card mb-8 p-5">
        <label htmlFor="dest" className="mb-2 block text-sm font-semibold">
          {t('rs.dest')}
        </label>
        <select id="dest" className="input" value={dest ?? ''} onChange={(e) => selectDest(Number(e.target.value))}>
          {options.map((j) => (
            <option key={j} value={j}>
              {data!.occ[j].title}
            </option>
          ))}
        </select>
      </div>
      {dest == null ? (
        <p className="card p-6 text-muted">{t('rs.noDest')}</p>
      ) : (
        <>
          <div className="mb-5 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold">{t('rs.gaps')}</h2>
            <p className="mt-1 text-sm text-muted">{t('rs.gapsLead')}</p>
          </div>
          {plan.length === 0 && <p className="card p-6 text-muted">{t('mv.noGaps')}</p>}
          <ol className="space-y-5">
            {plan.map((p, k) => (
              <motion.li key={dest + '-' + p.gap.j} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.07 }} className="card grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper num">{k + 1}</span>
                    <h3 className="font-display text-lg font-semibold leading-snug">{p.gap.element}</h3>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {[
                      [t('rs.now'), p.gap.from, 'bg-muted'],
                      [t('rs.target'), p.gap.to, 'bg-brand'],
                    ].map(([lab, v, c]) => (
                      <div key={lab as string} className="flex items-center gap-3 text-xs">
                        <span className="w-16 shrink-0 text-muted">{lab}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line/60">
                          <motion.div className={`h-full rounded-full ${c}`} initial={{ width: 0 }} animate={{ width: `${((v as number) / 5) * 100}%` }} transition={{ duration: 0.8, delay: 0.1 + k * 0.07 }} />
                        </div>
                        <span className="w-8 text-right font-semibold num">{(v as number).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
                    <IBook size={14} /> {t('rs.course')}
                  </div>
                  {p.primary ? <CourseLink c={p.primary} primary /> : <p className="rounded-xl bg-raised p-4 text-sm text-muted">{t('rs.noCourse')}</p>}
                  {p.alternatives.length > 0 && (
                    <details className="mt-3 group">
                      <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ink">
                        {t('rs.alternatives')} ({p.alternatives.length})
                      </summary>
                      <div className="mt-2 grid gap-2">
                        {p.alternatives.map((c) => (
                          <CourseLink key={c.url + c.name} c={c} />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </motion.li>
            ))}
          </ol>
          <div className="mt-6 space-y-1 text-xs text-muted">
            <p>{data!.courses.method === 'semantic' ? t('rs.method') : t('rs.methodLex')}</p>
            {data!.courses.elatihMode === 'none' && <p>{t('rs.noElatih')}</p>}
          </div>
        </>
      )}
    </div>
  );
}
