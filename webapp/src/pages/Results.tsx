import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { useApp } from '../state/AppState';
import { Gauge } from '../components/Gauge';
import { Badge, Meter, Reveal, toneFor } from '../components/ui';
import { IAlert, IArrow, IShield, ITrend } from '../components/Icons';
import { AbilityCard, band, moatCards, riskCards, skillGaps } from '../lib/insight';
import { movesFor } from '../lib/ranking';
import { fmtRM } from '../lib/format';
import { Key, ISCO_MS } from '../i18n';
import { pathKey } from '../components/Finder';

function AbilityTile({ a, kind, k }: { a: AbilityCard; kind: 'risk' | 'moat'; k: number }) {
  const { t } = useApp();
  const tone = kind === 'risk' ? 'risk' : 'safe';
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: k * 0.06 }}
      className={`rounded-xl border p-4 ${kind === 'risk' ? 'border-risk/20 bg-risk/5' : 'border-safe/20 bg-safe/5'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold leading-snug">{a.name}</div>
        <span className={`num shrink-0 text-xs font-bold ${kind === 'risk' ? 'text-risk' : 'text-safe'}`}>
          {a.exposure > 0 ? '+' : '−'}
          {Math.abs(a.exposure).toFixed(2)}
        </span>
      </div>
      <div className="mt-3">
        <Meter value={a.importance} max={5} tone={tone} height={6} label={t('res.importance')} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>
          {t('res.importance')} {a.importance.toFixed(1)}/5
        </span>
        <span>{t('res.abilityExp')}</span>
      </div>
    </motion.li>
  );
}

export function Results({ onChange }: { onChange?: () => void }) {
  const { data, t, lang, sel, policy, weights } = useApp();
  const i = sel.origin as number;
  const o = data!.occ[i];
  const risk = useMemo(() => riskCards(data!, i, 5), [data, i]);
  const moat = useMemo(() => moatCards(data!, i, 3), [data, i]);
  const moves = useMemo(() => movesFor(data!, i, policy, weights), [data, i, policy, weights]);
  const b = band(o.pctl);
  const first = moves[0];
  const reduction = first && o.pctl != null ? o.pctl - (data!.occ[first.j].pctl as number) : 0;
  const gaps = first ? skillGaps(data!, i, first.j, 3).map((g) => g.element) : [];
  const iscoName = o.isco1 != null ? (lang === 'ms' ? ISCO_MS[String(o.isco1)] : data!.meta.iscoNames[String(o.isco1)]) : null;
  const comps: [Key, Key, number | null, number][] = [
    ['res.idx.aioe', 'res.idx.aioeFull', o.aioe, data!.pctlRank.aioe[i]],
    ['res.idx.gpt', 'res.idx.gptFull', o.gpt, data!.pctlRank.gpt[i]],
    ['res.idx.lm', 'res.idx.lmFull', o.lm, data!.pctlRank.lm[i]],
  ];
  const demandBasis: Key = o.demMy != null ? 'res.demandMy' : o.demUs != null ? 'res.demandUs' : 'res.demandPrior';
  const bandTone = b === 'high' ? 'text-risk' : b === 'moderate' ? 'text-warn' : 'text-safe';

  return (
    <section className="mt-10 space-y-6" aria-labelledby="res-title">
      {/* header */}
      <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line bg-raised/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <div className="eyebrow">{t('res.matched')}</div>
            <h2 id="res-title" className="mt-1 font-display text-2xl font-semibold leading-tight sm:text-3xl">
              {o.title}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>O*NET {o.soc}</Badge>
              <Badge tone="brand">{iscoName ? `${t('res.masco')} ${o.isco1}: ${iscoName}` : t('res.notChained')}</Badge>
              <Badge>{t(pathKey(sel.path))}</Badge>
            </div>
          </div>
          {onChange && (
            <button className="btn-ghost shrink-0 no-print" onClick={onChange}>
              {t('an.change')}
            </button>
          )}
        </div>
        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="text-center">
            <Gauge value={o.pctl} label={t('res.exposure')} sub={`${t('res.exposure')} · ${t('res.percentile')}`} />
            <div className={`mt-3 font-semibold ${bandTone}`}>{t(('res.band.' + b) as Key)}</div>
            {o.pctl != null && <p className="mt-1 text-sm text-muted">{t('res.of894', { n: Math.round(o.pctl) })}</p>}
          </div>
          <div className="flex flex-col justify-between gap-6">
            <p className="font-display text-xl leading-snug sm:text-2xl">{t(('res.verdict.' + b) as Key)}</p>
            <div>
              <div className="mb-1 text-sm font-semibold">{t('res.components')}</div>
              <p className="mb-4 text-xs text-muted">{t('res.componentsLead')}</p>
              <div className="space-y-4">
                {comps.map(([k, full, raw, pr]) => (
                  <div key={k}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span>
                        <b>{t(k)}</b> <span className="hidden text-xs text-muted sm:inline">{t(full)}</span>
                      </span>
                      <span className="num text-xs text-muted">{raw == null ? t('res.idx.missing') : `${raw.toFixed(2)} · ${t('res.percentile')} ${Math.round(pr)}`}</span>
                    </div>
                    {raw != null ? <Meter value={pr} tone={toneFor(pr) === 'muted' ? 'brand' : (toneFor(pr) as 'risk')} label={t(k)} /> : <div className="h-2 rounded-full bg-line/50" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* risk and moat */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal className="card p-5 sm:p-7">
          <div className="flex items-center gap-2 text-risk">
            <IAlert />
            <h3 className="font-display text-xl font-semibold text-ink">{t('res.risk')}</h3>
          </div>
          <p className="mb-4 mt-1 text-sm text-muted">{t('res.riskLead')}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {risk.map((a, k) => (
              <AbilityTile key={a.name} a={a} kind="risk" k={k} />
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">{t('res.abilityNote')}</p>
        </Reveal>
        <Reveal delay={0.08} className="card p-5 sm:p-7">
          <div className="flex items-center gap-2 text-safe">
            <IShield />
            <h3 className="font-display text-xl font-semibold text-ink">{t('res.moat')}</h3>
          </div>
          <p className="mb-4 mt-1 text-sm text-muted">{t('res.moatLead')}</p>
          {moat.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {moat.map((a, k) => (
                <AbilityTile key={a.name} a={a} kind="moat" k={k} />
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border-l-4 border-safe bg-safe/5 p-4">
              <div className="font-semibold text-safe">{t('res.noMoatTitle')}</div>
              <p className="mt-1 text-sm leading-relaxed text-ink/80">{t('res.noMoat')}</p>
            </div>
          )}
          {o.moat != null && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold">{t('res.moatStrength')}</span>
                <span className="num font-bold">{Math.round(o.moat)}/100</span>
              </div>
              <Meter value={o.moat} tone="safe" label={t('res.moatStrength')} />
              <p className="mt-2 text-xs leading-relaxed text-muted">{t('res.moatNote')}</p>
            </div>
          )}
        </Reveal>
      </div>

      {/* market */}
      <Reveal className="card p-5 sm:p-7">
        <h3 className="font-display text-xl font-semibold">{t('res.market')}</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-raised p-4">
            <div className="eyebrow">{t('res.salary')}</div>
            <div className="mt-2 font-display text-3xl font-semibold num">{fmtRM(o.sal)}</div>
            <div className="mt-1 text-xs text-muted">{o.salObs ? t('res.salaryObs', { n: o.rmN ?? 0 }) : t('res.salaryModel')}</div>
          </div>
          <div className="rounded-xl bg-raised p-4">
            <div className="eyebrow">{t('res.demand')}</div>
            <div className="mt-2 font-display text-3xl font-semibold num">
              {Math.round(o.dem)}
              <span className="text-base text-muted">/100</span>
            </div>
            <div className="mt-1 text-xs text-muted">{t(demandBasis)}</div>
          </div>
          <div className="rounded-xl bg-raised p-4">
            <div className="eyebrow">{t('res.growth')}</div>
            <div className={`mt-2 font-display text-3xl font-semibold ${o.tier === 'Leading' ? 'text-safe' : o.tier === 'Lagging' ? 'text-risk' : 'text-warn'}`}>
              {o.tier ? t(('res.tier.' + o.tier) as Key).split(':')[0] : t('shell.na')}
            </div>
            <div className="mt-1 text-xs text-muted">{o.tier ? t(('res.tier.' + o.tier) as Key).split(':')[1] : ''}</div>
          </div>
          <div className="rounded-xl bg-raised p-4">
            <div className="eyebrow">{t('res.jobZone')}</div>
            <div className="mt-2 font-display text-3xl font-semibold num">
              {o.jz}
              <span className="text-base text-muted">/5</span>
            </div>
            <div className="mt-1 text-xs text-muted">{t('res.jobZoneNote')}</div>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">{t('res.tierNote')}</p>
      </Reveal>

      {/* advice */}
      {first && (
        <Reveal>
          <div className={`rounded-2xl border p-5 sm:p-7 ${reduction >= 15 ? 'border-brand/30 bg-brand/5' : 'border-warn/30 bg-warn/5'}`}>
            <div className={`flex items-center gap-2 ${reduction >= 15 ? 'text-brand' : 'text-warn'}`}>
              <ITrend />
              <h3 className="font-display text-xl font-semibold">{reduction >= 15 ? t('res.adviceTitlePivot') : t('res.adviceTitleDefend')}</h3>
            </div>
            <p className="mt-2 max-w-3xl leading-relaxed text-ink/85">
              {reduction >= 15
                ? t('res.advicePivot', { dest: data!.occ[first.j].title, n: Math.round(reduction), gaps: gaps.join(', ') || '…' })
                : t('res.adviceDefend')}
            </p>
            <div className="mt-5 flex flex-wrap gap-3 no-print">
              <Link to="/moves" className="btn-primary">
                {t('res.seeMoves')} <IArrow />
              </Link>
              <Link to="/reskill" className="btn-ghost">
                {t('res.seePlan')}
              </Link>
              <Link to="/report" className="btn-ghost">
                {t('res.seeReport')}
              </Link>
            </div>
          </div>
        </Reveal>
      )}
    </section>
  );
}
