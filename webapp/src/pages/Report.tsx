import { useMemo } from 'react';
import { useApp } from '../state/AppState';
import { Logo, Meter, NeedOrigin, PageHead, toneFor } from '../components/ui';
import { IDownload, IPrint } from '../components/Icons';
import { band, coursesFor, moatCards, riskCards } from '../lib/insight';
import { movesFor } from '../lib/ranking';
import { downloadFile } from '../lib/storage';
import { fmtRM, signed } from '../lib/format';
import { Key } from '../i18n';

export function Report() {
  const { data, t, sel, policy, weights, lang } = useApp();
  const i = sel.origin;
  const moves = useMemo(() => (i == null ? [] : movesFor(data!, i, policy, weights).slice(0, 5)), [data, i, policy, weights]);
  const dest = sel.dest ?? moves[0]?.j ?? null;
  const plan = useMemo(() => (i == null || dest == null ? [] : coursesFor(data!, i, dest, 5)), [data, i, dest]);
  if (i == null) {
    return (
      <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
        <PageHead title={t('rp.title')} />
        <NeedOrigin />
      </div>
    );
  }
  const o = data!.occ[i];
  const risk = riskCards(data!, i, 5);
  const moat = moatCards(data!, i, 3);
  const today = new Date().toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const polName = t(('pol.' + policy) as Key);

  const json = () => {
    const payload = {
      tool: 'CareerShield',
      version: '2.0.0',
      prepared: new Date().toISOString(),
      occupation: { onet_soc: o.soc, title: o.title, masco_major_group: o.isco1, job_zone: o.jz },
      exposure: { percentile: o.pctl, composite_z: o.exp, aioe: o.aioe, gpt_beta: o.gpt, lm_aioe: o.lm },
      market: { salary_rm_month: o.sal, salary_source: o.salObs ? 'JobStreet median' : 'model estimate', demand_percentile: o.dem, growth_tier: o.tier, moat_percentile: o.moat },
      risk_abilities: risk.map((a) => ({ ability: a.name, importance: +a.importance.toFixed(2), ability_exposure: a.exposure })),
      moat_abilities: moat.map((a) => ({ ability: a.name, importance: +a.importance.toFixed(2), ability_exposure: a.exposure })),
      policy,
      weights: policy === 'v1' ? weights : undefined,
      career_moves: moves.map((m, k) => ({
        rank: k + 1,
        onet_soc: data!.occ[m.j].soc,
        title: data!.occ[m.j].title,
        exposure_percentile: data!.occ[m.j].pctl,
        skill_similarity: +m.sim.toFixed(3),
        demand_percentile: data!.occ[m.j].dem,
        salary_rm_month: data!.occ[m.j].sal,
      })),
      reskilling: dest == null ? null : {
        destination: data!.occ[dest].title,
        gaps: plan.map((p) => ({ element: p.gap.element, current: +p.gap.from.toFixed(2), needed: +p.gap.to.toFixed(2), course: p.primary ? { name: p.primary.name, source: p.primary.source, url: p.primary.url } : null })),
      },
    };
    downloadFile(`careershield-${o.soc}.json`, JSON.stringify(payload, null, 2));
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="no-print">
        <PageHead title={t('rp.title')} lead={t('rp.lead')}>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => window.print()}>
              <IPrint size={16} /> {t('rp.print')}
            </button>
            <button className="btn-ghost" onClick={json}>
              <IDownload size={16} /> {t('rp.json')}
            </button>
          </div>
        </PageHead>
      </div>

      <article className="card space-y-8 p-6 sm:p-10" id="report">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div>
              <div className="font-display text-xl font-semibold">CareerShield</div>
              <div className="text-xs text-muted">{t('rp.generated', { d: today })}</div>
            </div>
          </div>
          <div className="text-xs text-muted sm:text-right">github.com/Moz700/CareerShield</div>
        </header>

        <section>
          <div className="eyebrow">{t('rp.summary')}</div>
          <h2 className="mt-1 font-display text-2xl font-semibold">{o.title}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-raised p-4 sm:col-span-1">
              <div className="text-xs text-muted">{t('res.exposure')}</div>
              <div className={`font-display text-4xl font-semibold num ${toneFor(o.pctl) === 'risk' ? 'text-risk' : toneFor(o.pctl) === 'warn' ? 'text-warn' : 'text-safe'}`}>{o.pctl == null ? t('shell.na') : Math.round(o.pctl)}</div>
              <div className="text-xs font-semibold">{t(('res.band.' + band(o.pctl)) as Key)}</div>
            </div>
            <div className="rounded-xl bg-raised p-4">
              <div className="text-xs text-muted">{t('res.salary')}</div>
              <div className="font-display text-2xl font-semibold num">{fmtRM(o.sal)}</div>
              <div className="text-[11px] text-muted">{o.salObs ? t('res.salaryObs', { n: o.rmN ?? 0 }) : t('res.salaryModel')}</div>
            </div>
            <div className="rounded-xl bg-raised p-4">
              <div className="text-xs text-muted">{t('res.demand')}</div>
              <div className="font-display text-2xl font-semibold num">{Math.round(o.dem)}/100</div>
            </div>
            <div className="rounded-xl bg-raised p-4">
              <div className="text-xs text-muted">{t('res.growth')}</div>
              <div className="font-display text-2xl font-semibold">{o.tier ? t(('res.tier.' + o.tier) as Key).split(':')[0] : t('shell.na')}</div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink/85">{t(('res.verdict.' + band(o.pctl)) as Key)}</p>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 font-semibold text-risk">{t('res.risk')}</h3>
            <ul className="space-y-2.5">
              {risk.map((a) => (
                <li key={a.name} className="text-sm">
                  <div className="flex justify-between">
                    <span>{a.name}</span>
                    <span className="num text-muted">{a.importance.toFixed(1)}/5</span>
                  </div>
                  <Meter value={a.importance} max={5} tone="risk" height={5} label={a.name} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 font-semibold text-safe">{t('res.moat')}</h3>
            {moat.length ? (
              <ul className="space-y-2.5">
                {moat.map((a) => (
                  <li key={a.name} className="text-sm">
                    <div className="flex justify-between">
                      <span>{a.name}</span>
                      <span className="num text-muted">{a.importance.toFixed(1)}/5</span>
                    </div>
                    <Meter value={a.importance} max={5} tone="safe" height={5} label={a.name} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t('res.noMoatTitle')}</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-3 font-semibold">{t('rp.moves', { p: polName })}</h3>
          <div className="overflow-x-auto">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('at.col.title')}</th>
                  <th>{t('mv.exposure')}</th>
                  <th>{t('mv.similarity')}</th>
                  <th>{t('mv.demand')}</th>
                  <th>{t('mv.salary')}</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m, k) => {
                  const d = data!.occ[m.j];
                  return (
                    <tr key={m.j}>
                      <td>{k + 1}</td>
                      <td className="font-semibold">{d.title}</td>
                      <td className="whitespace-nowrap">
                        {Math.round(d.pctl ?? 0)} <span className="text-xs text-muted">({signed((d.pctl ?? 0) - (o.pctl ?? 0), 0)})</span>
                      </td>
                      <td>{Math.round(Math.max(0, m.sim) * 100)}%</td>
                      <td>{Math.round(d.dem)}</td>
                      <td className="whitespace-nowrap">{fmtRM(d.sal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {dest != null && (
          <section>
            <h3 className="mb-3 font-semibold">{t('rp.plan', { d: data!.occ[dest].title })}</h3>
            <ol className="space-y-3">
              {plan.map((p, k) => (
                <li key={p.gap.j} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">
                      {k + 1}. {p.gap.element}
                    </span>
                    <span className="num text-xs text-muted">
                      {p.gap.from.toFixed(1)} {'→'} {p.gap.to.toFixed(1)}
                    </span>
                  </div>
                  {p.primary ? (
                    <div className="mt-1">
                      <a href={p.primary.url} target="_blank" rel="noreferrer" className="text-brand underline-offset-2 hover:underline">
                        {p.primary.name}
                      </a>{' '}
                      <span className="text-xs text-muted">({p.primary.source === 'elatih' ? 'e-LATiH' : 'Coursera'})</span>
                      <div className="print-only break-all text-[10px] text-muted">{p.primary.url}</div>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted">{t('rs.noCourse')}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="border-t border-line pt-5 text-xs leading-relaxed text-muted">
          <div className="mb-1 font-semibold text-ink">{t('rp.notes')}</div>
          <p>{t('rp.note1')}</p>
          <p className="mt-1">{t('rp.note2')}</p>
          <p className="mt-1">{t('rp.note3')}</p>
          <p className="mt-3">Billah, M. M., Paul, A., & Al-Obaydee, M. (in preparation). CareerShield: Measuring occupational exposure to generative artificial intelligence and advising career transitions in the Malaysian labour market. Sunway University, Malaysia. moztobamutashim@gmail.com</p>
        </section>
      </article>
    </div>
  );
}
