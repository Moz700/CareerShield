// CareerShield destination ranking.
// v1: candidate set and four min-max normalised criteria per origin, weighted 0.45/0.25/0.15/0.15
//     (paper Section 3.4). Same arithmetic as build_cache/rank in the evaluation code.
// v2: posting-coverage and trajectory guards plus a cap of 8 origins per destination, computed
//     jointly for all origins by deferred acceptance at build time (paper Section 3.7).
import { Bundle, similarity } from './data';

export type Weights = [number, number, number, number];
export const W_V1: Weights = [0.45, 0.25, 0.15, 0.15];

export interface Candidate {
  j: number; // destination index
  sim: number; // raw skill similarity
  red: number; // exposure reduction in percentile points (floored at zero)
  dem: number; // destination demand percentile
  ratio: number; // salary retention ratio, capped at 1.5, 0.7 where missing
  norm: [number, number, number, number];
}

export interface CandidateSet {
  origin: number;
  cands: Candidate[];
}

const famCache = new WeakMap<Bundle, Map<string, number[]>>();
function families(b: Bundle) {
  let f = famCache.get(b);
  if (!f) {
    f = new Map();
    b.occ.forEach((o) => {
      const k = o.soc.slice(0, 2);
      if (!f!.has(k)) f!.set(k, []);
      f!.get(k)!.push(o.i);
    });
    famCache.set(b, f);
  }
  return f;
}

let medianSal: number | null = null;
function nanMedian(xs: number[]) {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const h = Math.floor(v.length / 2);
  return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
}

function minmax(v: number[]): number[] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of v) {
    if (Number.isFinite(x)) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  const r = hi - lo;
  if (!(r > 0)) return v.map(() => 0.5);
  return v.map((x) => (x - lo) / r);
}

const setCache = new Map<number, CandidateSet>();

export function candidateSet(b: Bundle, i: number): CandidateSet {
  const hit = setCache.get(i);
  if (hit) return hit;
  const o = b.occ[i];
  const cand = new Set<number>(families(b).get(o.soc.slice(0, 2)) ?? []);
  for (const r of o.related) cand.add(r);
  let c = Array.from(cand).sort((a, z) => a - z);
  c = c.filter((j) => b.occ[j].soc6 !== o.soc6 && Math.abs(b.occ[j].jz - o.jz) <= 1 && b.occ[j].pctl != null);
  if (!c.length) {
    const empty = { origin: i, cands: [] };
    setCache.set(i, empty);
    return empty;
  }
  if (medianSal == null) medianSal = nanMedian(b.occ.map((x) => x.sal ?? NaN));
  let cur = o.sal != null && Number.isFinite(o.sal) ? o.sal : nanMedian(c.map((j) => b.occ[j].sal ?? NaN));
  if (!Number.isFinite(cur) || cur <= 0) cur = medianSal;
  const sim = c.map((j) => similarity(b, i, j));
  const op = o.pctl;
  const red = c.map((j) => (op == null ? NaN : Math.max(op - (b.occ[j].pctl as number), 0)));
  const dem = c.map((j) => b.occ[j].dem);
  const ratio = c.map((j) => {
    const s = b.occ[j].sal;
    if (s == null || !Number.isFinite(s)) return 0.7;
    return Math.min(Math.max(s / cur, 0), 1.5);
  });
  const n0 = minmax(sim);
  const n1 = minmax(red);
  const n2 = minmax(dem);
  const n3 = minmax(ratio);
  // keep the first O*NET code of each SOC-6 (candidates are in code order)
  const seen = new Set<string>();
  const cands: Candidate[] = [];
  c.forEach((j, k) => {
    const s6 = b.occ[j].soc6;
    if (seen.has(s6)) return;
    seen.add(s6);
    cands.push({ j, sim: sim[k], red: Number.isFinite(red[k]) ? red[k] : 0, dem: dem[k], ratio: ratio[k], norm: [n0[k], n1[k], n2[k], n3[k]] });
  });
  const out = { origin: i, cands };
  setCache.set(i, out);
  return out;
}

export interface Ranked extends Candidate {
  score: number;
}

/** v1 ranking under any weight vector, best first (stable on ties). Optional data guards. */
export function rankV1(b: Bundle, i: number, w: Weights = W_V1, guards = false): Ranked[] {
  let cands = candidateSet(b, i).cands;
  if (guards && cands.length) {
    let keep = cands.map(() => true);
    if (cands.some((c) => b.occ[c.j].evid)) keep = cands.map((c) => b.occ[c.j].evid);
    const dec = cands.map((c) => b.occ[c.j].dec);
    if (cands.some((_, k) => !dec[k] && keep[k])) keep = keep.map((x, k) => x && !dec[k]);
    cands = cands.filter((_, k) => keep[k]);
  }
  const scored = cands.map((c, k) => ({ ...c, score: c.norm[0] * w[0] + c.norm[1] * w[1] + c.norm[2] * w[2] + c.norm[3] * w[3], k }));
  scored.sort((a, z) => z.score - a.score || a.k - z.k);
  return scored.map(({ k: _k, ...r }) => r);
}

