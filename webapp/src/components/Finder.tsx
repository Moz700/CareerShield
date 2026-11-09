// Occupation finder: job title with autocomplete, CV upload (PDF, DOCX, TXT) or pasted text, then
// the closest occupations to confirm. Used by the Analyse page and by the user study.
import { useCallback, useEffect, useRef, useState, KeyboardEvent, DragEvent } from 'react';
import { AnimatePresence, m as motion } from 'framer-motion';
import { useApp } from '../state/AppState';
import { Badge, Meter, Segmented, toneFor } from './ui';
import { IArrow, IFile, ISearch, IUpload } from './Icons';
import { MatchHit, MatchPath, TitleEntry } from '../lib/matcher';
import { prepareMatcher, readDocx, runMatch, suggestTitles } from '../lib/matchClient';
import { extractFileText } from '../lib/cvfile';
import { Key } from '../i18n';

type Tab = 'title' | 'cv' | 'text';

export function pathKey(p: MatchPath | null): Key {
  return ('an.path.' + (p ?? 'manual')) as Key;
}

function Picker({
  onPick,
  onSubmit,
  onIntent,
  ready,
  examples: showExamples = true,
}: {
  onPick: (e: TitleEntry) => void;
  onSubmit: (q: string) => void;
  onIntent: () => void;
  ready: boolean;
  examples?: boolean;
}) {
  const { data, t } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  // until the title data is ready (it loads on first focus), suggestions use O*NET titles only
  const [sugg, setSugg] = useState<TitleEntry[]>([]);
  useEffect(() => {
    if (!data) return;
    let live = true;
    suggestTitles(data, q).then((r) => live && setSugg(r));
    return () => {
      live = false;
    };
  }, [data, q, ready]);
  const listId = 'title-suggestions';
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setAct((a) => Math.min(sugg.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAct((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && act >= 0 && sugg[act]) {
        onPick(sugg[act]);
        setQ(sugg[act].label);
        setOpen(false);
      } else if (q.trim()) {
        setOpen(false);
        onSubmit(q);
      }
    } else if (e.key === 'Escape') setOpen(false);
  };
  const examples = ['accountant', 'data analyst', 'kerani', 'cikgu', 'jururawat', 'lorry driver'];
  return (
    <div>
      <label htmlFor="title-input" className="mb-2 block text-sm font-semibold">
        {t('an.titleLabel')}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <ISearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="title-input"
            className="input pl-11"
            placeholder={t('an.titlePh')}
            value={q}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && sugg.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={act >= 0 ? `sugg-${act}` : undefined}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setAct(-1);
              onIntent();
            }}
            onFocus={() => {
              setOpen(true);
              onIntent();
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={key}
          />
          <AnimatePresence>
            {open && sugg.length > 0 && (
              <motion.ul
                id={listId}
                role="listbox"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-auto rounded-xl border border-line bg-surface p-1.5 shadow-lift"
              >
                {sugg.map((s, k) => (
                  <li
                    key={s.low + s.i}
                    id={`sugg-${k}`}
                    role="option"
                    aria-selected={k === act}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onPick(s);
                      setQ(s.label);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setAct(k)}
                    className={`cursor-pointer rounded-lg px-3 py-2 ${k === act ? 'bg-raised' : ''}`}
                  >
                    <div className="text-sm font-semibold">{s.label}</div>
                    {s.kind !== 0 && <div className="text-xs text-muted">{data?.occ[s.i].title}</div>}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        <button className="btn-primary py-3" onClick={() => q.trim() && onSubmit(q)} disabled={!q.trim()}>
          {t('an.go')} <IArrow />
        </button>
      </div>
      {showExamples && (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{t('an.examples')}:</span>
        {examples.map((x) => (
          <button
            key={x}
            className="chip hover:border-brand hover:text-brand"
            onClick={() => {
              setQ(x);
              onSubmit(x);
            }}
          >
            {x}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}

function CvDrop({ onText }: { onText: (text: string) => void }) {
  const { data, t } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [name, setName] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const handle = async (f: File | undefined) => {
    if (!f || !data) return;
    setBusy(true);
    setErr(false);
    setName(f.name);
    try {
      const txt = await extractFileText(f, (buf) => readDocx(data, buf));
      if (!txt.trim()) throw new Error('empty');
      onText(txt);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${over ? 'border-brand bg-brand/5' : 'border-line bg-raised/50'}`}
      >
        <div className="rounded-full bg-brand/10 p-3 text-brand">{busy ? <IFile size={24} /> : <IUpload size={24} />}</div>
        <p className="text-sm text-muted">{busy ? t('an.reading') : t('an.drop')}</p>
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="sr-only"
          id="cv-file"
          aria-label={t('an.choose')}
          onChange={(e) => handle(e.target.files?.[0])}
        />
        <button className="btn-ghost" onClick={() => input.current?.click()} disabled={busy}>
          {t('an.choose')}
        </button>
        {name && !busy && !err && <span className="text-xs text-muted">{name}</span>}
        <span className="text-xs text-muted">{t('an.privacy')}</span>
      </div>
      {err && (
        <p className="mt-3 text-sm text-risk" role="alert">
          {t('an.cvError')}
        </p>
      )}
    </div>
  );
}

function Candidates({ hits, titles, onSelect, selected }: { hits: MatchHit[]; titles: string[] | null; onSelect: (h: MatchHit) => void; selected: number | null }) {
  const { data, t } = useApp();
  if (!data) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
      {titles && (
        <div className="mb-5">
          <div className="mb-2 text-sm font-semibold">{t('an.detected')}</div>
          {titles.length ? (
            <div className="flex flex-wrap gap-2">
              {titles.map((x) => (
                <span key={x} className="chip">
                  {x}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{t('an.noTitles')}</p>
          )}
        </div>
      )}
      <h2 className="font-display text-xl font-semibold">{t('an.candidates')}</h2>
      <p className="mb-4 text-sm text-muted">{t('an.candidatesLead')}</p>
      {hits.length === 0 ? (
        <p className="text-sm text-risk">{t('an.noMatch')}</p>
      ) : (
        <ul className="grid gap-2.5">
          {hits.map((h, k) => {
            const o = data.occ[h.i];
            const on = selected === h.i;
            const conf = h.path === 'lexical' && !titles ? Math.min(1, h.score / Math.max(hits[0].score, 1e-9)) : h.score;
            return (
              <motion.li key={h.i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.05 }}>
                <button
                  onClick={() => onSelect(h)}
                  aria-pressed={on}
                  className={`group flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-all sm:flex-row sm:items-center ${
                    on ? 'border-brand bg-brand/5 shadow-card' : 'border-line bg-surface hover:border-brand/60 hover:shadow-card'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{o.title}</span>
                      <span className="text-xs text-muted num">{o.soc}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={k === 0 ? 'brand' : 'muted'}>{t(pathKey(h.path))}</Badge>
                      <Badge tone={toneFor(o.pctl) as 'risk'}>
                        {t('res.exposure')} {o.pctl == null ? t('shell.na') : Math.round(o.pctl)}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full sm:w-44">
                    {h.path !== 'related' && (
                      <>
                        <div className="mb-1 flex justify-between text-xs text-muted">
                          <span>{t('an.confidence')}</span>
                          <span className="num font-semibold text-ink">{Math.round(conf * 100)}%</span>
                        </div>
                        <Meter value={conf * 100} label={t('an.confidence')} height={6} />
                      </>
                    )}
                  </div>
                  <span className={`btn ${on ? 'bg-brand text-brand-ink' : 'border border-line bg-raised group-hover:border-brand'} px-4 py-1.5`}>{on ? t('an.selected') : t('an.select')}</span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}


/**
 * Tabs for title, CV and pasted text, with the candidate list underneath. onSelect fires with
 * confirm=true when the person picks an occupation themselves (or a dictionary title resolves it),
 * and confirm=false when the best lexical candidate is only preselected.
 */
export function Finder({ selected, onSelect, examples = true }: { selected: number | null; onSelect: (h: MatchHit, query: string, confirm: boolean) => void; examples?: boolean }) {
  const { data, t } = useApp();
  const [tab, setTab] = useState<Tab>('title');
  const [hits, setHits] = useState<MatchHit[] | null>(null);
  const [titles, setTitles] = useState<string[] | null>(null);
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searched, setSearched] = useState(false);
  const req = useRef(0);

  // The title data (the largest file) loads on the first sign of use and the search index is built
  // in a background worker, so opening the page costs nothing extra.
  const ensure = useCallback(() => {
    if (!data) return Promise.reject(new Error('no data'));
    return prepareMatcher(data).then(() => {
      setReady(true);
      setFailed(false);
    });
  }, [data]);
  const intent = useCallback(() => {
    ensure().catch(() => setFailed(true));
  }, [ensure]);

  const submit = async (kind: 'title' | 'cv', text: string) => {
    if (!data) return;
    const id = ++req.current;
    setBusy(true);
    try {
      await ensure();
      const r = await runMatch(data, kind, text);
      if (id !== req.current) return;
      setSearched(true);
      if (kind === 'title') {
        setTitles(null);
        setHits(r.hits);
        setQuery(text);
        if (r.hits.length) onSelect(r.hits[0], text, r.hits[0].path !== 'lexical');
      } else {
        const found = r.titles ?? [];
        const hs = r.hits.map((h) => ({ ...h, path: (h.path === 'lexical' ? 'cv' : h.path) as MatchPath }));
        setTitles(found);
        setHits(hs);
        setQuery(found[0] ?? '');
        if (hs.length) onSelect(hs[0], found[0] ?? '', false);
      }
    } catch {
      if (id === req.current) setFailed(true);
    } finally {
      if (id === req.current) setBusy(false);
    }
  };
  const submitTitle = (q: string) => submit('title', q);
  const submitText = (txt: string) => submit('cv', txt);

  if (!data) return null;
  return (
    <div>
      <div className="mb-6 overflow-x-auto">
        <Segmented<Tab>
          label={t('an.title')}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setHits(null);
            setTitles(null);
            if (v !== 'title') intent();
          }}
          options={[
            { value: 'title', label: t('an.tabTitle') },
            { value: 'cv', label: t('an.tabCv') },
            { value: 'text', label: t('an.tabText') },
          ]}
        />
      </div>
      {tab === 'title' && (
        <Picker
          examples={examples}
          onPick={(e) => {
            const path: MatchPath = e.kind === 1 ? 'verified' : e.kind === 2 ? 'malay' : 'manual';
            setHits(null);
            setQuery(e.label);
            onSelect({ i: e.i, score: 1, path }, e.label, true);
          }}
          onSubmit={submitTitle}
          onIntent={intent}
          ready={ready}
        />
      )}
      {tab === 'cv' && <CvDrop onText={submitText} />}
      {tab === 'text' && (
        <div>
          <label htmlFor="cv-text" className="sr-only">
            {t('an.tabText')}
          </label>
          <textarea id="cv-text" className="input min-h-[180px]" placeholder={t('an.textPh')} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-primary mt-3" disabled={text.trim().length < 3} onClick={() => submitText(text)}>
            {t('an.go')} <IArrow />
          </button>
        </div>
      )}
      {failed && !busy && (
        <p className="mt-4 text-sm text-risk" role="alert">
          {t('shell.loadError')}
        </p>
      )}
      {busy && (
        <div className="mt-6 h-1 w-full overflow-hidden rounded bg-line" role="progressbar" aria-label={t('shell.loading')}>
          <motion.div className="h-full w-1/3 bg-brand" animate={{ x: ['-100%', '300%'] }} transition={{ repeat: Infinity, duration: 1 }} />
        </div>
      )}
      {busy && !searched && (
        <p className="mt-2 text-xs text-muted" aria-live="polite">
          {t('an.preparing')}
        </p>
      )}
      {hits && !busy && <Candidates hits={hits} titles={titles} selected={selected} onSelect={(h) => onSelect(h, query, true)} />}
    </div>
  );
}
