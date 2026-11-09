import { ChangeEvent, ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, m as motion } from 'framer-motion';
import { useApp } from '../state/AppState';
import { Badge, Meter, PageHead, Segmented, toneFor } from '../components/ui';
import { Finder } from '../components/Finder';
import { IAlert, IArrow, ICheck, IDownload, IUpload } from '../components/Icons';
import { Key, SUS } from '../i18n';
import { fmtRM } from '../lib/format';
import { MatchHit } from '../lib/matcher';
import { PolicyKey } from '../lib/ranking';
import {
  buildLists,
  ITEM_IDS,
  ItemId,
  LABELS,
  ListRecord,
  loadSessions,
  mergeRows,
  newSession,
  pickSequence,
  POLICIES,
  readWide,
  Row,
  saveSessions,
  SCHEMA,
  SEQUENCES,
  Session,
  sessionRows,
  Stat,
  Step,
  STEPS,
  summarise,
  susScore,
  toLongCsv,
  toWideCsv,
  upsertSession,
} from '../lib/research';
import { downloadFile } from '../lib/storage';

// ------------------------------------------------------------------ small parts

/** Agreement scale built on native radio buttons, so arrow keys and screen readers work as usual. */
function Scale({ n, value, onChange, name, label, low, high }: { n: number; value: number | null; onChange: (v: number) => void; name: string; label: string; low: string; high: string }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-medium leading-snug">{label}</legend>
      <div className="inline-flex max-w-full flex-col">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: n }, (_, k) => k + 1).map((v) => (
            <label key={v} className="relative">
              <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="peer sr-only" />
              <span
                className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border text-sm font-semibold num transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface sm:h-11 sm:w-11 ${
                  value === v ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface hover:border-brand'
                }`}
              >
                {v}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between gap-4 text-[11px] text-muted">
          <span>{low}</span>
          <span className="text-right">{high}</span>
        </div>
      </div>
    </fieldset>
  );
}

function Progress({ step }: { step: Step }) {
  const { t } = useApp();
  const k = STEPS.indexOf(step);
  const total = STEPS.length - 1;
  return (
    <div className="mb-6" aria-label={t('sd.progress', { n: Math.min(k + 1, total), m: total })}>
      <div className="mb-1.5 flex justify-between text-xs font-semibold text-muted num">
        <span>{t('sd.progress', { n: Math.min(k + 1, total), m: total })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <motion.div className="h-full rounded-full bg-brand" initial={false} animate={{ width: `${(k / total) * 100}%` }} transition={{ duration: 0.4 }} />
      </div>
    </div>
  );
}

function StepCard({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="card p-5 sm:p-7">
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      {lead && <div className="mt-2 text-sm leading-relaxed text-muted">{lead}</div>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function firstSentence(s: string, max = 150) {
  const m = s.match(/^.*?[.!?](\s|$)/);
  const x = (m ? m[0] : s).trim();
  return x.length > max ? x.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : x;
}

/** One blinded list: identical fields for every policy, no policy name, no crowding figures. */
function BlindList({ list }: { list: ListRecord }) {
  const { data, t } = useApp();
  const b = data!;
  const idx = new Map(b.occ.map((o) => [o.soc, o.i]));
  return (
    <div className="rounded-2xl border border-line bg-raised/60 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-lg font-semibold text-paper">{list.label}</span>
        <span className="font-display text-xl font-semibold">{t('sd.listName', { l: list.label })}</span>
      </div>
      {list.items.length === 0 ? (
        <p className="text-sm text-muted">{t('sd.listEmpty')}</p>
      ) : (
        <ol className="space-y-2.5">
          {list.items.map((soc, k) => {
            const o = b.occ[idx.get(soc)!];
            return (
              <li key={soc} className="rounded-xl border border-line bg-surface p-3.5 sm:p-4">
                <div className="flex items-start gap-3">
                  <span className="num mt-0.5 text-sm font-bold text-muted">{k + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-snug">{o.title}</div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{firstSentence(o.desc)}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t('sd.salary')}</div>
                        <div className="num mt-0.5 font-semibold">{o.sal == null ? t('sd.na') : `${fmtRM(o.sal)} ${t('sd.perMonth')}`}</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
                          <span>{t('sd.exposure')}</span>
                          <span className="num text-ink">{o.pctl == null ? t('sd.na') : Math.round(o.pctl)}</span>
                        </div>
                        <div className="mt-1.5">
                          <Meter value={o.pctl ?? 0} tone={toneFor(o.pctl) as 'risk'} height={5} label={t('sd.exposure')} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ participant steps

function Consent({ onStart }: { onStart: (code: string) => void }) {
  const { t } = useApp();
  const [boxes, setBoxes] = useState([false, false, false, false]);
  const [code, setCode] = useState('');
  const all = boxes.every(Boolean);
  const labels: Key[] = ['sd.c1', 'sd.c2', 'sd.c3', 'sd.c4'];
  return (
    <StepCard title={t('sd.infoTitle')}>
      <div className="prose-cs space-y-3 text-sm leading-relaxed">
        <p>{t('sd.info1')}</p>
        <p>{t('sd.info2')}</p>
        <p>{t('sd.info3')}</p>
        <p>{t('sd.info4')}</p>
      </div>
      <div className="mt-6 space-y-3 rounded-xl border border-line bg-raised/60 p-4">
        {labels.map((k, i) => (
          <label key={k} className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--brand))]" checked={boxes[i]} onChange={(e) => setBoxes(boxes.map((x, j) => (j === i ? e.target.checked : x)))} />
            {t(k)}
          </label>
        ))}
      </div>
      <div className="mt-5 max-w-xs">
        <label htmlFor="pcode" className="mb-1 block text-xs font-semibold">
          {t('sd.code')}
        </label>
        <input id="pcode" className="input py-2" value={code} autoComplete="off" onChange={(e) => setCode(e.target.value.replace(/[^\w-]/g, '').slice(0, 20))} />
        <p className="mt-1 text-xs text-muted">{t('sd.codeHelp')}</p>
      </div>
      <button className="btn-primary mt-6" disabled={!all} onClick={() => onStart(code.trim())}>
        {t('sd.start')} <IArrow />
      </button>
    </StepCard>
  );
}

function Occupation({ onConfirm }: { onConfirm: (h: MatchHit, query: string) => void }) {
  const { data, t } = useApp();
  const [pick, setPick] = useState<{ h: MatchHit; q: string } | null>(null);
  return (
    <StepCard title={t('sd.occTitle')} lead={t('sd.occLead')}>
      <Finder selected={pick?.h.i ?? null} examples={false} onSelect={(h, q) => setPick({ h, q })} />
      {pick && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-col gap-3 rounded-2xl border border-brand/40 bg-brand/5 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="eyebrow">{t('sd.occChosen')}</div>
            <div className="mt-1 font-semibold">{data!.occ[pick.h.i].title}</div>
          </div>
          <button className="btn-primary" onClick={() => onConfirm(pick.h, pick.q)}>
            {t('sd.occConfirm')} <IArrow />
          </button>
        </motion.div>
      )}
    </StepCard>
  );
}

function RateList({ s, k, update }: { s: Session; k: number; update: (patch: Partial<Session>) => void }) {
  const { t, lang } = useApp();
  const list = s.lists[k];
  const set = (patch: Partial<ListRecord>) => update({ lists: s.lists.map((l, j) => (j === k ? { ...l, ...patch } : l)) });
  const ready = ITEM_IDS.every((id) => list.ratings[id] != null);
  return (
    <StepCard title={t('sd.rateTitle', { l: list.label, n: k + 1 })} lead={<>{t('sd.rateLead')} <b className="font-semibold text-ink">{t('sd.overlapNote')}</b></>}>
      <BlindList list={list} />
      <div className="mt-7 space-y-6">
        {ITEM_IDS.map((id) => (
          <Scale
            key={id + list.label}
            n={7}
            name={`${list.label}-${id}`}
            value={list.ratings[id]}
            onChange={(v) => set({ ratings: { ...list.ratings, [id]: v } as Record<ItemId, number | null> })}
            label={t(('sd.item.' + id) as Key)}
            low={t('sd.sd')}
            high={t('sd.sa')}
          />
        ))}
        <div>
          <label htmlFor={`comment-${list.label}`} className="mb-2 block text-sm font-medium">
            {t('sd.comment')}
          </label>
          <textarea id={`comment-${list.label}`} lang={lang} className="input min-h-[84px]" value={list.comment} maxLength={600} onChange={(e) => set({ comment: e.target.value })} />
        </div>
      </div>
      <div className="mt-7 flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => update({ step: k === 0 ? 'occupation' : (`list${k - 1}` as Step) })}>
          {t('sd.back')}
        </button>
        <button
          className="btn-primary"
          disabled={!ready}
          onClick={() => {
            const now = new Date().toISOString();
            const lists = s.lists.map((l, j) => (j === k ? { ...l, ratedAt: now } : j === k + 1 && !l.shownAt ? { ...l, shownAt: now } : l));
            update({ lists, step: k < 2 ? (`list${k + 1}` as Step) : 'choice' });
          }}
        >
          {t('sd.next')} <IArrow />
        </button>
      </div>
    </StepCard>
  );
}

function Choice({ s, update }: { s: Session; update: (patch: Partial<Session>) => void }) {
  const { t } = useApp();
  return (
    <StepCard title={t('sd.choiceTitle')} lead={t('sd.choiceLead')}>
      <div className="grid gap-4 lg:grid-cols-3">
        {s.lists.map((l) => (
          <label key={l.label} className={`block cursor-pointer rounded-2xl border-2 p-1 transition-colors ${s.choice === l.label ? 'border-brand' : 'border-transparent hover:border-line'}`}>
            <input type="radio" name="choice" className="sr-only" checked={s.choice === l.label} onChange={() => update({ choice: l.label })} />
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold">{t('sd.listName', { l: l.label })}</span>
                {s.choice === l.label && <ICheck className="text-brand" />}
              </div>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {l.titles.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-7 flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => update({ step: 'list2' })}>
          {t('sd.back')}
        </button>
        <button className="btn-primary" disabled={!s.choice} onClick={() => update({ step: 'sus' })}>
          {t('sd.next')} <IArrow />
        </button>
      </div>
    </StepCard>
  );
}

function SusStep({ s, update }: { s: Session; update: (patch: Partial<Session>) => void }) {
  const { t, lang } = useApp();
  return (
    <StepCard title={t('sd.susTitle')} lead={t('sd.susLead')}>
      <ol className="space-y-6">
        {SUS[lang].map((q, k) => (
          <li key={k}>
            <Scale n={5} name={`sus${k}`} value={s.sus[k]} onChange={(v) => update({ sus: s.sus.map((x, j) => (j === k ? v : x)) })} label={`${k + 1}. ${q}`} low={t('sd.sd')} high={t('sd.sa')} />
          </li>
        ))}
      </ol>
      <div className="mt-7 flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => update({ step: 'choice' })}>
          {t('sd.back')}
        </button>
        <button className="btn-primary" disabled={s.sus.some((x) => x == null)} onClick={() => update({ step: 'about' })}>
          {t('sd.next')} <IArrow />
        </button>
      </div>
    </StepCard>
  );
}

const AGE = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const SECTOR = ['manufacturing', 'trade', 'finance', 'ict', 'professional', 'education', 'health', 'public', 'hospitality', 'transport', 'construction', 'agriculture', 'other'];
const EDU = ['spm', 'diploma', 'bachelor', 'postgrad', 'other'];
const YEARS = ['lt1', '1-2', '3-5', '6-10', 'gt10'];

function AboutStep({ s, update }: { s: Session; update: (patch: Partial<Session>) => void }) {
  const { t } = useApp();
  const a = s.about;
  const sel = (id: keyof Session['about'], label: Key, opts: string[], prefix: string | null) => (
    <div>
      <label htmlFor={`about-${id}`} className="mb-1 block text-xs font-semibold">
        {t(label)}
      </label>
      <select id={`about-${id}`} className="input py-2" value={a[id]} onChange={(e) => update({ about: { ...a, [id]: e.target.value } })}>
        <option value="">{t('sd.select')}</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {prefix ? t((prefix + o) as Key) : o}
          </option>
        ))}
        <option value="na">{t('sd.preferNot')}</option>
      </select>
    </div>
  );
  return (
    <StepCard title={t('sd.aboutTitle')} lead={t('sd.aboutLead')}>
      <div className="grid gap-4 sm:grid-cols-2">
        {sel('ageBand', 'sd.age', AGE, null)}
        {sel('sector', 'sd.sector', SECTOR, 'sd.sector.')}
        {sel('education', 'sd.education', EDU, 'sd.edu.')}
        {sel('years', 'sd.years', YEARS, 'sd.yrs.')}
      </div>
      <div className="mt-7 flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => update({ step: 'sus' })}>
          {t('sd.back')}
        </button>
        <button className="btn-primary" disabled={!a.ageBand || !a.sector || !a.education || !a.years} onClick={() => update({ step: 'done', completedAt: new Date().toISOString() })}>
          {t('sd.submit')} <ICheck size={16} />
        </button>
      </div>
    </StepCard>
  );
}

function Participant() {
  const { data, t, lang, study, setStudy } = useApp();
  const s = study && study.schema === SCHEMA ? study : null;
  const [saved, setSaved] = useState(true);
  const update = (patch: Partial<Session>) => {
    if (!s) return;
    const n = { ...s, ...patch };
    setStudy(n);
    setSaved(upsertSession(n));
    if (patch.step) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const step: Step = s?.step ?? 'consent';
  const k = step.startsWith('list') ? Number(step.slice(4)) : -1;
  return (
    <div>
      <Progress step={step} />
      {!saved && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-risk/40 bg-risk/10 p-3 text-sm text-risk" role="alert">
          <IAlert size={16} className="mt-0.5 shrink-0" /> {t('sd.noStorage')}
        </p>
      )}
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.25 }}>
          {step === 'consent' && (
            <Consent
              onStart={(code) => {
                const n = newSession(lang, code, data!.meta.built);
                setStudy(n);
                setSaved(upsertSession(n));
              }}
            />
          )}
          {step === 'occupation' && s && (
            <Occupation
              onConfirm={(h, q) => {
                const pick = s.sequence == null ? pickSequence(s.participant) : { sequence: s.sequence, source: s.sequenceSource ?? 'random' };
                const built = buildLists(data!, h.i, pick.sequence);
                built.lists[0].shownAt = new Date().toISOString();
                update({
                  occupation: { soc: data!.occ[h.i].soc, title: data!.occ[h.i].title, query: q, path: h.path },
                  sequence: pick.sequence,
                  sequenceSource: pick.source,
                  ...built,
                  choice: null,
                  step: 'list0',
                });
              }}
            />
          )}
          {k >= 0 && s && <RateList s={s} k={k} update={update} />}
          {step === 'choice' && s && <Choice s={s} update={update} />}
          {step === 'sus' && s && <SusStep s={s} update={update} />}
          {step === 'about' && s && <AboutStep s={s} update={update} />}
          {step === 'done' && s && (
            <div className="card p-8 text-center sm:p-10">
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-safe/15 text-safe">
                <ICheck size={28} />
              </motion.div>
              <p className="font-display text-2xl font-semibold">{t('sd.thanks')}</p>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted">{t('sd.thanksLead')}</p>
              <p className="mt-4 text-xs text-muted num">{s.id}</p>
              <button className="btn-primary mt-6" onClick={() => setStudy(null)}>
                {t('sd.new')}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ researcher view

const fmt = (x: number | null, d = 2) => (x == null ? 'n/a' : x.toFixed(d));
const cell = (s: Stat) => (s.n ? `${fmt(s.mean)} (${fmt(s.sd)})` : 'n/a');

function Researcher() {
  const { t } = useApp();
  const [local, setLocal] = useState(loadSessions);
  const [files, setFiles] = useState<{ name: string; rows: Row[] }[]>([]);
  const [bad, setBad] = useState<string[]>([]);
  const [useLocal, setUseLocal] = useState(true);
  const stamp = new Date().toISOString().slice(0, 10);
  const rows = useMemo(() => mergeRows([...(useLocal ? [sessionRows(local)] : []), ...files.map((f) => f.rows)]), [local, files, useLocal]);
  const sum = useMemo(() => summarise(rows), [rows]);
  const polName: Record<PolicyKey, string> = { CONV: t('pol.CONV'), v1: t('pol.v1'), v2: t('pol.v2') };

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const ok: { name: string; rows: Row[] }[] = [];
    const fail: string[] = [];
    for (const f of list) {
      const r = readWide(await f.text());
      if (r) ok.push({ name: f.name, rows: r });
      else fail.push(f.name);
    }
    setFiles((x) => [...x, ...ok]);
    setBad(fail);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold">{t('sd.r.localTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('sd.sessions', { n: local.length, c: local.filter((s) => s.completedAt).length })}</p>
        {local.length > 0 && (
          <div className="mt-4 max-h-60 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs num">
              <thead className="sticky top-0 bg-raised text-muted">
                <tr>
                  <th className="px-3 py-2">{t('sd.r.session')}</th>
                  <th className="px-3 py-2">{t('sd.r.code')}</th>
                  <th className="px-3 py-2">{t('sd.r.occupation')}</th>
                  <th className="px-3 py-2">{t('sd.r.order')}</th>
                  <th className="px-3 py-2">SUS</th>
                </tr>
              </thead>
              <tbody>
                {local.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-3 py-2">{s.id}</td>
                    <td className="px-3 py-2">{s.participant || '-'}</td>
                    <td className="px-3 py-2">{s.occupation?.title ?? '-'}</td>
                    <td className="px-3 py-2">{s.order.length ? s.order.map((p, k) => `${LABELS[k]}=${p}`).join(' ') : '-'}</td>
                    <td className="px-3 py-2">{s.completedAt ? susScore(s.sus) : t('sd.r.incomplete')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-ghost" disabled={!local.length} onClick={() => downloadFile(`careershield-study-${stamp}.csv`, toWideCsv(local), 'text/csv')}>
            <IDownload size={16} /> {t('sd.exportCsv')}
          </button>
          <button className="btn-ghost" disabled={!local.length} onClick={() => downloadFile(`careershield-study-long-${stamp}.csv`, toLongCsv(local), 'text/csv')}>
            <IDownload size={16} /> {t('sd.exportLong')}
          </button>
          <button className="btn-ghost" disabled={!local.length} onClick={() => downloadFile(`careershield-study-${stamp}.json`, JSON.stringify(local, null, 2))}>
            <IDownload size={16} /> {t('sd.exportJson')}
          </button>
          <button
            className="btn-ghost text-risk"
            disabled={!local.length}
            onClick={() => {
              if (window.confirm(t('sd.confirmDelete'))) {
                saveSessions([]);
                setLocal([]);
              }
            }}
          >
            {t('sd.deleteAll')}
          </button>
        </div>
      </section>

      <section className="card p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold">{t('sd.r.title')}</h2>
        <p className="mt-1 text-sm text-muted">{t('sd.r.lead')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="btn-primary cursor-pointer">
            <IUpload size={16} /> {t('sd.r.import')}
            <input type="file" accept=".csv,text/csv" multiple className="sr-only" onChange={onFiles} id="import-csv" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={useLocal} onChange={(e) => setUseLocal(e.target.checked)} />
            {t('sd.r.includeLocal')}
          </label>
          {files.length > 0 && (
            <button className="btn-ghost text-sm" onClick={() => setFiles([])}>
              {t('sd.r.clearFiles')}
            </button>
          )}
        </div>
        {files.length > 0 && <p className="mt-3 text-xs text-muted">{files.map((f) => `${f.name} (${f.rows.length})`).join(' · ')}</p>}
        {bad.length > 0 && (
          <p className="mt-3 text-sm text-risk" role="alert">
            {t('sd.r.badFile')} {bad.join(', ')}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            [t('sd.r.complete'), `${sum.complete} / ${sum.total}`],
            [t('sd.r.identical'), String(sum.identical)],
            [t('sd.r.sus'), sum.sus.n ? `${fmt(sum.sus.mean, 1)} (${fmt(sum.sus.sd, 1)})` : 'n/a'],
            [t('sd.r.seq'), sum.bySequence.join(' · ')],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line bg-raised/60 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</div>
              <div className="num mt-1 text-lg font-semibold">{v}</div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted">{t('sd.r.tableNote')}</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm num" id="study-summary">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3">{t('sd.r.outcome')}</th>
                {POLICIES.map((p) => (
                  <th key={p} className="py-2 pr-3">
                    {polName[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['fit', 'attract', 'feasible', 'trust'] as const).map((o) => (
                <tr key={o} className="border-b border-line/60">
                  <td className="py-2 pr-3 font-medium">{t(('sd.r.o.' + o) as Key)}</td>
                  {POLICIES.map((p) => (
                    <td key={p} className="py-2 pr-3">
                      {cell(sum.outcomes[o][p])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3 font-medium">{t('sd.r.o.choice')}</td>
                {POLICIES.map((p) => (
                  <td key={p} className="py-2 pr-3">
                    {sum.complete ? `${sum.choice[p]} (${Math.round((sum.choice[p] / sum.complete) * 100)}%)` : 'n/a'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {(['all', 'differ'] as const).map((k) => {
            const d = sum.paired[k];
            return (
              <div key={k} className="rounded-xl border border-line p-4">
                <div className="text-sm font-semibold">{t(k === 'all' ? 'sd.r.pairedAll' : 'sd.r.pairedDiffer')}</div>
                <div className="num mt-1 text-lg">
                  {d.n ? `${fmt(d.mean)} [${fmt(d.lo)}, ${fmt(d.hi)}]` : 'n/a'} <span className="text-xs text-muted">n = {d.n}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">{t('sd.r.analysisNote')}</p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ page

export function Study() {
  const { t, research, study } = useApp();
  const [view, setView] = useState<'participant' | 'researcher'>('participant');
  // the researcher view names the policies, so it is hidden while a participant is mid-session
  const midSession = !!study && study.schema === SCHEMA && study.step !== 'done';
  if (!research) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHead title={t('sd.title')} />
        <p className="card p-6 text-muted">
          {t('sd.disabled')}{' '}
          <Link to="/settings" className="font-semibold text-brand">
            {t('nav.settings')}
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHead title={t('sd.title')} lead={view === 'participant' ? t('sd.lead') : undefined}>
        {!midSession && (
        <Segmented<'participant' | 'researcher'>
          label={t('sd.title')}
          value={view}
          onChange={setView}
          options={[
            { value: 'participant', label: t('sd.vParticipant') },
            { value: 'researcher', label: t('sd.vResearcher') },
          ]}
        />
        )}
      </PageHead>
      <div className="mb-6 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm font-semibold text-warn" role="note">
        <IAlert size={18} className="mt-0.5 shrink-0" /> {t('sd.ethics')}
      </div>
      {view === 'participant' || midSession ? <Participant /> : <Researcher />}
      <p className="mt-8 text-center text-xs text-muted">
        <Badge>{t('sd.design', { n: SEQUENCES.length })}</Badge>
      </p>
    </div>
  );
}

