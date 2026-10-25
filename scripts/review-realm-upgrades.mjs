// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5253 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(async () => {
    const { newSave } = await import('/src/realms/game.ts');
    const save = newSave(Date.now());
    save.gold = 1000;
    save.inventory.habitatKit = 1;
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(save));
  });
  await page.reload();
  await page.locator('.realm-nav button').filter({ hasText: 'Realms' }).click();
  const fire = page.locator('.realm-realm-card').filter({ has: page.locator('button[aria-label="Upgrade: Fire"]') });
  await fire.getByRole('button', { name: 'Upgrade: Fire', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')).habitats.fire === 2);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')));
  assert.equal(saved.gold, 850);
  assert.equal(saved.inventory.habitatKit, 0);
  assert.match(await fire.innerText(), /Level 2.*0\/3/);
  assert.equal(await fire.getByRole('button', { name: 'Upgrade: Fire', exact: true }).isDisabled(), true);
  await fs.mkdir('output/realm-upgrades', { recursive: true });
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await fire.scrollIntoViewIfNeeded();
    const overflow = await page.locator('.realm-window-body').evaluate(el => el.scrollWidth - el.clientWidth);
    assert.ok(overflow <= 1, `Horizontal overflow at ${width}`);
    await page.screenshot({ path: `output/realm-upgrades/${width}.png` });
  }
  await fire.getByRole('button', { name: /Make a kit/ }).click();
  await page.locator('.crafting-layout').waitFor();
  assert.deepEqual(errors, []);
  console.log('Realm upgrade applied from Realms, charged 150 gold and one kit, updated capacity to 3; mobile layouts and Workshop link passed.');
} finally {
  await browser?.close();
  await server.close();
}
