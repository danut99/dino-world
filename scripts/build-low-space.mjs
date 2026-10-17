// Build the same application while sharing immutable public assets with the checkout.
// Useful on a nearly-full disk; normal `npm run build` still copies assets conventionally.
import { build } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
if (path.dirname(output) !== path.resolve(root)) throw Error('Unexpected output directory');
await build({ configLoader: 'runner', build: { outDir: output, copyPublicDir: false } });
let files = 0;
async function linkAssets(source, target) {
  await fs.mkdir(target, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name),
      to = path.join(target, entry.name);
    if (entry.isDirectory()) await linkAssets(from, to);
    else if (entry.isFile()) {
      try { await fs.link(from, to); }
      catch (error) {
        // Some generated files retain ACLs which forbid additional hard links.
        // Keep a complete build when copying is allowed instead.
        if (!['EPERM', 'EACCES', 'EXDEV'].includes(error.code)) throw error;
        await fs.copyFile(from, to);
      }
      files++;
    }
  }
}
await linkAssets(path.join(root, 'public'), output);
console.log(
  `Complete local build: ${files} immutable public assets shared through filesystem hard links. Rebuild instead of editing dist assets.`,
);
