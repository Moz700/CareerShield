import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, m as motion } from 'framer-motion';
import { useApp, Policy } from '../state/AppState';
import { Badge, Meter, NeedOrigin, PageHead, Reveal, Segmented, toneFor } from '../components/ui';
import { IArrow, ICheck, IAlert } from '../components/Icons';
import { Scatter } from '../components/charts';
import { candidateSet, movesFor, normaliseWeights, PolicyKey, Ranked, rankV1, topThree, W_V1, Weights } from '../lib/ranking';
import { skillGaps } from '../lib/insight';
import { fmtRM, signed } from '../lib/format';
import { Key } from '../i18n';

function WeightPanel() {
  const { t, weights, setWeights } = useApp();
  const nw = normaliseWeights(weights);
  const keys: Key[] = ['mv.w0', 'mv.w1', 'mv.w2', 'mv.w3'];
  return (
    <div className="card p-5">
      <h3 className="font-semibold">{t('mv.weights')}</h3>
      <p className="mb-4 mt-1 text-xs text-muted">{t('mv.weightsLead')}</p>
      <div className="space-y-4">
        {keys.map((k, idx) => (
          <div key={k}>
            <div className="mb-1.5 flex justify-between text-sm">
              <label htmlFor={`w${idx}`}>{t(k)}</label>
              <span className="num font-semibold">{nw[idx].toFixed(2)}</span>
            </div>
            <input
              id={`w${idx}`}
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(weights[idx] * 100)}
              className="slider"
              style={{ ['--fill' as string]: `${weights[idx] * 100}%` }}
              onChange={(e) => {
                const w = [...weights] as Weights;
                w[idx] = Number(e.target.value) / 100;
                if (w.reduce((a, z) => a + z, 0) === 0) w[idx] = 0.01;
                setWeights(w);
              }}
            />
          </div>
        ))}
      </div>
      <button className="btn-ghost mt-5 w-full" onClick={() => setWeights(W_V1)}>
        {t('mv.reset')}
      </button>
    </div>
  );
}

