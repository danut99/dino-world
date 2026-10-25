// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const elements = ['fire','water','earth','nature','ice','lightning','wind','dark','light','arcane'];
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5240 }, logLevel: 'error' });
await server.listen(); let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [], failed = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(server.resolvedUrls.local[0])) failed.push(r.url()); });
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(async () => {
    const { newSave, ELEMENTS } = await import('/src/realms/game.ts');
    const save = newSave(Date.now());
    save.habitats = Object.fromEntries(ELEMENTS.map(e => [e.id, 1]));
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(save));
  });
  await fs.mkdir('output/wide-worlds', { recursive: true });
  for (const element of elements) {
    await page.evaluate(e => localStorage.setItem('dino-realms-current-world', e), element);
    await page.reload();
    await page.locator(`.realm-world[data-realm="${element}"][data-environment-ready="true"]`).waitFor();
    const dimensions = await page.evaluate(async e => { const img = new Image(); img.src = `/realms/worlds/${e}-wide-v1.webp`; await img.decode(); return { width: img.naturalWidth, height: img.naturalHeight }; }, element);
    assert.ok(dimensions.width / dimensions.height > 1.7);
    const world = page.locator('.realm-world'), canvas = page.locator('.realm-world canvas');
    for (const viewport of [{ width: 1440, height: 810 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const prompt = page.locator('.realm-portrait button');
      if (await prompt.isVisible()) await prompt.click();
      for (const zoom of [1, 2]) {
        while (Number(await world.getAttribute('data-camera-zoom')) < zoom)
          await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
        for (const direction of [-1, 1]) {
          const x = viewport.width / 2, y = viewport.height * 0.62;
          await page.mouse.move(x, y); await page.mouse.down();
          await page.mouse.move(x + direction * 10000, y, { steps: 12 }); await page.mouse.up();
          const box = await canvas.boundingBox();
          const visible = viewport.width / box.width * 1536;
          const limit = (dimensions.width / dimensions.height * 1024 * zoom - visible) / 2;
          const pan = Number(await world.getAttribute('data-camera-x'));
          assert.ok(Math.abs(pan - direction * limit) < 1, `${element} ${viewport.width} ${zoom}: ${pan} vs ${limit}`);
          checks.push({ element, width: viewport.width, zoom, direction, pan });
        }
        await page.getByRole('button', { name: 'Center island', exact: true }).click();
      }
      if (viewport.width === 1440) await page.screenshot({ path: `output/wide-worlds/${element}.jpg`, type: 'jpeg', quality: 78 });
    }
    await page.setViewportSize({ width: 1440, height: 810 });
  }
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  await fs.writeFile('output/wide-worlds/review.json', JSON.stringify({ checks, errors, failed }, null, 2));
  console.log(`${checks.length} camera checks passed across ten wide worlds, desktop and mobile. No browser errors or missing assets.`);
} finally { await browser?.close(); await server.close(); }
