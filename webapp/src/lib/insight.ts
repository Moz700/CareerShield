// Ability cards, skill gaps and course matches (paper Section 3.4; capstone sections 7.4 and 7.7).
import { Bundle, importance } from './data';

export interface AbilityCard {
  name: string;
  family: string | null;
  importance: number; // 1 to 5
  exposure: number; // standardised ability-level AI exposure
  driver: number;
}

export const MOAT_MIN_IMPORTANCE = 3.0;

function abilities(b: Bundle, i: number): AbilityCard[] {
  const out: AbilityCard[] = [];
  b.skills.elements.forEach((name, j) => {
    const e = b.skills.abilityExposure[j];
    if (b.skills.family[j] !== 'ability' || e == null) return;
    const imp = importance(b, i, j);
    out.push({ name, family: b.skills.abilityFamily[j], importance: imp, exposure: e, driver: (imp / 5) * e });
  });
  return out;
}

/** Abilities pushing exposure up: positive ability exposure, ranked by importance-weighted exposure. */
export function riskCards(b: Bundle, i: number, k = 5): AbilityCard[] {
  return abilities(b, i)
    .filter((a) => a.exposure > 0)
    .sort((a, z) => z.driver - a.driver)
    .slice(0, k);
}

/** Important abilities (rated 3 or more) that AI is measurably weak at: negative ability exposure. */
export function moatCards(b: Bundle, i: number, k = 3): AbilityCard[] {
  return abilities(b, i)
    .filter((a) => a.importance >= MOAT_MIN_IMPORTANCE && a.exposure < 0)
    .sort((a, z) => z.importance - a.importance)
    .slice(0, k);
}

export interface Gap {
  element: string;
  j: number;
  from: number;
  to: number;
  score: number;
}

/** Teachable elements the destination needs more of than the origin (destination importance 3 or more). */
export function skillGaps(b: Bundle, cur: number, tgt: number, k = 5): Gap[] {
  const gaps: Gap[] = [];
  b.skills.elements.forEach((element, j) => {
    if (b.skills.family[j] === 'ability') return;
    const t = importance(b, tgt, j);
    const c = importance(b, cur, j);
    if (t < 3.0) return;
    const g = (t - c) * (t / 5);
    if (g > 0) gaps.push({ element, j, from: c, to: t, score: g });
  });
  gaps.sort((a, z) => z.score - a.score);
  return gaps.slice(0, k);
}

export interface CourseHit {
  source: 'elatih' | 'coursera';
  name: string;
  provider: string;
  url: string;
  extra: string;
  relevance: number;
}

export interface GapCourses {
  gap: Gap;
  primary: CourseHit | null;
  alternatives: CourseHit[];
}

function hit(b: Bundle, source: 'elatih' | 'coursera', idx: number | null, score: number | null): CourseHit | null {
  if (idx == null || score == null) return null;
  const row = source === 'elatih' ? b.courses.elatih[idx] : b.courses.coursera[idx];
  if (!row) return null;
  if (source === 'elatih') return { source, name: row[0], provider: 'HRD Corp e-LATiH', url: row[1], extra: row[2] ?? '', relevance: score };
  return { source, name: row[0], provider: row[1], url: row[2], extra: row[3], relevance: score };
}

/**
 * Courses for each gap. The primary pick follows the original rule: the best e-LATiH course is taken
 * when its relevance plus a 0.05 local preference clears 0.10 and beats the best Coursera course;
 * otherwise the best Coursera course if it clears 0.10. Alternatives list the other close matches.
 */
export function coursesFor(b: Bundle, cur: number, tgt: number, k = 5): GapCourses[] {
  const { minRel, myBonus } = b.courses;
  const seen = new Set<string>();
  return skillGaps(b, cur, tgt, k).map((gap) => {
    const r = b.courses.byOcc[tgt]?.[String(gap.j)];
    if (!r) return { gap, primary: null, alternatives: [] };
    const cr1 = hit(b, 'coursera', r[0], r[1]);
    const cr2 = hit(b, 'coursera', r[2], r[3]);
    const my1 = r.length > 4 ? hit(b, 'elatih', r[4], r[5]) : null;
    const my2 = r.length > 4 ? hit(b, 'elatih', r[6], r[7]) : null;
    let primary: CourseHit | null = null;
    const bestMy = my1 ? my1.relevance + myBonus : -1;
    const bestCr = cr1 ? cr1.relevance : -1;
    if (my1 && bestMy >= minRel && bestMy >= bestCr) primary = my1;
    else if (cr1 && bestCr >= minRel) primary = cr1;
    if (primary && seen.has(primary.url)) primary = [my2, cr2].find((x) => x && x.relevance >= minRel && !seen.has(x.url)) ?? primary;
    if (primary) seen.add(primary.url);
    const alternatives = [my1, my2, cr1, cr2]
      .filter((x): x is CourseHit => !!x && x.relevance >= minRel && x.url !== primary?.url)
      .sort((a, z) => (a.source === z.source ? z.relevance - a.relevance : a.source === 'elatih' ? -1 : 1));
    return { gap, primary, alternatives };
  });
}

export type Band = 'low' | 'moderate' | 'high';
export function band(p: number | null): Band {
  if (p == null) return 'moderate';
  return p >= 70 ? 'high' : p >= 40 ? 'moderate' : 'low';
}