function MoveCard({ r, rank, origin, policy }: { r: Ranked; rank: number; origin: number; policy: PolicyKey }) {
  const { data, t, selectDest, selectOrigin } = useApp();
  const nav = useNavigate();
  const o = data!.occ[origin];
  const d = data!.occ[r.j];
  const gaps = useMemo(() => skillGaps(data!, origin, r.j, 3), [data, origin, r.j]);
  const delta = (d.pctl ?? 0) - (o.pctl ?? 0);
  const retained = o.sal && d.sal ? Math.round((d.sal / o.sal) * 100) : null;
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} className="card p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="font-display text-4xl font-semibold leading-none text-muted/40 num">{String(rank).padStart(2, '0')}</div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">{t('mv.option', { n: rank })}</div>
          <h3 className="mt-1 font-display text-xl font-semibold leading-snug">{d.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={d.inflow[policy] > 8 ? 'warn' : 'muted'}>{d.inflow[policy] > 0 ? t('mv.inflow', { n: d.inflow[policy] }) : t('mv.inflowZero')}</Badge>
            {d.evid && !d.dec ? (
              <Badge tone="safe">
                <ICheck size={12} /> {t('mv.guardOk')}
              </Badge>
            ) : (
              <>
                {!d.evid && (
                  <Badge tone="warn">
                    <IAlert size={12} /> {t('mv.guardNoPost')}
                  </Badge>
                )}
                {d.dec && (
                  <Badge tone="warn">
                    <IAlert size={12} /> {t('mv.guardDecl')}
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <div className="text-xs text-muted">{t('mv.exposure')}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold num">{Math.round(d.pctl ?? 0)}</span>
            <span className={`num text-sm font-bold ${delta < 0 ? 'text-safe' : delta > 0 ? 'text-risk' : 'text-muted'}`}>{signed(delta, 0)}</span>
          </div>
          <div className="mt-1.5">
            <Meter value={d.pctl ?? 0} tone={toneFor(d.pctl) as 'risk'} height={5} label={t('mv.exposure')} />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">{t('mv.similarity')}</div>
          <div className="mt-1 font-display text-2xl font-semibold num">{Math.round(Math.max(0, r.sim) * 100)}%</div>
          <div className="mt-1.5">
            <Meter value={Math.max(0, r.sim) * 100} height={5} label={t('mv.similarity')} />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">{t('mv.demand')}</div>
          <div className="mt-1 font-display text-2xl font-semibold num">{Math.round(d.dem)}</div>
          <div className="mt-1.5">
            <Meter value={d.dem} tone="muted" height={5} label={t('mv.demand')} />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">{t('mv.salary')}</div>
          <div className="mt-1 font-display text-2xl font-semibold num">
            {fmtRM(d.sal)}
            {!d.salObs && <span className="ml-1 align-middle text-[10px] font-sans font-semibold uppercase text-muted">{t('mv.estimate')}</span>}
          </div>
          {retained != null && <div className="mt-1 text-xs text-muted">{t('mv.retained', { n: retained })}</div>}
        </div>
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 text-xs font-semibold text-muted">{t('mv.gaps')}</div>
        {gaps.length ? (
          <div className="flex flex-wrap gap-2">
            {gaps.map((g) => (
              <span key={g.element} className="chip">
                {g.element}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{t('mv.noGaps')}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={() => {
              selectDest(r.j);
              nav('/reskill');
            }}
          >
            {t('mv.plan')} <IArrow />
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              selectOrigin(r.j, 'manual');
              nav('/analyse');
            }}
          >
            {t('mv.analyse')}
          </button>
        </div>
      </div>
    </motion.li>
  );
}

const COLS: PolicyKey[] = ['CONV', 'v1', 'v2'];
const COL_NAME: Record<PolicyKey, Key> = { CONV: 'pol.CONV', v1: 'pol.v1', v2: 'pol.v2' };

/** Top three under each policy, with how often each destination is a first choice across the plan. */
function Compare({ origin, onPick }: { origin: number; onPick: (p: PolicyKey) => void }) {
  const { data, t } = useApp();
  const b = data!;
  const o = b.occ[origin];
  const lists = useMemo(() => topThree(b, origin), [b, origin]);
  const count = new Map<string, number>();
  COLS.forEach((k) => lists[k].forEach((j) => count.set(b.occ[j].soc6, (count.get(b.occ[j].soc6) ?? 0) + 1)));
  const crowded = lists.v1.map((j) => b.occ[j]).find((d) => d.inflow.v1 > 8);
  const same = lists.v1.join() === lists.v2.join() && lists.v1.length > 0;
  return (
    <section className="card mb-8 p-5 sm:p-7" aria-labelledby="cmp-title">
      <h2 id="cmp-title" className="font-display text-2xl font-semibold tracking-tight">{t('mv.compareTitle')}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{t('mv.compareLead', { occ: o.title })}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {COLS.map((k, c) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * c, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col rounded-2xl border border-line bg-raised/60 p-4"
          >
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${k === 'CONV' ? 'bg-pol-conv' : k === 'v1' ? 'bg-pol-v1' : 'bg-pol-v2'}`} aria-hidden="true" />
              <h3 className="font-semibold">{t(COL_NAME[k])}</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted">{t(('mv.col' + k) as Key)}</p>
            {lists[k].length === 0 ? (
              <p className="mt-4 text-sm text-muted">{t('mv.none')}</p>
            ) : (
              <ol className="mt-3 flex-1 space-y-2.5">
                {lists[k].map((j, r) => {
                  const d = b.occ[j];
                  const delta = (d.pctl ?? 0) - (o.pctl ?? 0);
                  const n = d.inflow[k];
                  const shared = count.get(d.soc6) ?? 1;
                  return (
                    <li key={j} className="rounded-xl border border-line bg-surface p-3">
                      <div className="flex items-start gap-2.5">
                        <span className="num mt-0.5 text-xs font-bold text-muted">{r + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold leading-snug">{d.title}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <span className="num">
                              {t('mv.exposure')} {Math.round(d.pctl ?? 0)}{' '}
                              <span className={`font-bold ${delta < 0 ? 'text-safe' : delta > 0 ? 'text-risk' : ''}`}>{signed(delta, 0)}</span>
                            </span>
                            {shared > 1 && <span className="rounded-full bg-line/60 px-1.5 py-px text-[10px] font-semibold">{t('mv.overlap', { n: shared })}</span>}
                          </div>
                          <div className="mt-2">
                            <div className="mb-1 text-[11px] text-muted num">{n > 0 ? t('mv.inflow', { n }) : t('mv.inflowZero')}</div>
                            <Meter value={n} max={45} tone={k} height={4} label={t('mv.inflow', { n })} />
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <button className="btn-ghost mt-3 w-full justify-center text-sm" onClick={() => onPick(k)}>
              {t('mv.detail')} <IArrow size={14} />
            </button>
          </motion.div>
        ))}
      </div>
      {crowded && (
        <p className="mt-5 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm">
          <IAlert size={16} className="mt-0.5 shrink-0 text-warn" />
          <span>{t('mv.crowd', { dest: crowded.title, n: crowded.inflow.v1 })}</span>
        </p>
      )}
      {same && <p className="mt-5 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">{t('mv.same')}</p>}
    </section>
  );
}

export function Moves() {
  const { data, t, sel, policy, setPolicy, weights } = useApp();
  const [more, setMore] = useState(false);
  const [why, setWhy] = useState(false);
  const i = sel.origin;
  const moves = useMemo(() => (i == null ? [] : movesFor(data!, i, policy, weights)), [data, i, policy, weights]);
  const all = useMemo(() => (i == null ? [] : rankV1(data!, i)), [data, i]);
  if (i == null) {
    return (
      <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
        <PageHead title={t('mv.title')} />
        <NeedOrigin />
      </div>
    );
  }
  const o = data!.occ[i];
  const shown = moves.slice(0, more ? 8 : 5);
  const top10 = data!.evidence.headline.top10;
  const highlight = new Map(shown.map((r, k) => [r.j, k + 1]));
  const pick = (p: PolicyKey) => {
    setPolicy(p);
    setMore(false);
    requestAnimationFrame(() => document.getElementById('detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <PageHead title={t('mv.title')} lead={t('mv.lead', { occ: o.title })} />

      <Compare origin={i} onPick={pick} />

      <div className="card mb-10 overflow-hidden">
        <button className="flex w-full items-center justify-between gap-3 p-5 text-left" aria-expanded={why} aria-controls="why-body" onClick={() => setWhy((w) => !w)}>
          <span className="font-display text-lg font-semibold">{t('mv.whyTitle')}</span>
          <motion.span animate={{ rotate: why ? 90 : 0 }} className="text-muted">
            <IArrow />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {why && (
            <motion.div id="why-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid gap-6 px-5 pb-6 md:grid-cols-[1.6fr_1fr]">
                <p className="text-sm leading-relaxed text-muted">{t('mv.why')}</p>
                <div className="space-y-3">
                  {(['CONV', 'v1', 'v2'] as const).map((k) => (
                    <div key={k}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-semibold">{t(('pol.' + k) as Key)}</span>
                        <span className="num font-bold">{top10[k].toFixed(1)}%</span>
                      </div>
                      <Meter value={top10[k]} max={30} tone={k} height={7} label={t(('pol.' + k) as Key)} />
                    </div>
                  ))}
                  <p className="text-[11px] text-muted">{t('home.v2Bar')}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div id="detail" className="mb-5 flex scroll-mt-24 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{t('mv.detail')}</h2>
        <Segmented<Policy>
          label={t('mv.policy')}
          value={policy}
          onChange={(p) => {
            setPolicy(p);
            setMore(false);
          }}
          options={[
            { value: 'v2', label: t('mv.v2') },
            { value: 'v1', label: t('mv.v1') },
            { value: 'CONV', label: t('mv.convLabel') },
          ]}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          {policy === 'v2' && moves.length > 0 && (
            <p className="mb-4 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
              {o.v2kind === 'residual' ? t('mv.residual') : t('mv.planned')} {t('mv.altNote')}
            </p>
          )}
          {policy === 'CONV' && moves.length > 0 && <p className="mb-4 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">{t('mv.convNote')}</p>}
          {moves.length === 0 ? (
            <p className="card p-6 text-muted">{t('mv.none')}</p>
          ) : (
            <LayoutGroup>
              <ul className="space-y-4">
                <AnimatePresence initial={false}>
                  {shown.map((r, k) => (
                    <MoveCard key={r.j} r={r} rank={k + 1} origin={i} policy={policy} />
                  ))}
                </AnimatePresence>
              </ul>
            </LayoutGroup>
          )}
          {moves.length > 5 && (
            <button className="btn-ghost mt-5" onClick={() => setMore((m) => !m)}>
              {more ? t('mv.showLess') : t('mv.showMore')}
            </button>
          )}
        </div>
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {policy === 'v1' && <WeightPanel />}
          {all.length > 0 && (
            <Reveal className="card p-5">
              <h3 className="font-semibold">{t('mv.map')}</h3>
              <p className="mb-2 mt-1 text-xs text-muted">{t('mv.mapLead')}</p>
              <Scatter
                ariaLabel={t('mv.map')}
                height={300}
                points={candidateSet(data!, i).cands.map((c) => ({
                  i: c.j,
                  x: c.sim,
                  y: data!.occ[c.j].pctl ?? 0,
                  color: highlight.has(c.j) ? `rgb(var(--pol-${policy === 'CONV' ? 'conv' : policy}))` : 'rgb(var(--muted))',
                  r: highlight.has(c.j) ? 6 : 3,
                  ring: highlight.has(c.j),
                  label: highlight.has(c.j) ? String(highlight.get(c.j)) : undefined,
                }))}
                xDomain={[Math.min(0, ...all.map((c) => c.sim)) - 0.02, 1]}
                yDomain={[Math.max(0, Math.floor((Math.min(...all.map((c) => data!.occ[c.j].pctl ?? 0), o.pctl ?? 100) - 8) / 10) * 10), 100]}
                xTicks={[0, 0.25, 0.5, 0.75, 1]}
                yTicks={[0, 20, 40, 60, 80, 100]}
                xLabel={t('mv.mapX')}
                yLabel={t('mv.mapY')}
                hline={o.pctl != null ? { y: o.pctl, label: t('mv.current') } : undefined}
                tooltip={(j) => (
                  <div>
                    <div className="font-semibold">{data!.occ[j].title}</div>
                    <div className="text-muted num">
                      {t('mv.exposure')} {Math.round(data!.occ[j].pctl ?? 0)}
                    </div>
                  </div>
                )}
              />
            </Reveal>
          )}
        </aside>
      </div>
    </div>
  );
}
