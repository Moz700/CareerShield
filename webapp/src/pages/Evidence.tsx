import { useMemo, useState } from 'react';
import { m as motion } from 'framer-motion';
import { useApp } from '../state/AppState';
import { PageHead, Reveal, SectionHead, Segmented, useCopy } from '../components/ui';
import { CapacityChart, ConcentrationChart, ForestPlot, POLICY_COLORS } from '../components/charts';
import { IGithub, IMail } from '../components/Icons';
import { REPO, EMAIL, BIB_PAPER, BIB_SOFTWARE } from '../config';
import { Key } from '../i18n';
import { PolicyRow } from '../lib/data';

const T3: [keyof PolicyRow, Key, number][] = [
  ['exp', 'ev.col.exp', 1],
  ['dem', 'ev.col.dem', 1],
  ['sim', 'ev.col.sim', 3],
  ['ms', 'ev.col.ms', 1],
  ['emp', 'ev.col.emp', 1],
  ['wage', 'ev.col.wage', 1],
];
const T4: [keyof PolicyRow, Key, number][] = [
  ['distinct', 'ev.col.distinct', 0],
  ['top10', 'ev.col.top10', 1],
  ['maxN', 'ev.col.maxN', 0],
  ['top10w', 'ev.col.top10w', 1],
  ['noPost', 'ev.col.noPost', 1],
  ['declined', 'ev.col.declined', 1],
];

