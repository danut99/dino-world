import { createServer } from 'vite';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5249 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 780 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(async () => {
    const { newSave } = await import('/src/realms/game.ts');
    const save = newSave(Date.now());
    save.buildings.push({ id: 'farm', kind: 'farm', x: 7, y: 5 });
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(save));
    localStorage.setItem('dino-realms-current-world', 'home');
  });
  await page.reload();
  await page.locator('.realm-square').first().waitFor();
  const checkCenters = async selector => {
    const centers = await page.locator(selector).evaluateAll(buttons => buttons.map(button => {
      const b = button.getBoundingClientRect();
      const i = button.querySelector('.px-icon').getBoundingClientRect();
      return { x: (i.left + i.width / 2) - (b.left + b.width / 2), y: (i.top + i.height / 2) - (b.top + b.height / 2) };
    }));
    assert.ok(centers.length > 0);
    for (const center of centers) assert.ok(Math.abs(center.x) < 1 && Math.abs(center.y) < 1, JSON.stringify(center));
    return centers;
  };
  const hud = await checkCenters('.realm-square');
  const railLayouts = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 1280, height: 600 }]) {
    await page.setViewportSize(viewport);
    const quest = await page.locator('.realm-quest').boundingBox();
    assert.equal(await page.locator('.realm-building-shortcuts, .world-resident-book').count(), 0);
    const mission = await page.locator('.realm-quest-body').evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight, overflow: getComputedStyle(el).overflowY }));
    assert.ok(mission.content <= mission.height + 1, 'Mission must be fully visible');
    assert.equal(mission.overflow, 'visible');
    railLayouts.push({ viewport, quest, mission });
  }
  await page.setViewportSize({ width: 1440, height: 780 });
  await page.locator('.production-bubble[aria-label="Farm"]').click();
  await page.locator('.realm-farm').waitFor();
  const close = await checkCenters('.realm-close');
  const body = page.locator('.realm-window-body');
  const initial = await body.evaluate(el => ({ top: el.scrollTop, height: el.clientHeight, content: el.scrollHeight, contain: getComputedStyle(el).contain }));
  assert.ok(initial.content > initial.height, 'Farm must be scrollable');
  assert.equal(await page.locator('.realm-backdrop').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
  await body.hover();
  await page.mouse.wheel(0, 380);
  await page.waitForFunction(() => document.querySelector('.realm-window-body').scrollTop > 0);
  const scrolled = await body.evaluate(el => el.scrollTop);
  await fs.mkdir('output/scroll-ui', { recursive: true });
  await page.screenshot({ path: 'output/scroll-ui/farm.png' });
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('dino-realms-save-v1'));
    save.updatedAt = Date.now() - 120_000;
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(save));
  });
  await page.reload();
  await page.locator('.realm-offline-strip').waitFor();
  const offlineLayouts = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const banner = await page.locator('.realm-offline-strip').boundingBox();
    const location = await page.locator('.realm-location').boundingBox();
    assert.ok(banner.y < 120, 'Offline notice should appear near the top');
    assert.ok(banner.x >= 0 && banner.x + banner.width <= viewport.width, 'Offline notice must fit horizontally');
    assert.ok(banner.y + banner.height <= location.y || location.y + location.height <= banner.y, 'Offline notice overlaps world title');
    offlineLayouts.push({ viewport, banner });
    await page.screenshot({ path: `output/scroll-ui/offline-${viewport.width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ hud, close, railLayouts, initial, scrolled, offlineLayouts, errors }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
