import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { useApp } from '../state/AppState';
import { DotField } from '../components/DotField';
import { CountUp, Reveal } from '../components/ui';
import { Crowding } from '../components/Crowding';
import { IArrow, IBook, IBrain, ICompass, IGauge, IGithub, ILinkedin, IMail } from '../components/Icons';
import { Key } from '../i18n';
import { AUTHOR, EMAIL, GITHUB_PROFILE, LINKEDIN, REPO } from '../config';

// Occupations the hero walks through: common office and professional jobs in Malaysia, each with
// the first three moves of its CareerShield v2 list. Titles are O*NET titles.
const EXAMPLES = [
  'Accountants and Auditors',
  'Human Resources Specialists',
  'Market Research Analysts and Marketing Specialists',
  'Loan Officers',
  'Bookkeeping, Accounting, and Auditing Clerks',
  'Computer Programmers',
];

export function Home() {
  const { t, data } = useApp();
  const examples = useMemo(() => {
    if (!data) return [];
    return EXAMPLES.map((title) => data.occ.findIndex((o) => o.title === title)).filter((i) => i >= 0);
  }, [data]);
  const what: [Key, Key, JSX.Element][] = [
    ['home.what1t', 'home.what1', <IGauge key="a" size={20} />],
    ['home.what2t', 'home.what2', <IBrain key="b" size={20} />],
    ['home.what3t', 'home.what3', <ICompass key="c" size={20} />],
    ['home.what4t', 'home.what4', <IBook key="d" size={20} />],
  ];
  const how: [Key, Key][] = [
    ['home.how1t', 'home.how1'],
    ['home.how2t', 'home.how2'],
    ['home.how3t', 'home.how3'],
    ['home.how4t', 'home.how4'],
  ];
  const stats: [number, Key, string][] = [
    [3, 'home.stat1', 'text-brand'],
    [894, 'home.stat2', 'text-safe'],
    [662, 'home.stat3', 'text-warn'],
    [820, 'home.stat4', 'text-risk'],
  ];
  // one accent per item, in the same order as the stats
  const accent = ['text-brand border-brand', 'text-risk border-risk', 'text-warn border-warn', 'text-safe border-safe'];
  const fade = (delay: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] } });
  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        {/* two soft pools of colour behind the hero; gradients, not blur filters, so nothing repaints */}
        <div className="pointer-events-none absolute -right-48 -top-40 h-[44rem] w-[44rem]" style={{ background: 'radial-gradient(closest-side, rgb(var(--brand) / 0.16), transparent)' }} aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-64 -left-56 h-[36rem] w-[36rem]" style={{ background: 'radial-gradient(closest-side, rgb(var(--safe) / 0.09), transparent)' }} aria-hidden="true" />
        <div className="relative mx-auto grid max-w-page gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-14 lg:pb-16 lg:pt-14">
          <div>
            <motion.h1 {...fade(0)} className="font-display text-[2.15rem] font-semibold leading-[1.08] tracking-tight sm:text-[2.9rem] lg:text-[3.2rem]">
              {t('home.title1')} <span className="text-brand">{t('home.title2')}</span>
            </motion.h1>
            <motion.p {...fade(0.08)} className="mt-5 max-w-xl text-lg leading-relaxed text-ink/75">
              {t('home.lead')}
            </motion.p>
            <motion.div {...fade(0.16)} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link to="/analyse" className="btn-primary px-5 py-3 text-base">
                {t('home.ctaAnalyse')} <IArrow />
              </Link>
              <Link to="/evidence" className="link text-base">
                {t('home.ctaEvidence')}
              </Link>
            </motion.div>
            <motion.div {...fade(0.24)} className="mt-10 max-w-xl border-t border-line pt-5 text-sm">
              <div>
                <span className="text-muted">{t('home.by')} </span>
                <a href={LINKEDIN} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-brand">
                  {AUTHOR}
                </a>
              </div>
              <div className="mt-0.5 text-muted">{t('home.byRole')}</div>
            </motion.div>
          </div>
          <motion.figure {...fade(0.1)} className="rounded-lg border border-line bg-paper/80 p-4 shadow-lift sm:p-5">
            <figcaption className="mb-3 flex items-baseline justify-between gap-4">
              <span className="text-sm font-semibold leading-snug">{t('home.fieldCaption')}</span>
              <span className="shrink-0 text-xs text-muted">{t('home.fieldUnit')}</span>
            </figcaption>
            <div className="h-[430px] sm:h-[500px]">
              <DotField examples={examples} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-muted">
              <span className="text-safe">{t('home.fieldLow')}</span>
              <span className="h-px flex-1 bg-gradient-to-r from-safe via-warn to-risk" aria-hidden="true" />
              <span className="text-risk">{t('home.fieldHigh')}</span>
            </div>
          </motion.figure>
        </div>
      </section>

      {/* key figures */}
      <section className="border-b border-line">
        <dl className="mx-auto grid max-w-page grid-cols-2 px-4 sm:px-6 md:grid-cols-4">
          {stats.map(([n, k, c], idx) => (
            <div key={k} className={`flex flex-col-reverse justify-end py-6 ${idx % 2 ? 'pl-5 border-l border-line' : ''} ${idx === 2 ? 'md:border-l md:pl-5' : ''} ${idx > 1 ? 'border-t border-line md:border-t-0' : ''}`}>
              <dt className="mt-1 text-sm text-muted">{t(k)}</dt>
              <dd className={`num font-display text-[2.1rem] font-semibold leading-none ${c}`}>
                <CountUp value={n} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* crowding: the paper's headline result */}
      <section className="mx-auto max-w-page px-4 pt-20 sm:px-6">
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="eyebrow mb-3">{t('home.crowdEyebrow')}</div>
              <h2 className="font-display text-[1.9rem] font-semibold leading-tight tracking-tight sm:text-[2.2rem]">{t('home.crowdTitle')}</h2>
              <p className="mt-4 leading-relaxed text-ink/80">{t('home.v2Body')}</p>
              <p className="mt-4 text-sm leading-relaxed text-muted">{t('home.crowdLead')}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link to="/moves" className="btn-primary">
                  {t('home.crowdTry')} <IArrow />
                </Link>
                <Link to="/evidence" className="link">
                  {t('home.v2More')}
                </Link>
              </div>
            </div>
            <div id="home-crowding" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
              <Crowding />
            </div>
          </div>
        </Reveal>
      </section>

      {/* what it does */}
      <section className="mx-auto max-w-page px-4 py-20 sm:px-6">
        <h2 className="font-display text-[1.9rem] font-semibold tracking-tight">{t('home.whatTitle')}</h2>
        <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {what.map(([h, b, ic], k) => (
            <Reveal key={h} delay={k * 0.06}>
              <div className={`h-full border-t-2 pt-4 ${accent[k].split(' ')[1]}`}>
                <div className={accent[k].split(' ')[0]}>{ic}</div>
                <h3 className="mt-3 text-lg font-semibold">{t(h)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(b)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* method */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-page gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <h2 className="font-display text-[1.9rem] font-semibold tracking-tight">{t('home.howTitle')}</h2>
            <p className="mt-3 max-w-sm leading-relaxed text-muted">{t('home.howLead')}</p>
            <Link to="/evidence" className="link mt-5 inline-block text-sm">
              {t('home.v2More')}
            </Link>
          </div>
          <ol className="border-t border-line">
            {how.map(([h, b], k) => (
              <Reveal as="li" key={h} delay={k * 0.06} className="grid grid-cols-[2.75rem_1fr] gap-3 border-b border-line py-5">
                <span className={`pt-0.5 font-display text-sm font-semibold ${accent[k].split(' ')[0]}`}>{String(k + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-semibold">{t(h)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{t(b)}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* what the score means */}
      <section className="mx-auto grid max-w-page gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.75fr_1.25fr]">
        <Reveal>
          <h2 className="font-display text-[1.9rem] font-semibold leading-tight tracking-tight">{t('home.honestTitle')}</h2>
          <div className="mt-6 border-l-2 border-safe pl-4">
            <div className="num font-display text-5xl font-semibold text-safe">&minus;21%</div>
            <p className="mt-2 max-w-xs text-sm text-muted">{t('ev.h1')}</p>
          </div>
        </Reveal>
        <Reveal delay={0.08} className="prose-cs text-lg">
          <p>{t('home.honest1')}</p>
          <p>{t('home.honest2')}</p>
        </Reveal>
      </section>

      {/* the person behind it */}
      <section className="mx-auto max-w-page px-4 sm:px-6">
        <Reveal>
          <div className="grid gap-8 rounded-lg border border-line border-l-brand bg-surface p-6 sm:p-10 lg:grid-cols-[0.75fr_1.25fr]" style={{ borderLeftWidth: 3 }}>
            <div>
              <div className="eyebrow mb-3">{t('home.aboutEyebrow')}</div>
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{AUTHOR}</h2>
              <p className="mt-1 text-muted">{t('home.byRole')}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={GITHUB_PROFILE} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2">
                  <IGithub size={16} /> GitHub
                </a>
                <a href={LINKEDIN} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2">
                  <ILinkedin size={16} /> LinkedIn
                </a>
                <a href={`mailto:${EMAIL}`} className="btn-ghost px-3 py-2">
                  <IMail size={16} /> {t('home.aboutEmail')}
                </a>
              </div>
            </div>
            <div className="prose-cs">
              <p>{t('home.about1')}</p>
              <p>
                {t('home.about2')}{' '}
                <a href={REPO} target="_blank" rel="noreferrer" className="link">
                  {t('home.aboutRepo')}
                </a>
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* closing call to action */}
      <section className="mx-auto max-w-page px-4 pt-20 sm:px-6">
        <div className="flex flex-col gap-6 border-t border-line pt-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-[1.9rem] font-semibold tracking-tight">{t('home.endTitle')}</h2>
            <p className="mt-2 max-w-xl leading-relaxed text-muted">{t('home.endLead')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/analyse" className="btn-primary px-5 py-3 text-base">
              {t('home.ctaAnalyse')} <IArrow />
            </Link>
            <Link to="/atlas" className="btn-ghost px-5 py-3 text-base">
              {t('home.endAtlas')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
