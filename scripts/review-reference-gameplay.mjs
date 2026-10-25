// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright',
);
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 5222 },
  logLevel: 'error',
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
    errors = [],
    failed = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(server.resolvedUrls.local[0])) failed.push(`${r.status()} ${r.url()}`);
  });
  await fs.mkdir('output/reference-gameplay', { recursive: true });
  const shot = (name) => page.screenshot({ path: `output/reference-gameplay/${name}.jpg`, type: 'jpeg', quality: 78 });
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.clock.install();
  await page.evaluate(async () => {
    const { newSave } = await import('/src/realms/game.ts');
    const s = newSave(Date.now());
    s.egg = 'hatched';
    s.dino = { level: 12, stage: 'juvenile', nickname: 'Ignis', realm: 'fire' };
    s.food = 500;
    s.rewardedTutorial = true;
    s.cleared = ['training'];
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(s));
    localStorage.setItem('dino-realms-current-world', 'home');
  });
  await page.reload();
  await page.locator('.realm-world[data-environment-ready="true"]').waitFor();
  await page.evaluate(async () => {
    await Promise.all(
      [
        'utility-buildings-pixel',
        'all-worlds-map-pixel',
        'arena-interior-pixel',
        'workshop-interior-pixel-v3',
        'ice-sentinel-pixel',
      ].map((id) => {
        const img = new Image();
        img.src = `/realms/gameplay/${id}.webp`;
        return img.decode();
      }),
    );
  });
  for (const [kind, cost, x, y] of [
    ['farm', 100, 5, 8],
    ['workshop', 200, 6, 1],
    ['portal', 250, 8, 5],
    ['arena', 300, 1, 8],
  ]) {
    await page.getByRole('button', { name: /Build$/ }).click();
    await shot('building-shop');
    await page.getByRole('button', { name: `${cost} ●`, exact: true }).click();
    const r = await page.locator('.realm-world canvas').boundingBox();
    const sx = 768 + (x - y) * 43,
      sy = 238 + (x + y + 1) * 21.5;
    await page.mouse.click(r.x + (sx / 1536) * r.width, r.y + (sy / 1024) * r.height);
    await page.locator('.realm-placement').waitFor({ state: 'hidden' });
  }
  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')));
  assert.equal(state.buildings.length, 5);
  assert.equal(state.gold, 350);
  assert(!state.buildings.some((b) => b.kind === 'habitat'));
  await shot('main-island');
  await page.getByRole('button', { name: 'Workshop', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'The workshop', exact: true });
  await dialog.getByRole('button', { name: /Craft$/ }).click();
  await dialog.getByRole('button', { name: /Craft$/ }).click();
  await shot('workshop-queue');
  await page.reload();
  await page.clock.fastForward(61_000);
  await page.getByRole('button', { name: 'Workshop', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'The workshop', exact: true });
  assert.equal(await dialog.getByRole('button', { name: 'Collect', exact: true }).count(), 2);
  await shot('workshop-ready');
  await dialog.getByRole('button', { name: 'Collect', exact: true }).first().click();
  await dialog.getByRole('button', { name: 'Collect', exact: true }).first().click();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')));
  assert.equal(state.inventory.provisions, 2);
  assert.equal(state.crafting.length, 0);
  await dialog.getByRole('button', { name: /Expeditions$/ }).click();
  dialog = page.getByRole('dialog', { name: 'Expeditions', exact: true });
  assert.equal(await dialog.locator('.adventure-node').count(), 10);
  const worlds = await dialog.locator('.adventure-node strong').allTextContents();
  for (const name of ['Fire', 'Water', 'Earth', 'Nature', 'Ice', 'Lightning', 'Wind', 'Dark', 'Light', 'Arcane'])
    assert(
      worlds.some((t) => t.startsWith(name)),
      `Missing map world ${name}`,
    );
  await shot('all-worlds-map');
  await dialog.getByRole('button', { name: 'Zoom map in', exact: true }).click();
  const map = await dialog.locator('.adventure-map').boundingBox();
  await page.mouse.move(map.x + map.width * 0.5, map.y + map.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(map.x + map.width - 3, map.y + map.height - 3, { steps: 5 });
  await page.mouse.up();
  assert.equal(await dialog.locator('.adventure-map-plane').getAttribute('data-map-zoom'), '2');
  await shot('map-zoomed');
  await dialog.getByRole('button', { name: 'Show all worlds', exact: true }).click();
  await dialog.getByRole('button', { name: 'Ancient ruins', exact: true }).click();
  await shot('expedition-detail');
  await dialog.getByRole('button', { name: /Begin adventure/ }).click();
  dialog = page.getByRole('dialog', { name: 'Ancient ruins', exact: true });
  await shot('battle');
  await dialog.getByRole('button', { name: /Flame/ }).click();
  await page.reload();
  dialog = page.getByRole('dialog', { name: 'Ancient ruins', exact: true });
  await dialog.waitFor();
  for (let i = 0; i < 14 && (await dialog.getByRole('button', { name: /Basic/ }).count()); i++)
    await dialog.getByRole('button', { name: /Basic/ }).click();
  await shot('battle-result');
  await dialog.getByRole('button', { name: 'Claim reward', exact: true }).click();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')));
  assert(state.cleared.includes('ruins'));
  assert.equal(state.battle, null);
  await page.getByRole('button', { name: /PvE Arena$/ }).click();
  dialog = page.getByRole('dialog', { name: 'PvE Arena', exact: true });
  await shot('arena-lobby');
  await dialog.getByRole('button', { name: /Begin adventure/ }).click();
  dialog = page.getByRole('dialog', { name: 'Gatekeeper', exact: true });
  await dialog.getByRole('button', { name: /Defend/ }).click();
  for (let i = 0; i < 14 && (await dialog.getByRole('button', { name: /Basic/ }).count()); i++)
    await dialog.getByRole('button', { name: /Basic/ }).click();
  await dialog.getByRole('button', { name: 'Claim reward', exact: true }).click();
  await page.evaluate(() => {
    const key = 'dino-realms-save-v1',
      s = JSON.parse(localStorage.getItem(key));
    s.updatedAt = Date.now() - 3_600_000;
    s.storedGold = 0;
    s.farmAt = Date.now() - 30_000;
    s.crafting = [
      { id: 'offline-fixture', recipeId: 'provisions', startedAt: Date.now() - 240_000, endsAt: Date.now() - 60_000 },
    ];
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await page.locator('.realm-offline-strip').waitFor();
  await shot('offline-rewards');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')));
  await page.getByRole('button', { name: 'Collect available', exact: true }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')));
  assert.equal(after.food, before.food + 25);
  assert.equal(after.inventory.provisions, before.inventory.provisions + 1);
  assert.equal(after.crafting.length, 0);
  assert(after.gold >= before.gold + 30);
  await page.reload();
  assert.equal(await page.locator('.realm-offline-strip').count(), 0);
  for (const size of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const rotate = page.getByRole('button', { name: 'Continue', exact: true });
    if (await rotate.isVisible()) await rotate.click();
    await page.getByRole('button', { name: /Expeditions$/ }).click();
    await shot(`map-${size.width}`);
    dialog = page.getByRole('dialog', { name: 'Expeditions', exact: true });
    await dialog.getByRole('button', { name: /Workshop$/ }).click();
    await shot(`workshop-${size.width}`);
    await page
      .getByRole('dialog', { name: 'The workshop', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
  }
  const result = {
    errors,
    failed,
    utilityBuildings: state.buildings.map((b) => b.kind),
    mapWorlds: worlds,
    craftingReload: true,
    battleReload: true,
    offlineCollection: true,
  };
  await fs.writeFile('output/reference-gameplay/review.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (errors.length || failed.length) throw Error('Browser errors or missing assets');
} finally {
  await browser?.close();
  await server.close();
}
