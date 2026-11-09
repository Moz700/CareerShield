// Regenerates the README screenshots in docs/screenshots from the built site.
//   npm run build && node scripts/screenshots.cjs
const path = require('path');
const { chromium } = require('playwright');
const { serve } = require('../tests/server.cjs');

const out = path.join(__dirname, '..', 'docs', 'screenshots');
const shots = [
  ['home', '/', 1440, 900, 'dark', 0],
  ['crowding', '/', 1440, 900, 'dark', '#home-crowding'],
  ['analyse', '/analyse', 1440, 1300, 'dark', 0],
  ['moves', '/moves', 1440, 1100, 'dark', 0],
  ['evidence', '/evidence', 1440, 1000, 'light', 0],
  ['mobile', '/analyse', 390, 844, 'dark', 0],
];

(async () => {
  const { server, url } = await serve(path.join(__dirname, '..', 'dist'));
  const b = await chromium.launch();
  for (const [name, route, w, h, theme, target] of shots) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: w < 500 ? 2 : 1 });
    await ctx.addInitScript((th) => {
      localStorage.setItem('cs.selection', JSON.stringify({ origin: 85, path: 'verified', query: 'accountant', dest: null }));
      localStorage.setItem('cs.motion', JSON.stringify('reduced'));
      localStorage.setItem('cs.themePref', JSON.stringify(th));
    }, theme);
    const p = await ctx.newPage();
    await p.goto(url + '#' + route);
    await p.waitForTimeout(1500);
    if (typeof target === 'string') {
      const el = await p.$(target);
      await el.scrollIntoViewIfNeeded();
      await p.click('[role="radio"]:has-text("Version 1")');
      await p.waitForTimeout(800);
      await el.screenshot({ path: path.join(out, name + '.png') });
    } else {
      await p.screenshot({ path: path.join(out, name + '.png') });
    }
    console.log('wrote docs/screenshots/' + name + '.png');
    await ctx.close();
  }
  await b.close();
  server.close();
})();