/** v2 advice for one origin: the jointly planned first move, then guarded options with room left. */
export function rankV2(b: Bundle, i: number): Ranked[] {
  const list = b.occ[i].v2;
  if (!list) return [];
  const byJ = new Map(candidateSet(b, i).cands.map((c) => [c.j, c]));
  return list
    .map((j) => byJ.get(j))
    .filter((c): c is Candidate => !!c)
    .map((c) => ({ ...c, score: c.norm[0] * W_V1[0] + c.norm[1] * W_V1[1] + c.norm[2] * W_V1[2] + c.norm[3] * W_V1[3] }));
}

export function normaliseWeights(w: Weights): Weights {
  const s = w.reduce((a, z) => a + z, 0) || 1;
  return w.map((x) => x / s) as Weights;
}

/** Raw criteria for any origin and destination pair, including destinations outside the candidate set. */
export function pairMetrics(b: Bundle, i: number, j: number): Candidate {
  const hit = candidateSet(b, i).cands.find((c) => c.j === j);
  if (hit) return hit;
  const o = b.occ[i];
  const d = b.occ[j];
  if (medianSal == null) medianSal = nanMedian(b.occ.map((x) => x.sal ?? NaN));
  const cur = o.sal != null && o.sal > 0 ? o.sal : medianSal;
  return {
    j,
    sim: similarity(b, i, j),
    red: o.pctl != null && d.pctl != null ? Math.max(o.pctl - d.pctl, 0) : 0,
    dem: d.dem,
    ratio: d.sal != null ? Math.min(Math.max(d.sal / cur, 0), 1.5) : 0.7,
    norm: [NaN, NaN, NaN, NaN],
  };
}

/** Conventional advice: O*NET related occupations in O*NET's order; the first is the paper's CONV policy. */
export function rankConv(b: Bundle, i: number): Ranked[] {
  return b.occ[i].convList.map((j) => ({ ...pairMetrics(b, i, j), score: NaN }));
}

export type PolicyKey = 'v2' | 'v1' | 'CONV';

/** The list shown to the worker: v2 plan, the v1 ranking under the chosen weights, or conventional advice. */
export function movesFor(b: Bundle, i: number, policy: PolicyKey, w: Weights = W_V1): Ranked[] {
  if (policy === 'v2') {
    const r = rankV2(b, i);
    return r.length ? r : rankV1(b, i, W_V1, true);
  }
  if (policy === 'CONV') return rankConv(b, i);
  return rankV1(b, i, normaliseWeights(w));
}

/** Top-3 lists under the three policies with the paper's weights (used by the comparison and the study). */
export function topThree(b: Bundle, i: number): Record<PolicyKey, number[]> {
  return {
    CONV: rankConv(b, i).slice(0, 3).map((r) => r.j),
    v1: rankV1(b, i).slice(0, 3).map((r) => r.j),
    v2: movesFor(b, i, 'v2').slice(0, 3).map((r) => r.j),
  };
}

/** First recommendation of every origin in the paper's evaluation sample (820), under each policy. */
/**
 * The same as firstRecommendations, but yields to the browser between slices of origins so that
 * ranking all 820 of them never blocks input for long.
 */
export async function firstRecommendationsAsync(b: Bundle, slice = 40): Promise<{ origins: number[]; dest: Record<PolicyKey, number[]> }> {
  const origins = b.occ.filter((o) => o.inSample).map((o) => o.i);
  const v1: number[] = [];
  for (let k = 0; k < origins.length; k++) {
    v1.push(rankV1(b, origins[k])[0]?.j ?? -1);
    if (k % slice === slice - 1) await new Promise((r) => setTimeout(r, 0));
  }
  return {
    origins,
    dest: {
      CONV: origins.map((i) => b.occ[i].conv ?? -1),
      v1,
      v2: origins.map((i) => b.occ[i].v2?.[0] ?? -1),
    },
  };
}

export function firstRecommendations(b: Bundle): { origins: number[]; dest: Record<PolicyKey, number[]> } {
  const origins = b.occ.filter((o) => o.inSample).map((o) => o.i);
  return {
    origins,
    dest: {
      CONV: origins.map((i) => b.occ[i].conv ?? -1),
      v1: origins.map((i) => rankV1(b, i)[0]?.j ?? -1),
      v2: origins.map((i) => b.occ[i].v2?.[0] ?? -1),
    },
  };
}
