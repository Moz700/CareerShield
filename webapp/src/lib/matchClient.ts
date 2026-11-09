// Title suggestions, title and CV matching, and Word document reading. In the online build all of it
// runs in a Web Worker that also fetches the title data (the largest file) and builds the search
// index, so the main thread only sends queries and receives short answers. Where a module worker
// cannot run (the offline single file, an old browser, or a worker that fails to start) the same
// functions from matcher.ts run on the main thread instead, so the answers are identical.
import { Bundle, loadBundle, Occupation } from './data';
import { CvResult, lexIndex, matchCv, matchForApp, MatchHit, searchTitles, TitleEntry } from './matcher';

export interface MatchResult {
  hits: MatchHit[];
  titles?: string[];
}

/** The fields of an occupation the matcher reads; the worker adds the description itself. */
export type WorkerOcc = Pick<Occupation, 'i' | 'title' | 'convList' | 'related' | 'pctl'>;

type Job = { type: 'suggest'; q: string } | { type: 'match'; kind: 'title' | 'cv'; text: string } | { type: 'docx'; buf: ArrayBuffer };
export type ToWorker = { type: 'init'; occ: WorkerOcc[] } | (Job & { id: number });

type Answer = MatchResult | CvResult | { titles: TitleEntry[] } | { text: string };
export type FromWorker = { type: 'ready' } | { type: 'failed' } | { id: number; res: Answer } | { id: number; error: true };

let worker: Promise<Worker | null> | null = null;
let workerReady: Promise<boolean> | null = null;
let mainReady: Promise<void> | null = null;
let mode: 'worker' | 'main' | null = null;
let seq = 0;
const pending = new Map<number, (r: Answer | null) => void>();

function giveUp() {
  worker = Promise.resolve(null);
  pending.forEach((done) => done(null));
  pending.clear();
}

function startWorker(b: Bundle): Promise<Worker | null> {
  if (worker) return worker;
  let settle: (ok: boolean) => void = () => {};
  workerReady = new Promise<boolean>((r) => (settle = r));
  worker = (async () => {
    if (__OFFLINE__ || typeof Worker === 'undefined') return null;
    try {
      const { default: MatchWorker } = await import('./matchWorker?worker');
      if (!MatchWorker) return null;
      const w: Worker = new MatchWorker();
      w.onmessage = (e: MessageEvent<FromWorker>) => {
        const m = e.data;
        if ('type' in m) return settle(m.type === 'ready');
        pending.get(m.id)?.('error' in m ? null : m.res);
        pending.delete(m.id);
      };
      w.onerror = () => {
        settle(false);
        giveUp();
      };
      const occ: WorkerOcc[] = b.occ.map((o) => ({ i: o.i, title: o.title, convList: o.convList, related: o.related, pctl: o.pctl }));
      w.postMessage({ type: 'init', occ } satisfies ToWorker);
      return w;
    } catch {
      return null;
    }
  })();
  worker.then((w) => !w && settle(false));
  return worker;
}

function ask(w: Worker, job: Job, transfer: Transferable[] = []): Promise<Answer | null> {
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    w.postMessage({ ...job, id } satisfies ToWorker, transfer);
  });
}

/** Main-thread path: the title data and descriptions load here and the index is built here. */
function prepareMain(b: Bundle): Promise<void> {
  if (!mainReady) {
    mainReady = loadBundle(['matcher', 'desc']).then(() => {
      mode = 'main';
      // build the index after the loading state has painted
      window.setTimeout(() => lexIndex(b), 250);
    });
    mainReady.catch(() => {
      mainReady = null;
    });
  }
  return mainReady;
}

/**
 * Gets the matcher ready: starts the worker (which loads the data and builds the index) or, without
 * one, loads the data on the main thread. Called on the first sign of use, not when a page opens.
 */
export async function prepareMatcher(b: Bundle): Promise<void> {
  if (mode === 'main') return prepareMain(b);
  await startWorker(b);
  if (await workerReady) {
    mode = 'worker';
    return;
  }
  giveUp();
  return prepareMain(b);
}

/** Autocomplete suggestions; O*NET titles alone until the title data is ready. */
export async function suggestTitles(b: Bundle, q: string): Promise<TitleEntry[]> {
  if (q.trim().length < 2) return [];
  if (mode === 'worker') {
    const w = await worker;
    const r = w && ((await ask(w, { type: 'suggest', q })) as { titles: TitleEntry[] } | null);
    if (r) return r.titles;
  }
  return searchTitles(b, q, 8);
}

function onMain(b: Bundle, kind: 'title' | 'cv', text: string): Promise<MatchResult> {
  // a short pause lets the busy indicator paint before the synchronous work starts
  return new Promise((resolve) => window.setTimeout(() => resolve(kind === 'title' ? { hits: matchForApp(b, text, 5) } : matchCv(b, text, 5)), 30));
}

/** Top candidate occupations for a job title or for the text of a CV. */
export async function runMatch(b: Bundle, kind: 'title' | 'cv', text: string): Promise<MatchResult> {
  await prepareMatcher(b);
  if (mode === 'worker') {
    const w = await worker;
    const r = w && ((await ask(w, { type: 'match', kind, text })) as MatchResult | null);
    if (r) return r;
    await prepareMain(b);
  }
  return onMain(b, kind, text);
}

/** Plain text of a Word document, read in the worker when there is one. */
export async function readDocx(b: Bundle, buf: ArrayBuffer): Promise<string> {
  const w = await startWorker(b);
  if (w) {
    // the worker gets its own copy, so the original stays usable for the fallback
    const copy = buf.slice(0);
    const r = (await ask(w, { type: 'docx', buf: copy }, [copy])) as { text: string } | null;
    if (r) return r.text;
  }
  const { docxText } = await import('./docx');
  return docxText(buf);
}
