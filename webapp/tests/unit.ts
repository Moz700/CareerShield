// Unit checks run in Node (npx tsx tests/unit.ts): the browser ports of the ranking and the matcher
// against the Python build, title and CV matching, crowding counts, the study design and its
// exports, the numbers shown against the published results.json, and the translation tables.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle } from '../src/lib/data';
import { firstRecommendations, firstRecommendationsAsync, rankV1, topThree, movesFor } from '../src/lib/ranking';
import { matchCv, matchForApp, matchLexical, normTitle } from '../src/lib/matcher';
import { buildLists, parseCsv, pickSequence, readWide, SEQUENCES, summarise, toLongCsv, toWideCsv, newSession, ITEM_IDS, Session, susScore } from '../src/lib/research';
import { dicts, SUS } from '../src/i18n';

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, extra = '') {
  if (ok) pass++;
  else fails.push(name);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
}

const b = await loadBundle(['matcher', 'courses', 'skills', 'desc']);
const byTitle = (t: string) => b.occ.findIndex((o) => o.title === t);
const first = (q: string) => b.occ[matchForApp(b, q, 5)[0]?.i ?? 0]?.title;

// ---------------------------------------------------------------- ranking port
const v1 = JSON.parse(readFileSync('pipeline/checks/v1_top10.json', 'utf8')) as Record<string, number[]>;
let same = 0;
for (const [soc, ref] of Object.entries(v1)) {
  const i = b.occ.findIndex((o) => o.soc === soc);
  if (JSON.stringify(rankV1(b, i).slice(0, 10).map((r) => r.j)) === JSON.stringify(ref)) same++;
}
check('v1 ranking in the browser equals the paper code (top 10, every origin)', same === Object.keys(v1).length, `${same}/${Object.keys(v1).length}`);

let v2ok = 0;
let v2n = 0;
b.occ.forEach((o) => {
  if (!o.inSample || !o.v2) return;
  v2n++;
  if (movesFor(b, o.i, 'v2')[0]?.j === o.v2[0]) v2ok++;
});
check('v2 first move equals the joint plan from the paper code for all 820 origins', v2ok === v2n && v2n === 820, `${v2ok}/${v2n}`);
check('conventional first move equals the paper CONV policy', b.occ.every((o) => o.conv == null || o.convList[0] === o.conv));

// ---------------------------------------------------------------- crowding
for (const k of ['CONV', 'v1', 'v2'] as const) {
  const seen = new Map<string, number>();
  b.occ.forEach((o) => seen.set(o.soc6, o.inflow[k]));
  const total = Array.from(seen.values()).reduce((a, z) => a + z, 0);
  check(`inflow counts for ${k} sum to 820`, total === 820, String(total));
}
const fr = firstRecommendations(b);
for (const k of ['CONV', 'v1', 'v2'] as const) {
  const n = new Map<string, number>();
  fr.dest[k].forEach((j) => n.set(b.occ[j].soc6, (n.get(b.occ[j].soc6) ?? 0) + 1));
  const top = Array.from(n.values()).sort((a, z) => z - a).slice(0, 10).reduce((a, z) => a + z, 0);
  const share = Math.round((top / fr.origins.length) * 1000) / 10;
  check(`home crowding chart: top-10 share for ${k} equals the paper`, share === b.evidence.headline.top10[k], `${share}%`);
}
const frAsync = await firstRecommendationsAsync(b, 7);
check('sliced first recommendations equal the one-pass ones', (['CONV', 'v1', 'v2'] as const).every((k) => frAsync.dest[k].join() === fr.dest[k].join()));
const pressers = b.occ[byTitle('Pressers, Textile, Garment, and Related Materials')];
check('v1 sends 45 origins to Pressers', pressers.inflow.v1 === 45);
check('v2 never sends more than 8 origins to one destination', b.occ.every((o) => o.inflow.v2 <= 8));

