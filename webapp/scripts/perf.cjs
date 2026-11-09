// Lighthouse measurements of the production build, served like GitHub Pages (sub-path, gzip).
//   npm run build && node scripts/perf.cjs [out.json]
// PERF_DIST=<folder> measures another build folder; PERF_RUNS=3 takes the median of three runs.
// Runs Lighthouse 12 against Home, Analyse, Moves, Atlas and Evidence
// with the mobile and desktop presets, using Playwright's Chromium unless CHROME_PATH is set.
// Lighthouse is not a dependency: install it once anywhere (npm i lighthouse@12 in a spare folder)
// and point LIGHTHOUSE at its cli (node_modules/lighthouse/cli/index.js), or let npx fetch it.
// Prints a Markdown table and writes the raw summary to out.json (default: perf-results.json).
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'perf-results.json');
const PAGES = [
  ['Home', '/'],
  ['Analyse', '/analyse'],
  ['Moves', '/moves'],
  ['Atlas', '/atlas'],
  ['Evidence', '/evidence'],
];
const RUNS = +(process.env.PERF_RUNS || 1);

if (!process.env.CHROME_PATH) {
  try {
    process.env.CHROME_PATH = require('playwright').chromium.executablePath();
  } catch {
    /* Lighthouse then looks for an installed Chrome */
  }
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function main() {
  const dist = path.resolve(root, process.env.PERF_DIST || 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('dist/ is missing: run npm run build first');
  const port = 4173;
  const preview = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--outDir', dist, '--base', '/CareerShield/', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'pipe' });
  await new Promise((resolve, reject) => {
    preview.stdout.on('data', (d) => /Local/.test(String(d)) && resolve());
    preview.on('exit', () => reject(new Error('vite preview exited')));
    setTimeout(() => reject(new Error('vite preview did not start')), 30000);
  });
  const base = `http://localhost:${port}/CareerShield/`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-lh-'));
  const rows = [];
  try {
    for (const form of ['mobile', 'desktop']) {
      for (const [name, route] of PAGES) {
        const runs = [];
        for (let r = 0; r < RUNS; r++) {
          const file = path.join(tmp, `${form}-${name}-${r}.json`);
          const lh = process.env.LIGHTHOUSE ? ['node', [process.env.LIGHTHOUSE]] : ['npx', ['--yes', 'lighthouse@12.8.2']];
          const args = [...lh[1], base + '#' + route, '--quiet', '--output=json', `--output-path=${file}`, '--chrome-flags=--headless=new --no-sandbox'];
          if (form === 'desktop') args.push('--preset=desktop');
          const res = spawnSync(lh[0], args, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], timeout: 180000 });
          if (res.status !== 0) throw new Error(`lighthouse failed on ${form} ${name}`);
          const lhr = JSON.parse(fs.readFileSync(file, 'utf8'));
          const items = lhr.audits['network-requests'].details.items;
          const sum = (f) => items.filter(f).reduce((a, i) => a + (i.transferSize || 0), 0);
          const isJs = (i) => i.resourceType === 'Script';
          runs.push({
            perf: Math.round(lhr.categories.performance.score * 100),
            a11y: Math.round(lhr.categories.accessibility.score * 100),
            bp: Math.round(lhr.categories['best-practices'].score * 100),
            seo: Math.round(lhr.categories.seo.score * 100),
            lcp: lhr.audits['largest-contentful-paint'].numericValue,
            tbt: lhr.audits['total-blocking-time'].numericValue,
            cls: lhr.audits['cumulative-layout-shift'].numericValue,
            jsKB: sum(isJs) / 1024,
            totalKB: sum(() => true) / 1024,
            failing: Object.values(lhr.audits)
              .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'manual' && a.scoreDisplayMode !== 'notApplicable')
              .map((a) => a.id),
          });
        }
        const pick = (k) => median(runs.map((x) => x[k]));
        rows.push({ form, page: name, perf: pick('perf'), a11y: pick('a11y'), bp: pick('bp'), seo: pick('seo'), lcp: pick('lcp'), tbt: pick('tbt'), cls: pick('cls'), jsKB: pick('jsKB'), totalKB: pick('totalKB'), failing: runs[0].failing });
      }
    }
  } finally {
    preview.kill();
  }
  fs.writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log('\n| Form | Page | Perf | A11y | BP | SEO | LCP (s) | TBT (ms) | CLS | JS (KB) | Total (KB) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.form} | ${r.page} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${(r.lcp / 1000).toFixed(1)} | ${Math.round(r.tbt)} | ${r.cls.toFixed(3)} | ${Math.round(r.jsKB)} | ${Math.round(r.totalKB)} |`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
