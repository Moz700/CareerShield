// Data bundle: types, loading and derived structures shared by every page.

export interface OccupationsFile {
  soc: string[];
  soc6: string[];
  title: string[];
  exp: (number | null)[];
  pctl: (number | null)[];
  aioe: (number | null)[];
  gpt: (number | null)[];
  lm: (number | null)[];
  isco4: (number | null)[];
  iscoTitle: (string | null)[];
  isco1: (number | null)[];
  jz: number[];
  nUs: (number | null)[];
  nMy: (number | null)[];
  sal: (number | null)[];
  salObs: number[];
  rmN: (number | null)[];
  dem: number[];
  demMy: (number | null)[];
  demUs: (number | null)[];
  tier: (string | null)[];
  moat: (number | null)[];
  evid: number[];
  dec: number[];
  trend: (number | null)[];
  emp24: (number | null)[];
  ms: (number | null)[];
  related: number[][];
  conv: (number | null)[];
  v2: (number[] | null)[];
  v2kind: (string | null)[];
  inSample: number[];
  convList: (number[] | null)[];
  inConv: number[];
  inV1: number[];
  inV2: number[];
}

/** O*NET occupation descriptions, in occupation order; kept apart because few views show them. */
export interface DescriptionsFile {
  desc: string[];
}

export interface SkillsFile {
  elements: string[];
  family: ('ability' | 'knowledge' | 'skill')[];
  abilityExposure: (number | null)[];
  abilityFamily: (string | null)[];
  /** importance x 1000 = impBase + impStep * value, element-major (all occupations per element) */
  impLayout: 'element-major';
  impBase: number;
  impStep: number;
  importance: number[];
}

export interface MatcherFile {
  alt: string[][];
  jt: string[][];
  tasks: string[][];
  verified: Record<string, [number, string]>;
  approx: Record<string, string>;
  malay: Record<string, [number, string]>;
}

export type CourseRec = (number | null)[];
export interface CoursesFile {
  method: string;
  public: boolean;
  elatihMode: 'none' | 'full';
  coursera: string[][];
  elatih: string[][];
  byOcc: Record<string, CourseRec>[];
  minRel: number;
  myBonus: number;
  kGaps: number;
}

export interface PolicyRow {
  policy: string;
  exp: number;
  dem: number;
  sim: number;
  ms: number;
  emp: number;
  wage: number;
  distinct: number;
  top10: number;
  maxN: number;
  maxTitle: string;
  top10w: number;
  noPost: number;
  declined: number;
}

export interface EvidenceFile {
  policies: PolicyRow[];
  curves: Record<string, number[]>;
  forest: Record<string, { policy: string; diff: number; lo: number; hi: number }[]>;
  capacity: { k: number; top10: number; msReduction: number; distinct: number }[];
  headline: {
    nOrigins: number;
    nClusters: number;
    capK: number;
    msConv: number;
    msV1: number;
    msV2: number;
    v1VsConv: number[];
    v2VsConv: number[];
    v1VsBlind: number[];
    empV1VsConv: number[];
    wageV1VsConv: number[];
    relChangeV1: number;
    relChangeV2: number;
    shareKept: number;
    shareLowerV1: number;
    top10: Record<string, number>;
    topDest: { title: string; n_origins: number; emp_2015: number; emp_2019: number; emp_2024: number; exposure_pctl: number; origin_workers: number };
    convergentRho: number;
    convergentN: number;
    transferV1Blind: number[];
  };
  capstone: any;
}

export interface MetaFile {
  built: string;
  public: boolean;
  courseMethod: string;
  nOccupations: number;
  ability: {
    source: 'published' | 'reconstructed';
    fit_r2: number | null;
    n_scored: number;
    n_resistant: number;
    resistant_by_family: Record<string, number>;
    occupations_with_moat: number;
    occupations_without_moat: number;
  };
  reproduction: Record<string, { top10_share: number; published: number; largest_group: number; distinct: number }>;
  nMalayTitles: number;
  nVerifiedTitles: number;
  elatihMode: 'none' | 'full';
  iscoNames: Record<string, string>;
}

