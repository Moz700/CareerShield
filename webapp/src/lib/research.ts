// User study: blinded within-subjects comparison of three advice policies (conventional, v1, v2).
// Each participant rates the top-three list of every policy for their own occupation. Lists are
// labelled A, B and C in presentation order; the order follows one of six sequences (all
// permutations), so position and policy are counterbalanced across participants. SUS is asked once,
// for the app as a whole. Responses stay in this browser (localStorage) until the researcher exports
// them. Nothing is sent anywhere.
import type { Bundle } from './data';
import type { MatchPath } from './matcher';
import { topThree, PolicyKey } from './ranking';
import { readStore, writeStore } from './storage';
import { VERSION } from '../config';

export const STORE_KEY = 'cs.study.sessions';
export const ACTIVE_KEY = 'cs.study.active';
export const SCHEMA = 2;

export const POLICIES: PolicyKey[] = ['CONV', 'v1', 'v2'];
export const LABELS = ['A', 'B', 'C'] as const;
export type Label = (typeof LABELS)[number];

/** The six presentation sequences. Sequence k is used for participant codes ending in k (mod 6). */
export const SEQUENCES: PolicyKey[][] = [
  ['CONV', 'v1', 'v2'],
  ['CONV', 'v2', 'v1'],
  ['v1', 'CONV', 'v2'],
  ['v1', 'v2', 'CONV'],
  ['v2', 'CONV', 'v1'],
  ['v2', 'v1', 'CONV'],
];

/** Per-list items, 7-point agreement. fit1-3 adapt ResQue perceived accuracy (Pu, Chen and Hu, 2011). */
export const ITEM_IDS = ['fit1', 'fit2', 'fit3', 'attract', 'feasible', 'trust1', 'trust2'] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export type Step = 'consent' | 'occupation' | 'list0' | 'list1' | 'list2' | 'choice' | 'sus' | 'about' | 'done';
export const STEPS: Step[] = ['consent', 'occupation', 'list0', 'list1', 'list2', 'choice', 'sus', 'about', 'done'];

export interface ListRecord {
  label: Label;
  position: number; // 1, 2 or 3
  policy: PolicyKey;
  items: string[]; // O*NET-SOC codes of the three destinations, in rank order
  titles: string[];
  ratings: Record<ItemId, number | null>;
  comment: string;
  shownAt: string | null;
  ratedAt: string | null;
}

export interface About {
  ageBand: string;
  sector: string;
  education: string;
  years: string;
}

export interface Session {
  schema: number;
  id: string;
  participant: string;
  lang: string;
  appVersion: string;
  dataBuilt: string;
  consentAt: string | null;
  startedAt: string;
  completedAt: string | null;
  step: Step;
  occupation: { soc: string; title: string; query: string; path: MatchPath | null } | null;
  sequence: number | null;
  sequenceSource: 'code' | 'random' | null;
  order: PolicyKey[];
  identicalV1V2: boolean | null;
  overlapV1V2: number | null; // destinations shared by the v1 and v2 top three (0 to 3)
  lists: ListRecord[];
  choice: Label | null;
  sus: (number | null)[];
  about: About;
}

export function susScore(r: (number | null)[]): number | null {
  if (r.length !== 10 || r.some((x) => x == null)) return null;
  let s = 0;
  r.forEach((v, k) => {
    s += k % 2 === 0 ? (v as number) - 1 : 5 - (v as number);
  });
  return s * 2.5;
}

export function mean(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, z) => a + z, 0) / v.length : null;
}

export function newSession(lang: string, participant: string, dataBuilt: string): Session {
  const id = 'S' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    schema: SCHEMA,
    id,
    participant,
    lang,
    appVersion: VERSION,
    dataBuilt,
    consentAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    step: 'occupation',
    occupation: null,
    sequence: null,
    sequenceSource: null,
    order: [],
    identicalV1V2: null,
    overlapV1V2: null,
    lists: [],
    choice: null,
    sus: new Array(10).fill(null),
    about: { ageBand: '', sector: '', education: '', years: '' },
  };
}

/** Sequence from the participant code (trailing digits mod 6), otherwise random. */
export function pickSequence(code: string): { sequence: number; source: 'code' | 'random' } {
  const m = code.match(/(\d+)\s*$/);
  if (m) return { sequence: parseInt(m[1], 10) % 6, source: 'code' };
  return { sequence: Math.floor(Math.random() * 6), source: 'random' };
}

