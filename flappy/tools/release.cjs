'use strict';
// Keep the page, scripts, worker cache, and online release marker in one release.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), file = name => path.join(root, name);
const next = process.argv[2], release = JSON.parse(fs.readFileSync(file('version.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(next || '')) throw new Error('Usage: node flappy/tools/release.cjs 3.1.0');
const old = release.version.split('.').map(Number), parts = next.split('.').map(Number);
if (!parts.some((part, i) => part > old[i] && parts.slice(0, i).every((value, j) => value === old[j]))) throw new Error('Choose a version newer than the current release.');
for (const name of ['index.html', 'sw.js', 'updates.js']) {
  let source = fs.readFileSync(file(name), 'utf8');
  source = source.split(`club-${release.version}`).join(`club-${next}`);
  source = source.replace(`name="game-version" content="${release.version}"`, `name="game-version" content="${next}"`);
  source = source.replace(`Version ${release.version}`, `Version ${next}`);
  source = source.replace(`const VERSION = '${release.version}'`, `const VERSION = '${next}'`);
  fs.writeFileSync(file(name), source);
}
fs.writeFileSync(file('version.json'), JSON.stringify({ ...release, version: next }, null, 2) + '\n');
console.log(`Prepared Flappy ${next}. Run node --test flappy/tests/*.test.cjs before publishing.`);
