// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5242 }, logLevel: 'error' });
await server.listen(); let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], missing = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().includes('/realms/buildings/')) missing.push(r.url()); });
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await fs.mkdir('output/building-tiers', { recursive: true });
  for (const tier of [2, 3]) {
    await page.evaluate(async tier => {
      const { newSave } = await import('/src/realms/game.ts');
      const { FARM_LEVELS } = await import('/src/realms/content.ts');
      const s = newSave(Date.now());
      s.buildings.push({ id: 'farm', kind: 'farm', x: 7, y: 5 });
      s.farmLevel = tier === 2 ? 3 : 5;
      s.hatcheryLevel = tier;
      s.plots = Array(FARM_LEVELS[s.farmLevel - 1].plots).fill(null);
      localStorage.setItem('dino-realms-save-v1', JSON.stringify(s));
      localStorage.setItem('dino-realms-current-world', 'home');
    }, tier);
    await page.reload();
    await page.locator('.realm-world[data-environment-ready="true"]').waitFor();
    await page.waitForFunction(tier => ['farm', 'hatchery'].every(kind => performance.getEntriesByType('resource').some(e => e.name.includes(`/realms/buildings/${kind}-${tier}.webp`))), tier);
    await page.evaluate(async tier => { await Promise.all(['farm', 'hatchery'].map(async kind => { const img = new Image(); img.src = `/realms/buildings/${kind}-${tier}.webp`; await img.decode(); })); }, tier);
    await page.screenshot({ path: `output/building-tiers/tier-${tier}-island.jpg`, type: 'jpeg', quality: 84 });
    await page.getByRole('button', { name: /Build$/ }).click();
    for (const kind of ['farm', 'hatchery']) assert.equal(await page.locator(`image[href="/realms/buildings/${kind}-${tier}.webp"]`).count(), 1);
    await page.screenshot({ path: `output/building-tiers/tier-${tier}-shop.jpg`, type: 'jpeg', quality: 84 });
  }
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  await fs.writeFile('output/building-tiers/review.json', JSON.stringify({ tiers: [2, 3], islandAndShop: true, errors, missing }, null, 2));
  console.log('All four upgrade sprites loaded on the island and in the building shop; no browser errors or missing assets.');
} finally { await browser?.close(); await server.close(); }
