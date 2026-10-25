process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ??
    `${process.env.USERPROFILE}/.codex/dragon-preview-tools/node_modules/playwright-core`,
);
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 5284 },
  logLevel: 'error',
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultNavigationTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('dino-realms-language', 'en');
    localStorage.setItem('dino-realms-daily-opened', new Date().toISOString().slice(0, 10));
  });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(async () => {
    const { newSave, SAVE_KEY } = await import('/src/realms/game.ts');
    const s = newSave(Date.now());
    s.eggs[0].hatchAt = Date.now() - 1000;
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.production-bubble[aria-label="Hatchery"]').click({ timeout: 60000 });
  await page.getByRole('button', { name: 'Hatch', exact: true }).click();
  const vision = page.locator('.hero-vision');
  await vision.waitFor({ timeout: 60000 });
  const read = () =>
    page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('dino-realms-save-v1'));
      return { dinos: s.dinos, gold: s.gold, food: s.food, gems: s.gems, battle: s.battle, revision: s.revision };
    });
  const before = await read();
  assert.equal(before.dinos.length, 1);
  assert.equal(before.dinos[0].stage, 'baby');
  assert.equal(await vision.getAttribute('data-phase'), 'bonding');
  assert.match(await vision.locator('.hv-origin').innerText(), /Now/);
  await page.locator('.hero-vision[data-phase="growing"]').waitFor({ timeout: 60000 });
  assert.equal(await vision.getByRole('button').count(), 1, 'Only Skip is available during the cinematic');
  await page.locator('.hero-vision .battle-unit.ally[data-motion="attack"]').waitFor({ timeout: 60000 });
  await page.locator('.hero-vision .battle-unit.enemy canvas[data-boss="fire"]').waitFor();
  assert.ok((await vision.locator('.hero-vision-names').innerText()).includes('Ignaroth'));
  assert.equal(await vision.locator('.hv-banner, .hv-beats').count(), 0);
  assert.equal(await vision.locator('.hv-caption').innerText(), 'A possible future');
  await page.locator('.hero-vision .battle-unit.ally[data-motion="defend"]').waitFor({ timeout: 30000 });
  await page.locator('.hero-vision .battle-unit.enemy[data-motion="ultimate"]').waitFor();
  await page.locator('.hero-vision .battle-unit.ally[data-motion="ultimate"]').waitFor();
  await page.getByRole('button', { name: /Start training/ }).waitFor({ timeout: 30000 });
  assert.deepEqual(await read(), before, 'Vision must not change game state');
  assert.match(await vision.locator('.hv-next-goal').innerText(), /level 10/);
  await fs.mkdir('output/hero-vision', { recursive: true });
  await page.screenshot({ path: 'output/hero-vision/desktop-result.png' });
  await page.getByRole('button', { name: /Start training/ }).click();
  await page.locator('.dino-sheet').waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Grow', exact: true }).getAttribute('aria-selected'), 'true');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('tab', { name: 'Stats', exact: true }).click();
    await page.getByRole('button', { name: /Hero potential/ }).click();
    await vision.locator('.battle-unit.ally canvas[data-frame]').waitFor();
    const layout = await vision.evaluate((el) => ({ overflow: el.scrollWidth - el.clientWidth }));
    assert.ok(layout.overflow <= 1, JSON.stringify({ width, layout }));
    for (const button of await vision.getByRole('button').all()) {
      await button.scrollIntoViewIfNeeded();
      assert.ok((await button.boundingBox()).height >= 44);
    }
    await page.screenshot({ path: `output/hero-vision/mobile-${width}.png` });
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.locator('.dino-sheet').waitFor();
  }
  await page.getByRole('tab', { name: 'Stats', exact: true }).click();
  await page.getByRole('button', { name: /Hero potential/ }).click();
  await vision.waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.dino-sheet').waitFor();
  assert.equal(await vision.count(), 0);
  assert.deepEqual(await read(), before);
  assert.deepEqual(errors, []);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('tab', { name: 'Stats', exact: true }).click();
  await page.getByRole('button', { name: /Hero potential/ }).click();
  await page.getByRole('button', { name: /Start training/ }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /Start training/ }).click();
  assert.deepEqual(await read(), before);
  await page.evaluate(() => {
    const k = 'dino-realms-save-v1',
      s = JSON.parse(localStorage.getItem(k));
    s.eggs = [{ id: 'second-egg', species: 'trex', element: 'fire', seconds: 60, hatchAt: Date.now() - 1000 }];
    localStorage.setItem(k, JSON.stringify(s));
    localStorage.setItem('dino-realms-current-world', 'home');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.production-bubble[aria-label="Hatchery"]').click();
  await page.getByRole('button', { name: 'Hatch', exact: true }).click();
  await page.locator('.dino-sheet').waitFor();
  assert.equal(await vision.count(), 0);
  assert.equal((await read()).dinos.length, 2);
  assert.deepEqual(errors, []);
  console.log(
    'Companion reveal and level-10 training handoff; automatic attack → shield → ultimate; first hatch only, replay, skip, Escape, reduced motion, 390/320px and unchanged game state passed.',
  );
} finally {
  await browser?.close();
  await server.close();
}
