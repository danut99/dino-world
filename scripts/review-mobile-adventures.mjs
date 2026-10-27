// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 5265 },
  logLevel: 'error',
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, hasTouch: true });
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(message.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('dino-realms-language', 'en');
    localStorage.setItem('dino-realms-daily-opened', new Date().toISOString().slice(0, 10));
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(async () => {
    const { newSave } = await import('/src/realms/game.ts');
    const save = newSave(Date.now());
    save.gold = 100000;
    save.dinos = [{ id: 'ignis', species: 'trex', element: 'fire', stage: 'juvenile', level: 15, nickname: 'Ignis' }];
    save.champion = 'ignis';
    save.eggs = [];
    save.cleared = ['training'];
    save.rewardedTutorial = true;
    save.buildings.push({ id: 'arena', kind: 'arena', x: 7, y: 3 });
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(save));
  });
  await page.reload();
  await page.locator('.realm-nav-toggle').click();
  await page
    .locator('.realm-nav button')
    .filter({ hasText: /expedition/i })
    .click();
  await fs.mkdir('output/mobile-adventures', { recursive: true });
  for (const [width, height] of [
    [320, 568],
    [360, 740],
    [390, 844],
    [760, 900],
    [844, 390],
  ]) {
    console.log(`Checking ${width}x${height}`);
    await page.setViewportSize({ width, height });
    const screen = page.locator('.gameplay-screen');
    const check = async () =>
      assert.ok(await screen.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `Overflow at ${width}`);
    const portrait = width <= 760 && height > width;
    for (const node of await page.locator(portrait ? '.destination-list button' : '.adventure-node').all()) {
      await node.tap();
      assert.ok(await node.evaluate((el) => el.classList.contains('selected')));
    }
    await check();
    await page.locator('.adventure-layout').evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({ path: `output/mobile-adventures/expeditions-${width}.png` });
    await page.locator('.expedition-guide').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/mobile-adventures/details-${width}.png` });
    await screen.getByRole('button', { name: 'PvE Arena', exact: true }).tap();
    for (const league of await page.locator('.arena-leagues button:enabled').all()) await league.tap();
    for (const tier of await page.locator('.arena-ladder button').all()) {
      await tier.tap();
      assert.ok(await tier.evaluate((el) => el.classList.contains('selected')));
    }
    await check();
    await page.locator('.adventure-layout').evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({ path: `output/mobile-adventures/arena-${width}.png` });
    await page.locator('.adventure-detail').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/mobile-adventures/arena-details-${width}.png` });
    await screen.getByRole('button', { name: 'Expeditions', exact: true }).tap();
    await page.locator('.gameplay-expedition').waitFor();
  }
  assert.deepEqual(errors, []);
  console.log(
    'Mobile destinations, league and tier taps, navigation and overflow passed at 320, 360, 390, 760 and landscape 844px.',
  );
} finally {
  await browser?.close();
  await server.close();
}