// ---------------------------------------------------------------- matcher
check('descriptions load as their own part', b.hasDesc && b.occ.every((o) => typeof o.desc === 'string') && b.occ.filter((o) => o.desc).length > 800);
const probe = JSON.parse(readFileSync('pipeline/checks/matcher_probe.json', 'utf8')) as Record<string, [number, number][]>;
for (const [q, ref] of Object.entries(probe)) {
  const got = matchLexical(b, q, 5).map((h) => h.i);
  check(`lexical index equals the Python build: "${q}"`, JSON.stringify(got) === JSON.stringify(ref.map((r) => r[0])));
}
for (const [q, want] of [
  ['accountant', 'Accountants and Auditors'],
  ['Senior Accountant', 'Accountants and Auditors'],
  ['data analyst', 'Business Intelligence Analysts'],
  ['data scientist', 'Statisticians'],
  ['kerani', 'Office Clerks, General'],
  ['Kerani Akaun', 'Bookkeeping, Accounting, and Auditing Clerks'],
  ['cikgu', 'Elementary School Teachers, Except Special Education'],
  ['jururawat', 'Registered Nurses'],
  ['peguam', 'Lawyers'],
  ['lorry driver', 'Heavy and Tractor-Trailer Truck Drivers'],
]) {
  const got = first(q);
  check(`title "${q}"`, got === want, got);
}
let dictOk = 0;
const dict = Object.entries(b.matcher.malay);
for (const [, [i, label]] of dict) if (matchForApp(b, label, 1)[0]?.i === i) dictOk++;
check('every Malaysian dictionary title resolves to its own occupation', dictOk === dict.length, `${dictOk}/${dict.length}`);
let verOk = 0;
const ver = Object.entries(b.matcher.verified);
for (const [, [i, label]] of ver) if (matchForApp(b, label, 1)[0]?.i === i) verOk++;
check('every hand-verified title resolves to its own occupation', verOk === ver.length, `${verOk}/${ver.length}`);
check('title normaliser strips seniority and suffixes', normTitle('Senior Accounts Executive (Manufacturing) - KL') === 'accounts');
const kerani = matchForApp(b, 'kerani', 5);
check('dictionary hits come with up to four alternatives', kerani.length === 5 && kerani[0].path === 'malay', kerani.map((h) => h.path).join(','));

const messyCv = `CURRICULUM VITAE\n\nNUR AISYAH BINTI AHMAD   |  +60 12-345 6789  |  aisyah@example.com\nPetaling Jaya, Selangor\n\n
WORK EXPERIENCE\n2019 - present   ACCOUNTS EXECUTIVE, Syarikat Maju Jaya Sdn Bhd\n - month-end closing, bank reconciliation, AP/AR, SST submission\n - prepare management accounts & financial statements in SQL Account / AutoCount\n
2016-2019  Kerani Akaun , Kedai Runcit Bersatu\n * key in invoices,,, petty cash  * payroll (EPF, SOCSO)\n\nEDUCATION  Diploma in Accountancy, UiTM (2016)\nSKILLS  MS Excel (pivot, vlookup), Bahasa Malaysia, English`;
const cv = matchCv(b, messyCv, 5);
const cvTitles = cv.hits.map((h) => b.occ[h.i].title);
check('messy CV: job titles detected', cv.titles.length >= 1, cv.titles.join('; '));
check('messy CV: accounting occupation ranked first', /Bookkeeping|Accountants/.test(cvTitles[0] ?? ''), cvTitles.slice(0, 3).join(' | '));
check('empty text gives no match', matchForApp(b, '   ', 5).length === 0);

// ---------------------------------------------------------------- study design and exports
check('six presentation orders, each a permutation of the three policies', SEQUENCES.length === 6 && new Set(SEQUENCES.map((s) => s.join())).size === 6 && SEQUENCES.every((s) => [...s].sort().join() === 'CONV,v1,v2'));
check('positions are balanced across orders', ['CONV', 'v1', 'v2'].every((p) => [0, 1, 2].every((k) => SEQUENCES.filter((s) => s[k] === p).length === 2)));
check('order from participant code P007 is order 1', pickSequence('P007').sequence === 1 && pickSequence('P007').source === 'code');
const acc = byTitle('Accountants and Auditors');
const fake: Session[] = [0, 1, 2, 3, 4, 5].map((k) => {
  const s = newSession('en', `P00${k}`, b.meta.built);
  const built = buildLists(b, acc, k);
  Object.assign(s, built, { sequence: k, sequenceSource: 'code', occupation: { soc: b.occ[acc].soc, title: b.occ[acc].title, query: 'accountant', path: 'verified' } });
  s.lists.forEach((l) => ITEM_IDS.forEach((id) => (l.ratings[id] = l.policy === 'v2' ? 6 : l.policy === 'v1' ? 5 : 4)));
  s.choice = s.lists.find((l) => l.policy === 'v2')!.label;
  s.sus = [4, 2, 4, 2, 4, 2, 4, 2, 4, 2];
  s.about = { ageBand: '25-34', sector: 'finance', education: 'bachelor', years: '3-5' };
  s.completedAt = new Date().toISOString();
  s.lists[0].comment = 'Comma, "quotes"\nand a new line';
  return s;
});
const top = topThree(b, acc);
check('study lists follow the order and hold each policy top three', fake.every((s, k) => s.order.join() === SEQUENCES[k].join() && s.lists.every((l, q) => l.label === 'ABC'[q] && l.items.join() === top[l.policy].map((j) => b.occ[j].soc).join())));
check('identical-lists flag matches the v1 and v2 top three', fake[0].identicalV1V2 === (top.v1.join() === top.v2.join()));
check('SUS scoring', susScore([4, 2, 4, 2, 4, 2, 4, 2, 4, 2]) === 75 && susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]) === 100);
const wide = toWideCsv(fake);
const rows = readWide(wide)!;
const row0 = rows.find((r) => r.session_id === fake[0].id);
check('per-session CSV round-trips through the importer', rows.length === 6 && row0?.[`${fake[0].lists[0].policy}_comment`] === 'Comma, "quotes"\nand a new line');
const sum = summarise(rows);
check('researcher summary: means by policy, choice and SUS', sum.complete === 6 && sum.outcomes.fit.v2.mean === 6 && sum.outcomes.fit.v1.mean === 5 && sum.outcomes.trust.CONV.mean === 4 && sum.choice.v2 === 6 && sum.sus.mean === 75);
check('researcher summary: paired v2 minus v1 fit', sum.paired.all.mean === 1 && sum.paired.all.n === 6);
check('researcher summary: sessions per order', sum.bySequence.join() === '1,1,1,1,1,1');
const long = parseCsv(toLongCsv(fake)).map((r) => r.join(','));
check('per-list CSV has one row per participant and list', long.length === 1 + 18 && long[0].startsWith('session_id,participant,occupation_soc,sequence'));
check('importer rejects other CSV files', readWide('a,b\n1,2') === null);

