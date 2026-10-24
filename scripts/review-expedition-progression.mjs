// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5261 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.clock.install();
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(async () => {
    const { newSave, command, parseSave } = await import('/src/realms/game.ts');
    const now = Date.now(); let save = newSave(now);
    save.dinos = [{ id: 'ignis', species: 'trex', element: 'fire', stage: 'juvenile', level: 15, nickname: 'Ignis' }];
    save.champion = 'ignis'; save.eggs = []; save.cleared = ['training']; save.rewardedTutorial = true;
    for (const [kind, x, y] of [['farm', 5, 8], ['workshop', 6, 1], ['portal', 8, 5]]) save = command(save, { type: 'build', kind, x, y }, now);
    parseSave(JSON.stringify(save));
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(save));
  });
  await page.reload();
  await page.locator('.realm-nav button').filter({ hasText: /expedition/i }).click();
  await page.getByRole('button', { name: /Craft supplies in the Workshop/ }).waitFor();
  assert.match(await page.locator('.expedition-guide').innerText(), /Stage 1\/3/);
  assert.equal(await page.locator('.expedition-guide .adventure-start').isDisabled(), true);
  await fs.mkdir('output/expedition-progression', { recursive: true });
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('.expedition-guide').evaluate(el => el.scrollIntoView({ block: 'start' }));
    assert.ok(await page.locator('.adventure-layout').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({ path: `output/expedition-progression/guide-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: /Craft supplies in the Workshop/ }).click();
  await page.locator('.craft-parchment h2').filter({ hasText: 'Supply pack' }).waitFor();
  await page.locator('.craft-parchment > .realm-button').click();
  await page.clock.fastForward(61000);
  await page.locator('.craft-job').getByRole('button', { name: 'Collect', exact: true }).click();
  await page.getByRole('button', { name: /Back to expedition/ }).click();
  assert.match(await page.locator('.destination-cover').innerText(), /Sapphire reef/);
  assert.equal(await page.locator('.expedition-guide .adventure-start').isDisabled(), false);
  await page.locator('.expedition-guide .adventure-start').click();
  let save = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')));
  assert.equal(save.inventory.provisions, 0);
  assert.equal(save.expedition.stage, 0);
  await page.reload();
  await page.locator('.realm-nav button').filter({ hasText: /expedition/i }).click();
  await page.locator('.expedition-travel').waitFor();
  await page.clock.fastForward(181000);
  await page.getByRole('button', { name: /Collect and continue/ }).click();
  save = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')));
  assert.equal(save.expeditionProgress.ruins, 1);
  assert.equal(save.cleared.includes('ruins'), false);
  assert.match(await page.locator('.expedition-guide').innerText(), /Stage 2\/3/);
  await page.screenshot({ path: 'output/expedition-progression/stage-two.png' });
  assert.deepEqual(errors, []);
  console.log('Supply preparation, exact-recipe navigation, return to selected destination, offline trip reload, staged rewards and mobile overflow checks passed.');
} finally { await browser?.close(); await server.close(); }
