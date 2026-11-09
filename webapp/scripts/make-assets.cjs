// Renders the social preview image and the app icons into public/ with Playwright.
//   node scripts/make-assets.cjs
// Run it again after changing the brand colours, the logo or the headline numbers.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');
const font = (file) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'node_modules', file)).toString('base64');
const ev = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'evidence.json'), 'utf8'));
const top10 = ev.headline.top10;

const BG = '#070a0f';
const INK = '#ecf0f6';
const MUTED = '#96a1b2';
const LINE = '#232a36';
const BRAND = '#5b9cff';

// the same mark as the Logo component in src/components/ui.tsx
const mark = (size, bg = BRAND, fg = BG) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <path d="M6 6.2C6 5 7 4 8.2 4h15.6C25 4 26 5 26 6.2v9.3c0 6.1-4.1 10.9-10 13.1C10.1 26.4 6 21.6 6 15.5Z" fill="${bg}"/>
  <g fill="none" stroke="${fg}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 22.5C11 16.5 15 13.5 21 11.5"/>
    <path d="M17.6 9.4 21.6 11.2 19.9 15.2"/>
  </g>
</svg>`;

const css = `
@font-face{font-family:D;src:url(${font('@fontsource-variable/red-hat-display/files/red-hat-display-latin-wght-normal.woff2')});font-weight:300 900}
@font-face{font-family:S;src:url(${font('@fontsource-variable/red-hat-text/files/red-hat-text-latin-wght-normal.woff2')});font-weight:300 700}
*{box-sizing:border-box;margin:0}body{font-family:S,sans-serif;color:${INK};background:${BG}}`;

const bar = (label, v, color) => `
  <div style="margin-top:24px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:21px;color:${MUTED}">
      <span>${label}</span><span style="font-family:D;font-weight:700;font-size:26px;color:${color}">${v.toFixed(1)}%</span></div>
    <div style="margin-top:10px;height:12px;border-radius:2px;background:#151a23">
      <div style="height:12px;border-radius:2px;width:${(v / 30) * 100}%;background:${color}"></div></div>
  </div>`;

const og = `<!doctype html><html><head><style>${css}</style></head><body>
<div style="width:1200px;height:630px;position:relative;overflow:hidden;background:${BG};padding:60px 68px;display:flex;gap:60px">
  <div style="position:absolute;right:-220px;top:-240px;width:760px;height:760px;background:radial-gradient(closest-side,rgba(91,156,255,.22),transparent)"></div>
  <div style="position:absolute;left:-240px;bottom:-320px;width:700px;height:700px;background:radial-gradient(closest-side,rgba(45,212,191,.12),transparent)"></div>
  <div style="flex:1.12;display:flex;flex-direction:column;position:relative">
    <div style="display:flex;align-items:center;gap:14px">${mark(46)}
      <span style="font-family:D;font-size:32px;font-weight:700;letter-spacing:-.3px">CareerShield</span></div>
    <div style="font-family:D;font-size:50px;line-height:1.1;font-weight:700;margin-top:46px;letter-spacing:-.5px">
      How exposed is your job to AI? <span style="color:${BRAND}">See where you could move next.</span></div>
    <div style="font-size:23px;line-height:1.45;color:${MUTED};margin-top:22px;max-width:560px">
      Exposure scores for 894 occupations, career moves with Malaysian salaries, and courses for the skill gaps.</div>
    <div style="margin-top:auto;font-size:18px;white-space:nowrap;color:${MUTED}">Built by <span style="color:${INK};font-weight:600">Moztoba Mutashim Billah</span> · Sunway University</div>
  </div>
  <div style="flex:.88;align-self:center;position:relative;background:#0d1118;border:1px solid ${LINE};border-radius:8px;padding:34px 34px 38px">
    <div style="font-size:15px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND}">Crowding</div>
    <div style="font-family:D;font-size:24px;margin-top:10px;line-height:1.3;font-weight:600">Share of all advice sent to the ten most recommended jobs</div>
    ${bar('Conventional advice', top10.CONV, '#94a3b8')}
    ${bar('One worker at a time (v1)', top10.v1, '#f59e0b')}
    ${bar('Planned with a cap (v2)', top10.v2, BRAND)}
  </div>
</div></body></html>`;

const icon = (size, pad) => `<!doctype html><html><head><style>${css}</style></head><body>
<div style="width:${size}px;height:${size}px;background:${BG};display:flex;align-items:center;justify-content:center">
${mark(Math.round(size * (1 - pad * 2)))}</div></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const render = async (html, w, h, file) => {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(html, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(pub, file), clip: { x: 0, y: 0, width: w, height: h } });
    console.log('wrote public/' + file);
  };
  await render(og, 1200, 630, 'og-image.png');
  await render(icon(180, 0.1), 180, 180, 'apple-touch-icon.png');
  await render(icon(192, 0.1), 192, 192, 'icon-192.png');
  await render(icon(512, 0.18), 512, 512, 'icon-512.png');
  fs.writeFileSync(path.join(pub, 'favicon.svg'), mark(32).trim() + '\n');
  console.log('wrote public/favicon.svg');
  await b.close();
})();