// ---------------------------------------------------------------- numbers against results.json
const res = JSON.parse(readFileSync('pipeline/checks/results.json', 'utf8'));
const ev = b.evidence;
const r1 = (x: number) => Math.round(x * 10) / 10;
check('top-10 shares 7.3 / 27.7 / 9.8 from results.json', ev.headline.top10.CONV === r1(res.policies.CONV.top10_share) && ev.headline.top10.v1 === r1(res.policies.v1.top10_share) && ev.headline.top10.v2 === r1(res.policies.v2.top10_share) && ev.headline.top10.CONV === 7.3 && ev.headline.top10.v1 === 27.7 && ev.headline.top10.v2 === 9.8);
check('largest v1 group 45 (Pressers)', res.policies.v1.max_n === 45 && ev.headline.topDest.n_origins === 45);
check('v2 keeps 71% of the v1 reduction', ev.headline.shareKept === 71 && Math.round((res.contrasts['ms|v2-CONV'].diff / res.contrasts['ms|v1-CONV'].diff) * 100) === 71);
check('observed applicability 15.7 / 12.4 / 13.3', ev.headline.msConv === 15.7 && ev.headline.msV1 === 12.4 && ev.headline.msV2 === 13.3);
check('every policy row equals results.json', ev.policies.every((p) => p.top10 === r1(res.policies[p.policy].top10_share) && p.distinct === res.policies[p.policy].distinct && p.maxN === res.policies[p.policy].max_n));
check('capstone index correlations .977 / .861 / .849 and alpha .959', ev.capstone.spearman.aioe_lm === 0.977 && ev.capstone.spearman.aioe_gpt === 0.861 && ev.capstone.spearman.gpt_lm === 0.849 && ev.capstone.alpha === 0.959);
check('Malaysian wage-growth result (n = 9) is not in the bundle', !('my' in ev.capstone.wageGrowth));
check('online data carries no e-LATiH rows', !b.meta.public || (b.courses.elatih.length === 0 && b.courses.elatihMode === 'none'));

// ---------------------------------------------------------------- translations and style
const en = Object.keys(dicts.en).sort();
const ms = Object.keys(dicts.ms).sort();
check('English and Bahasa Malaysia have the same keys', JSON.stringify(en) === JSON.stringify(ms), en.filter((k) => !ms.includes(k)).concat(ms.filter((k) => !en.includes(k))).slice(0, 5).join(', '));
check('no empty translations', [...Object.values(dicts.en), ...Object.values(dicts.ms)].every((v) => v.trim().length > 0));
check('SUS has ten items in both languages', SUS.en.length === 10 && SUS.ms.length === 10);
const emDash = new RegExp(String.fromCharCode(0x2014));
const files: string[] = [];
const walk = (d: string) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) walk(p);
  else if (/\.(ts|tsx|css|html|md|cjs|py|yml)$/.test(f)) files.push(p);
});
['src', 'tests', 'scripts', 'pipeline/checks', '.github'].forEach(walk);
// every Markdown file at the top level, the page itself and the pipeline scripts
[...readdirSync('.').filter((f) => f.endsWith('.md')), 'index.html', 'pipeline/build_data.py', 'pipeline/titles_my.py', 'pipeline/lexindex.py'].forEach((f) => {
  try {
    statSync(f);
    files.push(f);
  } catch {
    /* not present */
  }
});
const dashed = files.filter((f) => emDash.test(readFileSync(f, 'utf8')));
check('no em dashes in code, interface text or docs', dashed.length === 0, dashed.join(', '));

console.log(`\n${pass}/${pass + fails.length} unit checks passed`);
process.exit(fails.length ? 1 : 0);
