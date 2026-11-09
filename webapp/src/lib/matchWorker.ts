// Web Worker for the title matcher. It fetches the title data and the occupation descriptions
// itself, builds the TF-IDF index and the autocomplete list, and answers suggestion, title and CV
// queries, and reads Word documents, so none of that work or data touches the main thread. Same
// code as the synchronous path in matcher.ts, so the results are identical.
import type { Bundle, DescriptionsFile, MatcherFile } from './data';
import { lexIndex, matchCv, matchForApp, searchTitles, titleEntries } from './matcher';
import { docxText } from './docx';
import type { ToWorker, FromWorker, WorkerOcc } from './matchClient';

let ready: Promise<Bundle> | null = null;
const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m);

async function init(occ: WorkerOcc[]): Promise<Bundle> {
  const [mt, d] = await Promise.all([import('../data/matcher.json'), import('../data/descriptions.json')]);
  const desc = (d.default as unknown as DescriptionsFile).desc;
  const b = { occ: occ.map((o) => ({ ...o, desc: desc[o.i] ?? '' })), matcher: mt.default as unknown as MatcherFile } as unknown as Bundle;
  lexIndex(b);
  titleEntries(b);
  return b;
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.type === 'init') {
    if (!ready) {
      ready = init(m.occ);
      ready.then(
        () => post({ type: 'ready' }),
        () => post({ type: 'failed' }),
      );
    }
    return;
  }
  try {
    if (m.type === 'docx') {
      post({ id: m.id, res: { text: await docxText(m.buf) } });
      return;
    }
    if (!ready) throw new Error('not initialised');
    const b = await ready;
    if (m.type === 'suggest') post({ id: m.id, res: { titles: searchTitles(b, m.q, 8) } });
    else post({ id: m.id, res: m.kind === 'title' ? { hits: matchForApp(b, m.text, 5) } : matchCv(b, m.text, 5) });
  } catch {
    post({ id: m.id, error: true });
  }
};