function PolicyTable({ cols, caption }: { cols: [keyof PolicyRow, Key, number][]; caption: string }) {
  const { data, t } = useApp();
  const [sort, setSort] = useState<[keyof PolicyRow | null, number]>([null, 1]);
  const rows = useMemo(() => {
    const r = [...data!.evidence.policies];
    if (sort[0]) r.sort((a, b) => ((a[sort[0]!] as number) - (b[sort[0]!] as number)) * sort[1]);
    return r;
  }, [data, sort]);
  return (
    <div className="overflow-x-auto">
      <table className="data w-full min-w-[640px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th>{t('ev.col.policy')}</th>
            {cols.map(([k, lab]) => (
              <th key={k} aria-sort={sort[0] === k ? (sort[1] > 0 ? 'ascending' : 'descending') : 'none'} className="!whitespace-normal">
                <button className="text-left font-semibold uppercase hover:text-ink" onClick={() => setSort(([sk, d]) => [k, sk === k ? -d : 1])}>
                  {t(lab)} {sort[0] === k ? (sort[1] > 0 ? '▲' : '▼') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const hl = r.policy === 'v1' || r.policy === 'v2';
            return (
              <tr key={r.policy} className={hl ? 'bg-raised font-semibold' : ''}>
                <td className="whitespace-nowrap">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: POLICY_COLORS[r.policy] }} />
                  {t(('pol.' + r.policy) as Key)}
                </td>
                {cols.map(([k, , d]) => (
                  <td key={k}>{(r[k] as number).toFixed(d)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-1 pt-2 text-xs text-muted sm:hidden">{t('ev.swipe')}</p>
    </div>
  );
}

function Triangle() {
  const { data, t } = useApp();
  const c = data!.evidence.capstone;
  const P = { a: [150, 26], g: [40, 196], l: [260, 196] } as const;
  const edges: [keyof typeof P, keyof typeof P, number][] = [
    ['a', 'l', c.spearman.aioe_lm],
    ['a', 'g', c.spearman.aioe_gpt],
    ['g', 'l', c.spearman.gpt_lm],
  ];
  const names = { a: 'AIOE', g: 'GPT', l: 'LM-AIOE' };
  return (
    <svg viewBox="0 0 300 252" className="mx-auto w-full max-w-[320px]" role="img" aria-label={t('ev.corr')}>
      {edges.map(([u, v, r], k) => (
        <g key={u + v}>
          <motion.line
            x1={P[u][0]}
            y1={P[u][1]}
            x2={P[v][0]}
            y2={P[v][1]}
            stroke="rgb(var(--brand))"
            strokeWidth={2 + (r - 0.8) * 30}
            strokeOpacity={0.35 + (r - 0.8)}
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: k * 0.2 }}
          />
          <text x={(P[u][0] + P[v][0]) / 2 + (u === 'g' ? 0 : u === 'a' && v === 'g' ? -24 : 24)} y={(P[u][1] + P[v][1]) / 2 + (u === 'g' ? 20 : 0)} textAnchor="middle" className="fill-ink text-[15px] font-bold num">
            {r.toFixed(3).replace(/^0/, '')}
          </text>
        </g>
      ))}
      {(Object.keys(P) as (keyof typeof P)[]).map((k) => (
        <g key={k}>
          <circle cx={P[k][0]} cy={P[k][1]} r={20} fill="rgb(var(--surface))" stroke="rgb(var(--brand))" strokeWidth={2.5} />
          <text x={P[k][0]} y={P[k][1] + (k === 'a' ? -28 : 36)} textAnchor="middle" className="fill-ink text-[12px] font-semibold">
            {names[k]}
          </text>
        </g>
      ))}
    </svg>
  );
}

const SOURCES: [string, string, string, string][] = [
  ['O*NET 30.3 database', 'National Center for O*NET Development (2026)', 'Occupations, skills, abilities, knowledge, titles, tasks, related occupations', 'CC BY 4.0'],
  ['AI Occupational Exposure (AIOE)', 'Felten, Raj & Seamans (2021)', 'Exposure index; ability-level exposure (Appendix E) for the ability cards', 'Published research data, cited'],
  ['Language-model AIOE', 'Felten, Raj & Seamans (2023)', 'Exposure index', 'Published research data, cited'],
  ['GPT task exposure', 'Eloundou et al. (2024)', 'Exposure index', 'Published research data, cited'],
  ['SOC and ISCO-08 crosswalks; OEWS national files', 'U.S. Bureau of Labor Statistics', 'Transfer to MASCO; employment and wage outcomes; v2 trajectory guard', 'Public domain'],
  ['MASCO 2020', 'Ministry of Human Resources Malaysia', 'Malaysian occupational major groups', 'Official classification, cited'],
  ['Salaries & Wages Survey 2024', 'Department of Statistics Malaysia', 'Capstone validation only; not used by the app', 'Open government data, cited'],
  ['JobStreet job postings', 'Mohamad (2025), Kaggle', 'Malaysian demand and salary medians', 'Dataset licence; not redistributed'],
  ['LinkedIn job postings 2023 to 2024', 'arshkon (2024), Kaggle', 'Demand fallback where Malaysian postings are absent', 'Dataset licence; not redistributed'],
  ['AI applicability scores', 'Tomlinson et al. (2025)', 'Observed AI applicability (evaluation only)', 'CC BY 4.0'],
  ['e-LATiH course catalogue', 'HRD Corp; compiled by the research team', 'Malaysian course matching (local builds)', 'Not redistributed; left out of the online edition'],
  ['Coursera course listing', 'Coursera, public course metadata', 'Global course matching', 'Links to coursera.org'],
  ['paraphrase-multilingual-MiniLM-L12-v2', 'Reimers & Gurevych, sentence-transformers', 'Course matching at build time', 'Apache 2.0'],
];

function Bib({ text }: { text: string }) {
  const { t } = useApp();
  const [ok, copy] = useCopy();
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-line bg-raised p-4 text-[12px] leading-relaxed">
        <code>{text}</code>
      </pre>
      <button className="btn-ghost absolute right-2 top-2 px-3 py-1 text-xs" onClick={() => copy(text)}>
        {ok ? t('ev.copied') : t('ev.copy')}
      </button>
    </div>
  );
}

export function Evidence() {
  const { data, t } = useApp();
  const ev = data!.evidence;
  const h = ev.headline;
  const c = ev.capstone;
  const [out, setOut] = useState<'ms' | 'exp' | 'emp_post' | 'wage_post'>('ms');
  const polLabels = Object.fromEntries(['CONV', 'SIM', 'v1-BLIND', 'v1', 'v1+guards', 'v2-BLIND', 'v2'].map((k) => [k, t(('pol.' + k) as Key)]));
  const nMalay = data!.meta.nMalayTitles;
  const stat = (big: string, small: string, sub?: string) => (
    <div className="card p-5">
      <div className="font-display text-[1.7rem] font-semibold leading-tight num xl:text-[2rem]">{big}</div>
      {sub && <div className="mt-1 text-xs text-muted num">{sub}</div>}
      <div className="mt-2 text-sm text-muted">{small}</div>
    </div>
  );
  const crit: [Key, number, number, string?][] = [
    ['ev.payUs', c.payLevel.us, c.payLevel.usN],
    ['ev.payMy', c.payLevel.my, c.payLevel.myN],
    ['ev.growUs', c.wageGrowth.us, c.wageGrowth.usN],
    ['ev.demUs', c.demand.us, c.demand.usN],
    ['ev.demMy', c.demand.my, c.demand.myN],
  ];
  const fam = ['Verbal', 'Cognitive', 'Sensory', 'Psychomotor', 'Physical'];
  const dsr: [Key, Key][] = [
    ['ev.dsr1t', 'ev.dsr1'],
    ['ev.dsr2t', 'ev.dsr2'],
    ['ev.dsr3t', 'ev.dsr3'],
    ['ev.dsr4t', 'ev.dsr4'],
    ['ev.dsr5t', 'ev.dsr5'],
    ['ev.dsr6t', 'ev.dsr6'],
  ];
  const fmtCI = (v: number[]) => `${v[0].toFixed(1)} (${v[1].toFixed(1)} to ${v[2].toFixed(1)})`;
  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <PageHead title={t('ev.title')} lead={t('ev.lead')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat(`${h.v1VsConv[0].toFixed(1)} (${h.relChangeV1}%)`, t('ev.h1'), `95% CI ${h.v1VsConv[1].toFixed(1)} to ${h.v1VsConv[2].toFixed(1)}`)}
        {stat(`${h.shareKept}%`, t('ev.h2'), `v2 ${fmtCI(h.v2VsConv)}`)}
        {stat(`${h.top10.CONV} · ${h.top10.v1} · ${h.top10.v2}%`, t('ev.h3'), `k = ${h.capK}`)}
        {stat(`${h.empV1VsConv[0] > 0 ? '+' : ''}${h.empV1VsConv[0].toFixed(1)}`, t('ev.h4'), `95% CI ${h.empV1VsConv[1].toFixed(1)} to ${h.empV1VsConv[2].toFixed(1)}`)}
      </div>

      {/* validity */}
      <section className="mt-20">
        <SectionHead title={t('ev.validTitle')} lead={t('ev.validLead')} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Reveal className="card p-6">
            <h3 className="font-semibold">{t('ev.corr')}</h3>
            <Triangle />
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-sm text-muted">{t('ev.alpha')}</span>
              <span className="font-display text-3xl font-semibold num">{String(c.alpha).replace(/^0/, '')}</span>
            </div>
            <p className="mt-2 text-xs text-muted">{t('ev.loo')}</p>
          </Reveal>
          <Reveal delay={0.06} className="card p-6">
            <h3 className="font-semibold">{t('ev.construct')}</h3>
            <div className="mt-5 space-y-3">
              {fam.map((f, k) => {
                const v = c.construct[f] as number;
                return (
                  <div key={f} className="grid grid-cols-[88px_1fr_48px] items-center gap-2 text-sm">
                    <span className="text-muted">{f}</span>
                    <div className="relative h-3 rounded-full bg-line/50">
                      <div className="absolute left-1/2 top-[-3px] h-[18px] w-px bg-muted" />
                      <motion.div
                        className={`absolute top-0 h-3 rounded-full ${v > 0 ? 'bg-brand' : 'bg-risk'}`}
                        style={{ width: `${Math.abs(v) * 50}%`, ...(v > 0 ? { left: '50%', originX: 0 } : { right: '50%', originX: 1 }) }}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: k * 0.08 }}
                      />
                    </div>
                    <span className="text-right font-semibold num">{v > 0 ? '+' : '−'}{Math.abs(v).toFixed(3).replace(/^0/, '')}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted">{t('ev.constructNote')}</p>
            <div className="mt-5 border-t border-line pt-4">
              <h4 className="text-sm font-semibold">{t('ev.transfer')}</h4>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-display text-3xl font-semibold num">662/889</span>
                <span className="text-sm text-muted num">74.5%</span>
              </div>
              <p className="mt-1 text-xs text-muted">{t('ev.transferBody')}</p>
            </div>
          </Reveal>
          <Reveal delay={0.12} className="card p-6">
            <h3 className="font-semibold">{t('ev.criterion')}</h3>
            <ul className="mt-4 divide-y divide-line">
              {crit.map(([k, r, n, note]) => (
                <li key={k} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{t(k)}</span>
                    <span className={`num font-semibold ${note ? 'text-muted' : ''}`}>
                      ρ {r > 0 ? '+' : '−'}
                      {Math.abs(r).toFixed(3).replace(/^0/, '')} <span className="text-xs font-normal text-muted">n = {n}</span>
                    </span>
                  </div>
                  {note && <p className="mt-1 text-xs text-warn">{note}</p>}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* tables */}
      <section className="mt-20 space-y-8">
        <Reveal className="card p-5 sm:p-7">
          <SectionHead title={t('ev.t3Title')} lead={t('ev.t3Lead')} />
          <PolicyTable cols={T3} caption={t('ev.t3Title')} />
          <p className="mt-3 text-xs text-muted">{t('ev.t3Note')}</p>
        </Reveal>
        <Reveal className="card p-5 sm:p-7">
          <SectionHead title={t('ev.t4Title')} lead={t('ev.t4Lead')} />
          <PolicyTable cols={T4} caption={t('ev.t4Title')} />
          <p className="mt-3 text-xs text-muted">
            {polLabels['v1']}: {h.topDest.title}, {h.topDest.n_origins} origins; US employment {h.topDest.emp_2015.toLocaleString('en-US')} (2015), {h.topDest.emp_2019.toLocaleString('en-US')} (2019),{' '}
            {h.topDest.emp_2024.toLocaleString('en-US')} (2024).
          </p>
        </Reveal>
      </section>

      {/* charts */}
      <section className="mt-20 grid gap-8 lg:grid-cols-2">
        <Reveal className="card p-5 sm:p-7 lg:col-span-2">
          <SectionHead title={t('ev.curveTitle')} lead={t('ev.curveLead')} />
          <ConcentrationChart curves={ev.curves} labels={polLabels} xLabel={t('ev.curveX')} yLabel={t('ev.curveY')} tenLabel={t('ev.tenDest')} topLabel={t('ev.top')} />
        </Reveal>
        <Reveal className="card p-5 sm:p-7">
          <SectionHead title={t('ev.forestTitle')} lead={t('ev.forestLead')} />
          <div className="mb-4 overflow-x-auto">
            <Segmented
              size="sm"
              label={t('ev.forestTitle')}
              value={out}
              onChange={setOut}
              options={(['ms', 'exp', 'emp_post', 'wage_post'] as const).map((k) => ({ value: k, label: t(('ev.out.' + k) as Key).split(' 2022')[0] }))}
            />
          </div>
          <ForestPlot rows={ev.forest[out]} labels={polLabels} unit={t(('ev.out.' + out) as Key)} />
        </Reveal>
        <Reveal className="card p-5 sm:p-7">
          <SectionHead title={t('ev.capTitle')} lead={t('ev.capLead')} />
          <CapacityChart pts={ev.capacity} v1={{ top10: h.top10.v1, red: -h.v1VsConv[0] }} xLabel={t('ev.capX')} yLabel={t('ev.capY')} hover={(k, s, r) => t('ev.capHover', { k, s: s.toFixed(1), r: r.toFixed(2) })} />
        </Reveal>
      </section>

      {/* method */}
      <section className="mt-20">
        <SectionHead title={t('ev.methodTitle')} lead={t('ev.methodLead')} />
        <div className="relative">
          <ol className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {dsr.map(([a, b], k) => (
              <Reveal as="li" key={a} delay={k * 0.07} className={`card h-full p-4 ${k === 2 || k === 4 ? 'border-brand/50 bg-brand/5' : ''}`}>
                <div className="text-xs font-bold tracking-widest text-warn num">0{k + 1}</div>
                <div className="mt-1 font-display text-lg font-semibold">{t(a)}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t(b)}</p>
              </Reveal>
            ))}
          </ol>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-brand lg:ml-[33%] lg:mr-[17%] lg:justify-center">
            <svg width="100%" height="26" viewBox="0 0 300 26" preserveAspectRatio="none" className="hidden max-w-[50%] lg:block" aria-hidden="true">
              <path d="M290 2 V14 H10 V2" fill="none" stroke="rgb(var(--brand))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" markerEnd="url(#arr)" />
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="rgb(var(--brand))" />
                </marker>
              </defs>
            </svg>
            <span className="shrink-0">{t('ev.loop')}</span>
          </div>
        </div>
      </section>

      {/* planned user evaluation */}
      <section className="mt-20">
        <SectionHead eyebrow={t('ev.userEyebrow')} title={t('ev.userTitle')} lead={t('ev.userLead')} />
        <div className="grid gap-4 md:grid-cols-3">
          {(['ev.user1', 'ev.user2', 'ev.user3'] as Key[]).map((k, i) => (
            <Reveal key={k} delay={i * 0.08}>
              <div className="card h-full p-5">
                <div className="font-display text-lg font-semibold">{t((k + 't') as Key)}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(k)}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">{t('ev.userStatus')}</p>
      </section>

      {/* sources */}
      <section className="mt-20">
        <SectionHead title={t('ev.sourcesTitle')} />
        <div className="card overflow-x-auto">
          <table className="data w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <th>{t('ev.src.col1')}</th>
                <th>{t('ev.src.col2')}</th>
                <th>{t('ev.src.col3')}</th>
                <th>{t('ev.src.col4')}</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((r) => (
                <tr key={r[0]}>
                  <td className="font-semibold">{r[0]}</td>
                  <td className="text-muted">{r[1]}</td>
                  <td className="text-muted">{r[2]}</td>
                  <td>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 pb-3 text-xs text-muted sm:hidden">{t('ev.swipe')}</p>
        </div>
      </section>

      {/* web edition */}
      <section className="mt-20 grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHead title={t('ev.webTitle')} />
          <div className="prose-cs text-sm">
            <p>{t('ev.web1')}</p>
            <p>{t('ev.web2', { n: data!.meta.ability.n_resistant, moat: data!.meta.ability.occupations_with_moat })}</p>
            <p>{t('ev.web3', { n: nMalay })}</p>
          </div>
        </div>
        <div>
          <SectionHead title={t('ev.citeTitle')} />
          <div className="space-y-3">
            <Bib text={BIB_PAPER} />
            <Bib text={BIB_SOFTWARE} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a className="btn-primary" href={REPO} target="_blank" rel="noreferrer">
              <IGithub size={16} /> {t('ev.repo')}
            </a>
            <a className="btn-ghost" href={`mailto:${EMAIL}`}>
              <IMail size={16} /> {EMAIL}
            </a>
          </div>
          <p className="mt-2 text-xs text-muted">{t('ev.contact')}</p>
        </div>
      </section>
    </div>
  );
}
