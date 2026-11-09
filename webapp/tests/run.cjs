// npm test: unit checks in Node, then the end-to-end suite against dist/ served like GitHub Pages.
// Builds dist/ first when it is missing or older than the sources.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }).status;

function newest(dir) {
  let t = 0;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    t = Math.max(t, f.isDirectory() ? newest(p) : fs.statSync(p).mtimeMs);
  }
  return t;
}

const dist = path.join(root, 'dist', 'index.html');
const stale = !fs.existsSync(dist) || fs.statSync(dist).mtimeMs < Math.max(newest(path.join(root, 'src')), fs.statSync(path.join(root, 'index.html')).mtimeMs);
console.log('== unit checks');
const unit = run('npx', ['tsx', 'tests/unit.ts']);
if (stale) {
  console.log('\n== building dist/ (missing or older than the sources)');
  if (run('npx', ['vite', 'build']) !== 0) process.exit(1);
}
console.log('\n== end-to-end checks');
const e2e = run('node', ['tests/e2e.cjs', ...process.argv.slice(2)]);
console.log(`\nunit ${unit === 0 ? 'passed' : 'FAILED'}, end-to-end ${e2e === 0 ? 'passed' : 'FAILED'}`);
process.exit(unit || e2e ? 1 : 0);
