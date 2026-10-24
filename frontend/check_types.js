const { spawnSync } = require('child_process');
const r = spawnSync('node', ['node_modules/typescript/lib/tsc.js', '-b'], { encoding: 'utf8', cwd: __dirname });
console.log(r.stdout || '');
console.log(r.stderr || '');
console.log('exit:', r.status);
