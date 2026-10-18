import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Report only: never stages files or deletes unused assets.
const inventory = JSON.parse(fs.readFileSync('src/realms/animation-inventory.json', 'utf8'));
const assets = new Set();
for (const id of [...inventory, ...['fire', 'water', 'earth', 'nature', 'lightning'].map(element => `boss_${element}_adult`)]) {
  const manifestPath = `public/realms/animations/${id}/manifest.json`;
  assets.add(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const direction of Object.values(manifest.clips)) {
    for (const clip of Object.values(direction)) assets.add(`public${clip.sheet}`);
  }
}
for (const asset of assets) {
  if (!fs.existsSync(asset)) throw new Error(`Missing runtime asset: ${asset}`);
}
const raw = execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: 'utf8' });
const changed = raw.split('\0').filter(Boolean).map(record => {
  if (record.startsWith('R') || record.startsWith('C')) throw new Error('Review renamed files manually before staging.');
  return record.slice(3).replaceAll('\\', '/');
});
const tooling = ['scripts/import-realms-animation.py', 'scripts/import-pixellab-archive.py', 'scripts/review-realms-animation.mjs', 'scripts/review-dinosaur-catalog.mjs', 'scripts/realms-images.py', 'scripts/inspect-dinosaur-sheets.py', 'scripts/sync-realms-translations.mjs', 'scripts/list-runtime-commit.mjs'];
const runtime = changed.filter(file => {
  if (file.startsWith('src/')) return !file.endsWith('.md');
  if (file.startsWith('public/realms/animations/')) return !fs.existsSync(file) || assets.has(file);
  if (file.startsWith('public/')) return true;
  return ['index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json'].includes(file);
}).sort();
const unused = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(file);
    else if (!assets.has(file)) unused.push(file);
  }
}
walk('public/realms/animations');
const out = 'output/realms/animation';
fs.mkdirSync(out, { recursive: true });
const write = (name, list) => fs.writeFileSync(path.join(out, name), list.join('\n') + '\n');
write('commit-runtime.txt', runtime);
write('commit-tooling.txt', tooling.filter(file => changed.includes(file)));
write('unused-animation-assets.txt', unused.sort());
write('excluded-from-runtime-commit.txt', changed.filter(file => !runtime.includes(file)).sort());
console.log(JSON.stringify({ runtimeFiles: runtime.length, referencedAnimationAssets: assets.size, unusedAnimationAssets: unused, lists: out }, null, 2));