export interface Occupation {
  i: number;
  soc: string;
  soc6: string;
  title: string;
  /** empty until loadBundle(['desc']) has run */
  desc: string;
  exp: number | null;
  pctl: number | null;
  aioe: number | null;
  gpt: number | null;
  lm: number | null;
  isco4: number | null;
  iscoTitle: string | null;
  isco1: number | null;
  jz: number;
  nUs: number | null;
  nMy: number | null;
  sal: number | null;
  salObs: boolean;
  rmN: number | null;
  dem: number;
  demMy: number | null;
  demUs: number | null;
  tier: string | null;
  moat: number | null;
  evid: boolean;
  dec: boolean;
  trend: number | null;
  emp24: number | null;
  ms: number | null;
  related: number[];
  conv: number | null;
  v2: number[] | null;
  v2kind: string | null;
  inSample: boolean;
  convList: number[];
  inflow: { CONV: number; v1: number; v2: number };
}

export interface Bundle {
  occ: Occupation[];
  skills: SkillsFile;
  nEl: number;
  imp: Float64Array; // importance, occupation-major (n x nEl)
  unit: Float64Array; // centred, unit-length skill profiles for cosine similarity
  matcher: MatcherFile;
  courses: CoursesFile;
  evidence: EvidenceFile;
  meta: MetaFile;
  pctlRank: { aioe: number[]; gpt: number[]; lm: number[] };
  hasDesc: boolean;
}

function pctRank(vals: (number | null)[]): number[] {
  const idx = vals.map((v, i) => [v, i] as [number | null, number]).filter((x) => x[0] != null) as [number, number][];
  idx.sort((a, b) => a[0] - b[0]);
  const out = new Array(vals.length).fill(NaN);
  let k = 0;
  while (k < idx.length) {
    let j = k;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[k][0]) j++;
    const r = ((k + j) / 2 + 1) / idx.length;
    for (let q = k; q <= j; q++) out[idx[q][1]] = r * 100;
    k = j + 1;
  }
  return out;
}

// The core files (occupations, evidence, meta) load first. The skill profiles, the title matcher,
// the course index and the occupation descriptions load only where they are used.
export type Part = 'matcher' | 'courses' | 'skills' | 'desc';
let cached: Promise<Bundle> | null = null;
const parts: Partial<Record<Part, Promise<void>>> = {};

function loadPart(b: Bundle, p: Part): Promise<void> {
  if (!parts[p]) {
    parts[p] =
      p === 'matcher'
        ? import('../data/matcher.json').then((m) => {
            b.matcher = m.default as unknown as MatcherFile;
          })
        : p === 'courses'
          ? import('../data/courses.json').then((m) => {
              b.courses = m.default as unknown as CoursesFile;
            })
          : p === 'desc'
            ? import('../data/descriptions.json').then((m) => {
                const d = (m.default as unknown as DescriptionsFile).desc;
                for (const o of b.occ) o.desc = d[o.i] ?? '';
                b.hasDesc = true;
              })
            : import('../data/skills.json').then((m) => attachSkills(b, m.default as unknown as SkillsFile));
    parts[p]!.catch(() => {
      delete parts[p];
    });
  }
  return parts[p]!;
}

export function hasParts(b: Bundle | null, need: Part[]): boolean {
  return !!b && need.every((p) => (p === 'matcher' ? !!b.matcher : p === 'courses' ? !!b.courses : p === 'desc' ? b.hasDesc : !!b.skills));
}

export function loadBundle(need: Part[] = []): Promise<Bundle> {
  if (!cached) {
    cached = loadCore();
    cached.catch(() => {
      cached = null;
    });
  }
  return cached.then(async (b) => {
    await Promise.all(need.map((p) => loadPart(b, p)));
    return b;
  });
}

