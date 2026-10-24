// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5224 }, logLevel: 'error' });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [], failed = [], retiredRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/realms\/dinosaurs\/|\/animations\/models\//.test(request.url())) retiredRequests.push(request.url()); });
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(server.resolvedUrls.local[0])) failed.push(response.url()); });
  await fs.mkdir('output/dinosaur-review', { recursive: true });
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  const families = await page.evaluate(async () => {
    const { newSave, command, ELEMENTS, SAVE_KEY } = await import('/src/realms/game.ts');
    const { PLAYABLE_DINOSAURS } = await import('/src/realms/playableDinosaurs.ts');
    const now = Date.now();
    let save = newSave(now);
    save.gold = 100000;
    save = command(save, { type: 'build', kind: 'market', x: 6, y: 1 }, now);
    save.habitats = Object.fromEntries(ELEMENTS.map(e => [e.id, 1]));
    save.dinos = PLAYABLE_DINOSAURS.map((d, i) => ({ ...d, id: `animated-${i}`, nickname: `Hero ${i}`, level: 25, stage: 'adult' }));
    save.dinos.push({ id: 'retired', species: 'ankylosaurus', element: 'fire', nickname: 'Retired', level: 10, stage: 'juvenile' });
    save.champion = 'retired';
    save.eggs = [];
    save.rewardedTutorial = true;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return PLAYABLE_DINOSAURS;
  });
  let designs = 0;
  for (const family of families) {
    const residents = families.filter(d => d.element === family.element).length;
    await page.evaluate(element => localStorage.setItem('dino-realms-current-world', element), family.element);
    await page.reload();
    await page.locator(`.realm-world[data-realm="${family.element}"][data-dinosaur-art-ready="true"][data-environment-ready="true"]:not(.loading)`).waitFor();
    assert.equal(await page.locator('.realm-world').getAttribute('data-residents'), String(residents));
    assert.equal(await page.locator('.realm-world').getAttribute('data-preview-residents'), '0');
    await page.screenshot({ path: `output/dinosaur-review/world-${family.element}.png` });
    await page.getByRole('button', { name: /Collection$/ }).click();
    for (const stage of ['Baby', 'Juvenile', 'Adult']) {
      await page.getByLabel('Evolution stage', { exact: true }).getByRole('button', { name: stage, exact: true }).click();
      const card = page.locator(`[data-dinosaur="${family.species}_${family.element}"]`);
      await card.locator('canvas[data-art-ready="true"]').waitFor();
      assert.equal(await page.locator('[data-dinosaur]').count(), residents);
      assert.equal(await card.locator('img,svg').count(), 0);
      designs++;
    }
    assert.equal(await page.getByLabel('Element filter').getByRole('button').count(), new Set(families.map(d => d.element)).size);
  }
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')));
  assert.equal(saved.dinos.length, families.length);
  assert.ok(saved.dinos.every(d => d.id !== 'retired'));
  assert.ok(saved.dinos.some(d => d.id === saved.champion));
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  assert.deepEqual(retiredRequests, []);
  const report = { families: families.length, designs, errors, failed, retiredRequests, reducedMotion: true };
  await fs.writeFile('output/dinosaur-review/review.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser?.close(); await server.close(); }
