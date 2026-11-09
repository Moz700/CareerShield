// npm run verify: typecheck, production build, data checks, then the full test suite.
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const py = process.platform === 'win32' ? 'python' : 'python3';
const steps = [
  ['typecheck', 'npx', ['tsc', '-b']],
  ['build', 'npx', ['vite', 'build']],
  ['data checks', py, ['pipeline/checks/check_bundle.py']],
  ['tests', 'node', ['tests/run.cjs']],
];
for (const [name, cmd, args] of steps) {
  console.log(`\n==== ${name}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\nverify failed at: ${name}`);
    process.exit(1);
  }
}
console.log('\nverify passed: typecheck, build, data checks and tests');
