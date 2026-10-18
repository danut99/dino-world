import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5240 }, logLevel: 'error' });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errors = [], missing = [], checked = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(server.resolvedUrls.local[0])) missing.push(response.url()); });
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = 'animation-update-review';
    Object.assign(host.style, { position: 'fixed', inset: '0', background: '#231d35', zIndex: '999999', display: 'grid', placeItems: 'center' });
    document.body.append(host);
    const module = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = module.default ?? module;
    window.animationReviewRoot = createRoot(host);
  });
  await fs.mkdir('output/realms/animation/updates', { recursive: true });
  for (const [id, clips] of [
    ['trex_fire_juvenile', ['attack', 'defend']],
    ['trex_fire_adult', ['attack', 'defend', 'ultimate']],
    ['boss_nature_adult', ['ultimate']],
  ]) {
    for (const clip of clips) {
      const count = await page.evaluate(async ({ id, clip }) => {
        const module = await import('/node_modules/.vite/deps/react.js');
        const { createElement } = module.default ?? module;
        const { AnimatedDinosaur } = await import('/src/realms/AnimatedDinosaur.tsx');
        const manifest = await (await fetch(`/realms/animations/${id}/manifest.json`)).json();
        window.animationReviewRoot.render(createElement(AnimatedDinosaur, { key: `${id}-${clip}`, manifest, clip, label: id }));
        return manifest.clips.se[clip].durationsMs.length;
      }, { id, clip });
      const canvas = page.locator('#animation-update-review canvas');
      await page.waitForFunction(clip => {
        const c = document.querySelector('#animation-update-review canvas');
        return c?.dataset.animation === clip && Number(c.dataset.frame) > 0;
      }, clip);
      await canvas.screenshot({ path: `output/realms/animation/updates/${id}-${clip}.png` });
      await page.waitForFunction(last => document.querySelector('#animation-update-review canvas')?.getAttribute('data-frame') === String(last), count - 1);
      await page.waitForTimeout(120);
      assert.equal(await canvas.getAttribute('data-frame'), String(count - 1));
      checked.push({ id, clip, frames: count, holdsFinalFrame: true });
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  const report = { checked, errors, missing };
  await fs.writeFile('output/realms/animation/updates/review.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser?.close(); await server.close(); }