/** Builds the three blinded lists for an occupation in the session's presentation order. */
export function buildLists(b: Bundle, origin: number, sequence: number): Pick<Session, 'order' | 'identicalV1V2' | 'overlapV1V2' | 'lists'> {
  const top = topThree(b, origin);
  const order = SEQUENCES[sequence];
  const lists: ListRecord[] = order.map((policy, k) => ({
    label: LABELS[k],
    position: k + 1,
    policy,
    items: top[policy].map((j) => b.occ[j].soc),
    titles: top[policy].map((j) => b.occ[j].title),
    ratings: Object.fromEntries(ITEM_IDS.map((id) => [id, null])) as Record<ItemId, number | null>,
    comment: '',
    shownAt: null,
    ratedAt: null,
  }));
  const v2 = new Set(top.v2);
  return {
    order,
    identicalV1V2: top.v1.length > 0 && top.v1.join() === top.v2.join(),
    overlapV1V2: top.v1.filter((j) => v2.has(j)).length,
    lists,
  };
}

export const loadSessions = () => readStore<Session[]>(STORE_KEY, []).filter((s) => s && s.schema === SCHEMA);
export const saveSessions = (s: Session[]) => writeStore(STORE_KEY, s);

export function upsertSession(s: Session) {
  const all = loadSessions();
  const k = all.findIndex((x) => x.id === s.id);
  if (k >= 0) all[k] = s;
  else all.push(s);
  return saveSessions(all);
}

// ------------------------------------------------------------------ export

function csvCell(v: unknown) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const ABOUT_KEYS: (keyof About)[] = ['ageBand', 'sector', 'education', 'years'];

/** Column names of the wide export (one row per session). The researcher view reads this format. */
export function wideHeader(): string[] {
  const h = ['session_id', 'participant', 'lang', 'app_version', 'data_built', 'consent_at', 'started_at', 'completed_at', 'occupation_soc', 'occupation_title', 'occupation_query', 'match_path', 'sequence', 'sequence_source', 'order', 'identical_v1_v2', 'overlap_v1_v2'];
  for (const p of POLICIES) {
    h.push(`${p}_label`, `${p}_position`, `${p}_items`);
    ITEM_IDS.forEach((id) => h.push(`${p}_${id}`));
    h.push(`${p}_fit`, `${p}_trust`, `${p}_comment`);
  }
  h.push('choice_label', 'choice_policy');
  for (let k = 1; k <= 10; k++) h.push(`sus${k}`);
  h.push('sus_score', 'age_band', 'sector', 'education', 'years_in_occupation');
  return h;
}

export function fitScore(l: ListRecord): number | null {
  const v = [l.ratings.fit1, l.ratings.fit2, l.ratings.fit3];
  return v.some((x) => x == null) ? null : (mean(v) as number);
}
export function trustScore(l: ListRecord): number | null {
  const v = [l.ratings.trust1, l.ratings.trust2];
  return v.some((x) => x == null) ? null : (mean(v) as number);
}
const r2 = (x: number | null) => (x == null ? null : Math.round(x * 1000) / 1000);

export function toWideCsv(sessions: Session[]): string {
  const rows = sessions.map((s) => {
    const r: unknown[] = [s.id, s.participant, s.lang, s.appVersion, s.dataBuilt, s.consentAt, s.startedAt, s.completedAt, s.occupation?.soc, s.occupation?.title, s.occupation?.query, s.occupation?.path, s.sequence, s.sequenceSource, s.order.join('>'), s.identicalV1V2, s.overlapV1V2];
    for (const p of POLICIES) {
      const l = s.lists.find((x) => x.policy === p);
      r.push(l?.label, l?.position, l?.items.join(';'));
      ITEM_IDS.forEach((id) => r.push(l?.ratings[id]));
      r.push(l ? r2(fitScore(l)) : null, l ? r2(trustScore(l)) : null, l?.comment);
    }
    const chosen = s.lists.find((x) => x.label === s.choice);
    r.push(s.choice, chosen?.policy);
    s.sus.forEach((v) => r.push(v));
    r.push(susScore(s.sus));
    ABOUT_KEYS.forEach((k) => r.push(s.about[k]));
    return r.map(csvCell).join(',');
  });
  return [wideHeader().join(','), ...rows].join('\n');
}

