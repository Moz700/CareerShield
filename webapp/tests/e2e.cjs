// End-to-end checks of the built site with Playwright (headless Chromium).
//   node tests/e2e.cjs                         serves dist/ under /CareerShield/ like GitHub Pages
//   node tests/e2e.cjs <url>                   tests a running site, e.g. the live deployment
//   node tests/e2e.cjs <url|-> <screenshot dir>
// Every page and flow is visited; the run fails on any console error.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { serve } = require('./server.cjs');

const fx = (f) => path.join(__dirname, 'fixtures', f);
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

(async () => {
  let base = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : null;
  const shots = process.argv[3] || null;
  let server = null;
  if (!base) {
    const dist = path.join(__dirname, '..', 'dist');
    if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('dist/ is missing: run npm run build first');
    const s = await serve(dist);
    server = s.server;
    base = s.url;
  }
  const url = (route) => base.replace(/#.*$/, '') + '#' + route;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  const watch = (pg, tag) => {
    pg.on('console', (m) => m.type() === 'error' && errors.push(`${tag}: ${m.text()}`));
    pg.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  };
  watch(p, 'desktop');
  const shot = async (pg, name) => {
    if (!shots) return;
    await pg.waitForTimeout(600);
    await pg.screenshot({ path: path.join(shots, name + '.png'), fullPage: true });
  };
  const resTitle = async () => (await p.textContent('#res-title')).trim();

  // ------------------------------------------------------------ home, hosting files
  await p.goto(url('/'));
  await p.waitForSelector('h1');
  check('home renders under a sub-path', (await p.textContent('h1')).includes('exposed'));
  check('page title and social preview tags', (await p.title()).startsWith('CareerShield') && !!(await p.$('meta[property="og:image"]')));
  for (const f of ['manifest.webmanifest', 'og-image.png', 'favicon.svg', 'robots.txt', 'sitemap.xml']) {
    const r = await p.request.get(base + f);
    check(`serves ${f}`, r.ok());
  }
  const missing = await ctx.newPage();
  watch(missing, '404');
  const resp = await missing.goto(base + 'no/such/page');
  await missing.waitForSelector('h1', { timeout: 15000 });
  check('unknown path falls back to the app (404.html)', resp.status() === 404 && missing.url().startsWith(base) && !missing.url().includes('no/such'));
  await missing.close();
  errors.splice(0, errors.length, ...errors.filter((e) => !e.startsWith('404: Failed to load resource')));
  await shot(p, 'home');

  // ------------------------------------------------------------ analyse: title, autocomplete, CV
  // hash-only navigation keeps page state, so pages are re-entered from another route
  const open = async (route) => {
    await p.goto(url(route === '/settings' ? '/' : '/settings'));
    await p.waitForTimeout(600); // let the page transition finish so the next page mounts fresh
    await p.goto(url(route));
  };
  const analyseTitle = async (q) => {
    await open('/analyse');
    await p.waitForSelector('#title-input', { timeout: 30000 });
    await p.fill('#title-input', q);
    await p.keyboard.press('Escape');
    await p.click('button:has-text("Find my occupation")');
    await p.waitForSelector('text=Closest occupations');
    await p.waitForFunction((qq) => document.querySelector('#res-title') !== null, q);
    await p.waitForTimeout(350);
    return resTitle();
  };
  // the title data is fetched only once the visitor starts, and by the match worker, not the page
  await open('/analyse');
  await p.waitForSelector('#title-input', { timeout: 30000 });
  await p.waitForTimeout(800);
  const pageFetched = () => p.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name.split('/').pop()).filter((n) => /^(matcher|matchWorker|descriptions)-/.test(n)));
  check('title data waits for the first interaction', (await pageFetched()).length === 0, (await pageFetched()).join(' '));
  for (const [q, want] of [
    ['accountant', 'Accountants and Auditors'],
    ['data analyst', 'Business Intelligence Analysts'],
    ['kerani', 'Office Clerks, General'],
    ['cikgu', 'Elementary School Teachers, Except Special Education'],
  ]) {
    const got = await analyseTitle(q);
    check(`title "${q}"`, got === want, got);
  }
  const onPage = await pageFetched();
  check('title matching runs in the worker', onPage.some((n) => n.startsWith('matchWorker-')) && !onPage.some((n) => n.startsWith('matcher-')), onPage.join(' '));
  const cands = await p.$$eval('button[aria-pressed]', (b) => b.length);
  check('top-5 candidates listed for confirmation', cands === 5, String(cands));
  await p.click('button[aria-pressed="false"] >> nth=0');
  await p.waitForTimeout(400);
  check('choosing another candidate changes the result', (await resTitle()) !== 'Elementary School Teachers, Except Special Education');

  await open('/analyse');
  await p.fill('#title-input', 'regist');
  await p.waitForSelector('#title-suggestions [role="option"]');
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  await p.waitForSelector('#res-title');
  check('autocomplete with the keyboard', (await resTitle()).length > 3, await resTitle());
  const gauge = await p.textContent('figure');
  check('gauge shows the exposure percentile', /\d/.test(gauge));
  const body = await p.textContent('main');
  check('three index components, moats and labour market shown', ['AIOE', 'GPT', 'LM-AIOE', 'RM'].every((s) => body.includes(s)));
  await shot(p, 'analyse');

  for (const [file, expect] of [
    ['sample_cv.pdf', /Bookkeeping|Accountants/],
    ['sample_cv.docx', /Bookkeeping|Office Clerks|Secretaries/],
    ['sample_cv.txt', /Registered Nurses|Nurse/],
  ]) {
    await open('/analyse');
    await p.waitForSelector('#title-input');
    await p.click('[role="radio"]:has-text("Upload CV")');
    await p.setInputFiles('#cv-file', fx(file));
    await p.waitForSelector('text=Job titles found in your CV', { timeout: 30000 });
    await p.waitForTimeout(400);
    const title = await resTitle();
    check(`CV upload ${file}`, expect.test(title), title);
  }

  // ------------------------------------------------------------ career moves
  await analyseTitle('accountant');
  await p.goto(url('/moves'));
  await p.waitForSelector('#cmp-title');
  const cols = await p.$$eval('#cmp-title ~ div > div', (d) => d.length);
  check('conventional, v1 and v2 side by side', cols === 3, String(cols));
  const cmp = await p.textContent('section[aria-labelledby="cmp-title"]');
  check('crowding counts shown per destination', /first choice for \d+ of 820/.test(cmp));
  const firstCard = async () => (await p.$$eval('#detail ~ div li h3', (e) => e.map((x) => x.textContent)))[0];
  const v2first = await firstCard();
  await p.click('[role="radio"]:has-text("Version 1")');
  await p.waitForTimeout(600);
  const v1first = await firstCard();
  await p.click('[role="radio"]:has-text("Conventional")');
  await p.waitForTimeout(600);
  const convFirst = await firstCard();
  check('policy toggle switches the detailed list', !!v2first && !!v1first && !!convFirst, `v2 ${v2first} | v1 ${v1first} | conv ${convFirst}`);
  await p.click('[role="radio"]:has-text("Version 1")');
  await p.waitForSelector('#w1');
  await p.fill('#w1', '100');
  await p.fill('#w0', '0');
  await p.waitForTimeout(600);
  const reranked = await firstCard();
  check('v1 weight sliders re-rank live', reranked !== v1first, `${v1first} -> ${reranked}`);
  await p.click('button:has-text("Reset to paper weights")');
  await p.waitForTimeout(1200);
  const back = await firstCard();
  check('reset restores the paper weights', back === v1first, back);
  await shot(p, 'moves');

  // ------------------------------------------------------------ reskilling, atlas, evidence
  await p.goto(url('/reskill'));
  await p.waitForSelector('text=Skill gaps to close');
  const links = await p.$$eval('main a[href^="http"]', (e) => e.map((x) => x.href));
  check('reskilling plan with course links', links.length >= 3 && links.some((l) => l.includes('coursera.org')), `${links.length} links`);
  const opts = await p.$$eval('#dest option', (o) => o.map((x) => x.value));
  await p.selectOption('#dest', opts[1]);
  await p.waitForTimeout(500);
  check('reskilling plan per destination', (await p.$$eval('main a[href^="http"]', (e) => e.length)) >= 1);
  await shot(p, 'reskill');

  await p.goto(url('/atlas'));
  await p.waitForSelector('svg[role="img"]');
  const countText = async () => (await p.textContent('main')).match(/(\d+) occupations shown/)?.[1];
  const all = await countText();
  await p.fill('#atlas-q', 'nurse');
  await p.waitForTimeout(400);
  const nurses = await countText();
  await p.fill('#atlas-q', '');
  await p.click(`[role="group"] button:has-text("Professionals")`);
  await p.waitForTimeout(400);
  const pros = await countText();
  check('atlas search and major-group filter', +nurses < +all && +pros < +all, `${all} / ${nurses} / ${pros}`);
  await p.click('[role="radio"]:has-text("List")');
  await p.click('tbody tr >> nth=0');
  await p.waitForSelector('[role="dialog"]');
  check('atlas detail drawer opens', true);
  const descLen = await p.waitForFunction(() => document.querySelector('[role="dialog"] p.leading-relaxed')?.textContent?.length || 0, null, { timeout: 8000 }).then((h) => h.jsonValue(), () => 0);
  check('drawer loads the occupation description', descLen > 40, String(descLen));
  await p.keyboard.press('Escape');
  check('drawer closes with Escape', await p.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 3000 }).then(() => true, () => false));
  await p.click('[role="radio"]:has-text("Chart")');
  await shot(p, 'atlas');

  await p.goto(url('/evidence'));
  await p.waitForSelector('text=Concentration of advice');
  const ev = (await p.textContent('main')).replace(/\s+/g, ' ');
  for (const n of ['7.3', '27.7', '9.8', '.977', '.861', '.849', '.959', '71%', '662/889', '-3.3', '45', 'Pressers', 'github.com/Moz700/CareerShield', 'moztobamutashim@gmail.com', '@unpublished']) check(`evidence shows ${n}`, ev.includes(n));
  check('evidence leaves out the n = 9 wage-growth result', !ev.includes('-0.183') && !ev.includes('0.637'));
  await shot(p, 'evidence');

  // ------------------------------------------------------------ report
  await p.goto(url('/report'));
  await p.waitForSelector('#report');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Download JSON")')]);
  const js = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  check('report JSON download', js.occupation && js.occupation.title === 'Accountants and Auditors' && js.career_moves.length > 0);
  await p.emulateMedia({ media: 'print' });
  check('print layout hides navigation', !(await p.isVisible('header.site')));
  await p.emulateMedia({ media: 'screen' });
  await shot(p, 'report');

  // ------------------------------------------------------------ language, theme, keyboard
  await p.getByRole('button', { name: 'Bahasa Malaysia', exact: true }).click();
  await p.waitForTimeout(300);
  check('Bahasa Malaysia toggle', (await p.textContent('header')).includes('Analisis') && (await p.getAttribute('html', 'lang')) === 'ms');
  check('black theme by default', (await p.getAttribute('html', 'data-theme')) === 'dark');
  await p.click('button[aria-label="Tukar tema warna"]');
  await p.waitForTimeout(300);
  check('theme toggle switches to light', (await p.getAttribute('html', 'data-theme')) === 'light');
  await p.goto(url('/analyse'));
  await p.waitForSelector('#res-title');
  await shot(p, 'analyse-ms-light');
  await p.getByRole('button', { name: 'English', exact: true }).click();
  await p.click('button[aria-label="Switch colour theme"]');
  await p.goto(url('/'));
  await p.reload();
  await p.waitForSelector('h1');
  await p.keyboard.press('Tab');
  check('skip link is the first focus stop', ((await p.evaluate(() => document.activeElement?.textContent)) || '').toLowerCase().includes('skip'));

  // ------------------------------------------------------------ study mode
  check('study hidden from the public navigation', !(await p.$('header a[href="#/study"]')));
  await p.goto(base + '?study=1#/study');
  await p.waitForSelector('text=Participant information');
  check('?study=1 switches study mode on', !!(await p.$('header a[href="#/study"]')));
  for (const cb of await p.$$('main input[type=checkbox]')) await cb.check();
  await p.fill('#pcode', 'P004');
  await p.click('button:has-text("Start")');
  await p.waitForSelector('#title-input');
  await p.fill('#title-input', 'accountant');
  await p.keyboard.press('Escape');
  await p.click('button:has-text("Find my occupation")');
  await p.click('button:has-text("Yes, this describes my work")');
  const seen = [];
  for (let k = 0; k < 3; k++) {
    await p.waitForSelector(`h2:text-is("Rate list ${'ABC'[k]}")`);
    await p.waitForTimeout(350);
    const txt = await p.textContent('main');
    seen.push(txt);
    const groups = await p.$$eval('main fieldset input[type=radio]', (els) => [...new Set(els.map((e) => e.name))]);
    for (const g of groups) await p.click(`label:has(input[name="${g}"][value="${4 + k}"])`);
    await p.fill(`#comment-${'ABC'[k]}`, k === 0 ? 'Fine, "mostly"' : '');
    await p.click('button:has-text("Next")');
  }
  check('lists are blinded (no policy names or crowding counts)', seen.every((x) => !/CareerShield v1|CareerShield v2|Conventional|first choice for/.test(x)));
  await p.waitForSelector('text=Which list would you act on?');
  await p.waitForTimeout(350);
  await p.click('label:has(input[name="choice"]) >> nth=2');
  await p.click('button:has-text("Next")');
  await p.waitForSelector('text=About the app');
  await p.waitForTimeout(350);
  for (let k = 0; k < 10; k++) await p.click(`label:has(input[name="sus${k}"][value="${k % 2 ? 2 : 4}"])`);
  await p.click('button:has-text("Next")');
  await p.waitForSelector('#about-ageBand');
  await p.waitForTimeout(350);
  for (const id of ['ageBand', 'sector', 'education', 'years']) await p.selectOption(`#about-${id}`, { index: 1 });
  await p.click('button:has-text("Submit")');
  await p.waitForSelector('text=Thank you for taking part');
  check('study session completes', true);
  await p.click('[role="radio"]:has-text("Researcher")');
  await p.waitForSelector('#study-summary');
  const [csv] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("CSV, one row per session")')]);
  const csvPath = path.join(os.tmpdir(), `cs-study-${Date.now()}.csv`);
  fs.copyFileSync(await csv.path(), csvPath);
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const head = csvText.split('\n')[0].split(',');
  const row = csvText.split('\n')[1];
  check('study CSV logs policy, position, order and v1/v2 overlap', ['order', 'identical_v1_v2', 'CONV_position', 'v1_label', 'v2_fit', 'choice_policy', 'sus_score'].every((h) => head.includes(h)) && csvText.split('\n').length >= 2);
  check('order follows the participant code (P004 is order 4)', row.includes(',4,code,v2>CONV>v1,'));
  const summary = await p.textContent('#study-summary');
  check('researcher view summarises the session', summary.includes('5.00') || summary.includes('4.00') || summary.includes('6.00'));
  await p.goto(url('/study'));
  await p.click('[role="radio"]:has-text("Researcher")');
  await p.setInputFiles('#import-csv', csvPath);
  await p.uncheck('text=Include sessions on this device');
  await p.waitForTimeout(400);
  check('researcher view imports exported CSV files', (await p.textContent('main')).includes('1 / 1'));
  await shot(p, 'study-researcher');
  await p.goto(base + '?study=0#/');
  await p.waitForTimeout(400);
  check('?study=0 switches study mode off', !(await p.$('header a[href="#/study"]')));

  // ------------------------------------------------------------ phone width
  const m = await ctx.newPage();
  watch(m, 'mobile');
  await m.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/analyse', '/moves', '/reskill', '/atlas', '/evidence', '/report', '/settings']) {
    await m.goto(url(route));
    await m.waitForTimeout(route === '/' ? 1500 : 900);
    const over = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no horizontal scroll at 390px ${route}`, over <= 1, `overflow ${over}px`);
  }
  await m.click('button[aria-label="Menu"]');
  await m.waitForSelector('#mobile-nav');
  check('mobile menu opens', true);

  check('zero console errors', errors.length === 0, errors.slice(0, 5).join(' || '));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} end-to-end checks passed`);
  await browser.close();
  if (server) server.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
