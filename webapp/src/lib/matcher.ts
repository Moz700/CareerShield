// Occupation matcher. Resolution order as in the original interface: hand-verified titles, then the
// Malaysian title dictionary, then the lexical TF-IDF index over O*NET occupation profiles.
import { Bundle } from './data';
import { LexIndex } from './lexindex';

export type MatchPath = 'verified' | 'malay' | 'lexical' | 'cv' | 'manual' | 'related';

export interface MatchHit {
  i: number;
  score: number; // 1 for dictionary hits, cosine similarity for lexical hits
  path: MatchPath;
  note?: string;
}

export function normTitle(s: string): string {
  let t = String(s).toLowerCase().trim();
  t = t.replace(/\s*[-(,/|@].*/, '');
  t = t.replace(/\b(senior|junior|lead|principal|assistant|associate|sr|jr|ii|iii|iv|executive)\b/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

let lex: LexIndex | null = null;
export function lexIndex(b: Bundle): LexIndex {
  if (lex) return lex;
  const m = b.matcher;
  const docs = b.occ.map((o, i) => `${o.title} ${m.alt[i].join(' ')} ${m.jt[i].join(' ')} ${o.desc} ${m.tasks[i].join(' ')}`);
  lex = new LexIndex().fit(docs);
  return lex;
}

export function matchLexical(b: Bundle, text: string, k = 5): MatchHit[] {
  return lexIndex(b)
    .top(text, k)
    .map(([i, s]) => ({ i, score: s, path: 'lexical' as const }));
}

export function matchForApp(b: Bundle, text: string, k = 5): MatchHit[] {
  const t = normTitle(text);
  const layers: [Record<string, [number, string]>, MatchPath][] = [
    [b.matcher.verified, 'verified'],
    [b.matcher.malay, 'malay'],
  ];
  for (const [src, path] of layers) {
    const hit = src[t];
    if (hit) {
      const first: MatchHit = { i: hit[0], score: 1, path, note: path === 'verified' ? b.matcher.approx[t] : undefined };
      // alternatives: strong text matches first, then O*NET related occupations of the hit in O*NET's order
      const extra = matchLexical(b, text, k + 1).filter((h) => h.i !== hit[0] && h.score >= 0.08);
      const seen = new Set([hit[0], ...extra.map((h) => h.i)]);
      const rel = [...b.occ[hit[0]].convList, ...b.occ[hit[0]].related].filter((j) => !seen.has(j) && b.occ[j].pctl != null).filter((j, q, a) => a.indexOf(j) === q).map((j) => ({ i: j, score: 0.05, path: 'related' as const }));
      return [first, ...extra, ...rel].slice(0, k);
    }
  }
  const lx = matchLexical(b, text, k);
  return lx.length && lx[0].score > 0 ? lx : [];
}

// ---------------------------------------------------------------- title autocomplete
export interface TitleEntry {
  label: string;
  low: string;
  i: number;
  kind: 0 | 1 | 2 | 3 | 4; // 0 O*NET title, 1 verified, 2 Malaysian, 3 reported, 4 alternative
}

// Until the matcher data has loaded, suggestions come from the O*NET titles alone.
let entries: TitleEntry[] | null = null;
let baseEntries: TitleEntry[] | null = null;
export function titleEntries(b: Bundle): TitleEntry[] {
  if (entries) return entries;
  if (!b.matcher) {
    if (!baseEntries) {
      const seen = new Set<string>();
      baseEntries = [];
      for (const o of b.occ) {
        const low = o.title.toLowerCase().trim();
        if (low && !seen.has(low)) baseEntries.push({ label: o.title, low, i: o.i, kind: 0 });
        seen.add(low);
      }
    }
    return baseEntries;
  }
  const out: TitleEntry[] = [];
  const seen = new Set<string>();
  const add = (label: string, i: number, kind: TitleEntry['kind']) => {
    const low = label.toLowerCase().trim();
    if (!low || seen.has(low)) return;
    seen.add(low);
    out.push({ label, low, i, kind });
  };
  const cap = (s: string) => s.replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(It|Hr|Ui|Ux|Qa|Bi|Ai|Hse|Qc)\b/g, (x) => x.toUpperCase());
  b.occ.forEach((o) => add(o.title, o.i, 0));
  Object.values(b.matcher.verified).forEach(([i, raw]) => add(cap(raw), i, 1));
  Object.values(b.matcher.malay).forEach(([i, raw]) => add(cap(raw), i, 2));
  b.matcher.alt.forEach((ts, i) => ts.forEach((t) => add(t, i, 3)));
  b.matcher.jt.forEach((ts, i) => ts.forEach((t) => add(t, i, 4)));
  entries = out;
  return out;
}

export function searchTitles(b: Bundle, q: string, k = 8): TitleEntry[] {
  const s = q.toLowerCase().trim();
  if (s.length < 2) return [];
  const all = titleEntries(b);
  const scored: [number, TitleEntry][] = [];
  for (const e of all) {
    const p = e.low.indexOf(s);
    if (p < 0) continue;
    let sc = e.low === s ? 0 : p === 0 ? 1 : e.low[p - 1] === ' ' ? 2 : 3;
    sc = sc * 10 + e.kind + Math.min(e.low.length, 60) / 100;
    scored.push([sc, e]);
  }
  scored.sort((a, z) => a[0] - z[0]);
  const res: TitleEntry[] = [];
  const perOcc = new Map<number, number>();
  for (const [, e] of scored) {
    const c = perOcc.get(e.i) ?? 0;
    if (c >= 2) continue;
    perOcc.set(e.i, c + 1);
    res.push(e);
    if (res.length >= k) break;
  }
  return res;
}

export function exactTitle(b: Bundle, q: string): TitleEntry | undefined {
  const s = q.toLowerCase().trim();
  return titleEntries(b).find((e) => e.low === s);
}

// ---------------------------------------------------------------- curriculum vitae
const TITLE_WORDS =
  /\b(manager|engineer|analyst|executive|assistant|officer|clerk|teacher|nurse|developer|designer|consultant|technician|specialist|accountant|auditor|driver|operator|supervisor|coordinator|administrator|lecturer|tutor|intern|trainee|scientist|architect|writer|editor|director|head|chef|cook|cashier|receptionist|secretary|planner|advisor|adviser|representative|agent|associate|programmer|marketer|recruiter|pharmacist|doctor|lawyer|surveyor|mechanic|electrician|guard|cleaner|worker|guru|cikgu|kerani|jurutera|juruteknik|jururawat|pegawai|pembantu|pengurus|eksekutif|penyelia|pemandu|pensyarah|akauntan|peguam|operator|juruwang|setiausaha)\b/i;
const SECTION_START = /^(work\s+experience|professional\s+experience|experience|employment(\s+history)?|career\s+history|pengalaman(\s+kerja)?)\b/i;
const SECTION_END = /^(education|qualifications?|skills|projects|certifications?|awards|languages|references|pendidikan|kemahiran|rujukan|interests)\b/i;

export interface CvResult {
  titles: string[];
  hits: MatchHit[];
}

export function extractTitles(b: Bundle, text: string): string[] {
  const lines = text
    .split(/\r?\n|•|\s{3,}/)
    .map((l) => l.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean);
  const found: { t: string; w: number; order: number }[] = [];
  let inExp = false;
  lines.forEach((raw, order) => {
    if (SECTION_START.test(raw)) inExp = true;
    else if (SECTION_END.test(raw)) inExp = false;
    const line = raw.replace(/\b(19|20)\d{2}\b.*$/, '').replace(/[|:]+.*$/, '').trim();
    const words = line.split(' ').length;
    if (line.length < 3 || line.length > 70 || words > 9) return;
    const key = normTitle(line);
    let w = 0;
    if (b.matcher.verified[key] || b.matcher.malay[key]) w = 3;
    else if (exactTitle(b, line)) w = 2.5;
    else if (TITLE_WORDS.test(line) && !/[.;]$/.test(line) && !/@|www\.|http/i.test(line)) w = 1;
    if (!w) return;
    if (inExp) w *= 1.5;
    found.push({ t: line, w, order });
  });
  const uniq = new Map<string, { t: string; w: number; order: number }>();
  for (const f of found) {
    const k = f.t.toLowerCase();
    const prev = uniq.get(k);
    if (!prev || prev.w < f.w) uniq.set(k, f);
  }
  return Array.from(uniq.values())
    .sort((a, z) => z.w - a.w || a.order - z.order)
    .slice(0, 6)
    .map((f) => f.t);
}

/** Top candidate occupations for a CV: title lines weighted first, the whole text as a fallback. */
export function matchCv(b: Bundle, text: string, k = 5): CvResult {
  const titles = extractTitles(b, text);
  const agg = new Map<number, { s: number; path: MatchPath }>();
  const bump = (h: MatchHit, w: number) => {
    const cur = agg.get(h.i) ?? { s: 0, path: h.path };
    cur.s += h.score * w;
    if (h.path !== 'lexical') cur.path = h.path;
    agg.set(h.i, cur);
  };
  titles.forEach((t, r) => {
    const w = 1 / (1 + r * 0.35);
    matchForApp(b, t, 3).forEach((h, q) => bump(h, w * (q === 0 ? 1 : 0.5)));
  });
  matchLexical(b, text.slice(0, 20000), 5).forEach((h) => bump(h, titles.length ? 0.6 : 1));
  const arr = Array.from(agg.entries()).sort((a, z) => z[1].s - a[1].s);
  const max = arr.length ? arr[0][1].s : 1;
  return {
    titles,
    hits: arr.slice(0, k).map(([i, v]) => ({ i, score: max > 0 ? v.s / max : 0, path: v.path })),
  };
}