/** Long export: one row per participant and list, ready for a mixed model (rating ~ policy + position + (1 | participant)). */
export function toLongCsv(sessions: Session[]): string {
  const head = ['session_id', 'participant', 'occupation_soc', 'sequence', 'identical_v1_v2', 'policy', 'label', 'position', 'items', ...ITEM_IDS, 'fit', 'trust', 'chosen', 'comment'];
  const rows: string[] = [];
  for (const s of sessions)
    for (const l of s.lists)
      rows.push(
        [s.id, s.participant, s.occupation?.soc, s.sequence, s.identicalV1V2, l.policy, l.label, l.position, l.items.join(';'), ...ITEM_IDS.map((id) => l.ratings[id]), r2(fitScore(l)), r2(trustScore(l)), s.choice === l.label ? 1 : 0, l.comment]
          .map(csvCell)
          .join(','),
      );
  return [head.join(','), ...rows].join('\n');
}

// ------------------------------------------------------------------ import and summary (researcher view)

export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((x) => x !== ''));
}

export type Row = Record<string, string>;

/** Rows of a wide export as objects; returns null when the header is not a CareerShield study export. */
export function readWide(text: string): Row[] | null {
  const t = parseCsv(text.replace(/^﻿/, ''));
  if (!t.length) return null;
  const h = t[0];
  if (!h.includes('session_id') || !h.includes('v2_fit')) return null;
  return t.slice(1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

export function sessionRows(sessions: Session[]): Row[] {
  return readWide(toWideCsv(sessions)) ?? [];
}

const num = (s: string | undefined) => (s == null || s === '' ? null : Number(s));

export interface Stat {
  n: number;
  mean: number | null;
  sd: number | null;
}
function stat(xs: (number | null)[]): Stat {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  if (!v.length) return { n: 0, mean: null, sd: null };
  const m = v.reduce((a, z) => a + z, 0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((a, z) => a + (z - m) ** 2, 0) / (v.length - 1)) : null;
  return { n: v.length, mean: m, sd };
}

export interface Summary {
  total: number;
  complete: number;
  bySequence: number[];
  identical: number;
  outcomes: Record<'fit' | 'attract' | 'feasible' | 'trust', Record<PolicyKey, Stat>>;
  choice: Record<PolicyKey, number>;
  sus: Stat;
  /** Paired v2 minus v1 perceived fit: all complete sessions, and only those where the lists differ. */
  paired: { all: Stat & { lo: number | null; hi: number | null }; differ: Stat & { lo: number | null; hi: number | null } };
}

// two-sided 95% t quantiles for small samples, normal beyond
const T95 = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
function withCi(s: Stat) {
  if (s.mean == null || s.sd == null || s.n < 2) return { ...s, lo: null, hi: null };
  const df = s.n - 1;
  const q = df < T95.length ? T95[df] : df < 60 ? 2.0 : 1.96;
  const h = (q * s.sd) / Math.sqrt(s.n);
  return { ...s, lo: s.mean - h, hi: s.mean + h };
}

/** Rows from several imported files, de-duplicated by session id (the later copy wins). */
export function mergeRows(files: Row[][]): Row[] {
  const m = new Map<string, Row>();
  files.flat().forEach((r) => r.session_id && m.set(r.session_id, r));
  return Array.from(m.values());
}

export function summarise(rows: Row[]): Summary {
  const done = rows.filter((r) => r.completed_at);
  const outcomes = {} as Summary['outcomes'];
  for (const o of ['fit', 'attract', 'feasible', 'trust'] as const) {
    outcomes[o] = {} as Record<PolicyKey, Stat>;
    for (const p of POLICIES) outcomes[o][p] = stat(done.map((r) => num(r[`${p}_${o}`])));
  }
  const choice = { CONV: 0, v1: 0, v2: 0 } as Record<PolicyKey, number>;
  done.forEach((r) => {
    const p = r.choice_policy as PolicyKey;
    if (p in choice) choice[p]++;
  });
  const bySequence = [0, 0, 0, 0, 0, 0];
  done.forEach((r) => {
    const k = num(r.sequence);
    if (k != null && k >= 0 && k < 6) bySequence[k]++;
  });
  const diff = (rs: Row[]) => rs.map((r) => (num(r.v2_fit) != null && num(r.v1_fit) != null ? (num(r.v2_fit) as number) - (num(r.v1_fit) as number) : null));
  return {
    total: rows.length,
    complete: done.length,
    bySequence,
    identical: done.filter((r) => r.identical_v1_v2 === 'true').length,
    outcomes,
    choice,
    sus: stat(done.map((r) => num(r.sus_score))),
    paired: { all: withCi(stat(diff(done))), differ: withCi(stat(diff(done.filter((r) => r.identical_v1_v2 !== 'true')))) },
  };
}