/** Skill importance, and centred unit-length profiles for cosine similarity. */
function attachSkills(b: Bundle, skills: SkillsFile) {
  const n = b.occ.length;
  const nEl = skills.elements.length;
  const imp = new Float64Array(n * nEl);
  const { impBase, impStep, importance: q } = skills;
  for (let j = 0; j < nEl; j++) for (let i = 0; i < n; i++) imp[i * nEl + j] = (impBase + impStep * q[j * n + i]) / 1000;
  // centre each element on its mean across occupations, then scale each profile to unit length
  const mean = new Float64Array(nEl);
  for (let i = 0; i < n; i++) for (let j = 0; j < nEl; j++) mean[j] += imp[i * nEl + j];
  for (let j = 0; j < nEl; j++) mean[j] /= n;
  const unit = new Float64Array(n * nEl);
  for (let i = 0; i < n; i++) {
    let ss = 0;
    for (let j = 0; j < nEl; j++) {
      const v = imp[i * nEl + j] - mean[j];
      unit[i * nEl + j] = v;
      ss += v * v;
    }
    const nr = Math.sqrt(ss) || 1;
    for (let j = 0; j < nEl; j++) unit[i * nEl + j] /= nr;
  }
  b.nEl = nEl;
  b.imp = imp;
  b.unit = unit;
  b.skills = skills;
}

function loadCore(): Promise<Bundle> {
  return (async () => {
    const [o, e, me] = await Promise.all([
      import('../data/occupations.json'),
      import('../data/evidence.json'),
      import('../data/meta.json'),
    ]);
    const of = o.default as unknown as OccupationsFile;
    const n = of.soc.length;
    const occ: Occupation[] = new Array(n);
    for (let i = 0; i < n; i++) {
      occ[i] = {
        i,
        soc: of.soc[i],
        soc6: of.soc6[i],
        title: of.title[i],
        desc: '',
        exp: of.exp[i],
        pctl: of.pctl[i],
        aioe: of.aioe[i],
        gpt: of.gpt[i],
        lm: of.lm[i],
        isco4: of.isco4[i],
        iscoTitle: of.iscoTitle[i],
        isco1: of.isco1[i],
        jz: of.jz[i],
        nUs: of.nUs[i],
        nMy: of.nMy[i],
        sal: of.sal[i],
        salObs: of.salObs[i] === 1,
        rmN: of.rmN[i],
        dem: of.dem[i],
        demMy: of.demMy[i],
        demUs: of.demUs[i],
        tier: of.tier[i],
        moat: of.moat[i],
        evid: of.evid[i] === 1,
        dec: of.dec[i] === 1,
        trend: of.trend[i],
        emp24: of.emp24[i],
        ms: of.ms[i],
        related: of.related[i],
        conv: of.conv[i],
        v2: of.v2[i],
        v2kind: of.v2kind[i],
        inSample: of.inSample[i] === 1,
        convList: of.convList[i] ?? [],
        inflow: { CONV: of.inConv[i], v1: of.inV1[i], v2: of.inV2[i] },
      };
    }
    return {
      occ,
      // filled by loadBundle(['skills'])
      skills: undefined as unknown as SkillsFile,
      nEl: 0,
      imp: new Float64Array(0),
      unit: new Float64Array(0),
      matcher: undefined as unknown as MatcherFile, // filled by loadBundle(['matcher'])
      courses: undefined as unknown as CoursesFile, // filled by loadBundle(['courses'])
      evidence: e.default as unknown as EvidenceFile,
      meta: me.default as unknown as MetaFile,
      pctlRank: { aioe: pctRank(of.aioe), gpt: pctRank(of.gpt), lm: pctRank(of.lm) },
      hasDesc: false, // set by loadBundle(['desc'])
    };
  })();
}

export function similarity(b: Bundle, i: number, j: number): number {
  const n = b.nEl;
  let s = 0;
  for (let k = 0; k < n; k++) s += b.unit[i * n + k] * b.unit[j * n + k];
  return s;
}

export function importance(b: Bundle, i: number, j: number): number {
  return b.imp[i * b.nEl + j];
}
