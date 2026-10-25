// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
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
    save.buildings.push({ id: 'farm', kind: 'farm', x: 7, y: 5 }, { id: 'workshop', kind: 'workshop', x: 1, y: 8 }, { id: 'market', kind: 'market', x: 9, y: 1 });
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
  // Faza 5: panels fit their fixed-height window instead of scrolling.
  assert.ok(initial.content <= initial.height + 2, 'Farm must fit without scrolling');
  assert.equal(await page.locator('.realm-backdrop').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
  await fs.mkdir('output/scroll-ui', { recursive: true });
  await page.screenshot({ path: 'output/scroll-ui/farm.png' });
  // Every fixed-height panel, on every tab, at desktop and phone-landscape sizes: nothing outside [data-scroll]
  // may overflow its window body (scrollHeight ≤ clientHeight + 2).
  const fitPanels = ['Hatchery', 'Farm', 'Workshop', 'Market', 'Build', 'Dinosaurs', 'Collection', 'Realms', 'Diamond shop', 'Daily rewards and missions'];
  const fitResults = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const label of fitPanels) {
      await page.evaluate(() => document.querySelector('.realm-close')?.click());
      const opened = await page.evaluate(name => {
        const button = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent).trim().startsWith(name));
        button?.click();
        return !!button;
      }, label);
      assert.ok(opened, `No button opens ${label}`);
      await page.locator('.realm-window.fit .fit-panel').waitFor();
      const tabs = await page.locator('.realm-window-body [role=tab]').count();
      for (let t = 0; t < Math.max(1, tabs); t++) {
        if (tabs) await page.locator('.realm-window-body [role=tab]').nth(t).click();
        await page.waitForTimeout(150);
        const fit = await page.evaluate(() => {
          const body = document.querySelector('.realm-window-body');
          const box = body.getBoundingClientRect();
          const outside = [...body.querySelectorAll('*')].filter(el => !el.closest('[data-scroll], [popover]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 2)
            .filter(el => el.getBoundingClientRect().bottom > box.bottom + 2).map(el => el.className || el.tagName);
          return { title: document.querySelector('.realm-window h2')?.textContent, height: body.clientHeight, content: body.scrollHeight, outside: outside.slice(0, 5) };
        });
        assert.ok(fit.content <= fit.height + 2 && !fit.outside.length, `${fit.title} overflows at ${viewport.width}×${viewport.height}: ${JSON.stringify(fit)}`);
        fitResults.push({ viewport: `${viewport.width}x${viewport.height}`, ...fit });
      }
      await page.screenshot({ path: `output/scroll-ui/${label.replace(/\W+/g, '-').toLowerCase()}-${viewport.width}.png` });
    }
  }
  await page.evaluate(() => document.querySelector('.realm-close')?.click());
  await page.setViewportSize({ width: 1440, height: 780 });
  const scrolled = 0;
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
  console.log(JSON.stringify({ hud, close, railLayouts, initial, scrolled, fitResults, offlineLayouts, errors }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
