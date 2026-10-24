import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5251 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('.daily-panel').waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(async () => {
    const { newSave } = await import('/src/realms/game.ts');
    const save = newSave(Date.now());
    save.buildings.push({ id: 'workshop', kind: 'workshop', x: 7, y: 3 });
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(save));
  });
  await page.reload();
  await page.locator('.realm-nav button').filter({ hasText: 'Workshop' }).click();
  await page.locator('.craft-use').waitFor();
  await fs.mkdir('output/workshop-layout', { recursive: true });
  const results = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 740 }]) {
    await page.setViewportSize(viewport);
    const layout = page.locator('.crafting-layout');
    await layout.evaluate(el => { el.scrollTop = 0; });
    const overflow = await layout.evaluate(el => el.scrollWidth - el.clientWidth);
    assert.ok(overflow <= 1, `Horizontal overflow at ${viewport.width}: ${overflow}`);
    if (viewport.width <= 760) {
      const tabs = page.locator('.craft-recipe-tabs button');
      for (const tab of await tabs.all()) {
        await tab.scrollIntoViewIfNeeded();
        await tab.click();
        assert.ok(await tab.evaluate(el => el.classList.contains('active')));
      }
    }
    await page.screenshot({ path: `output/workshop-layout/${viewport.width}-recipe.png` });
    const card = page.locator('.craft-use .realm-upgrade-card');
    await card.scrollIntoViewIfNeeded();
    const details = await card.locator('.realm-upgrade-details').boundingBox();
    const button = await card.locator('button').boundingBox();
    assert.ok(button.y >= details.y + details.height, 'Upgrade button must sit below costs');
    assert.ok(button.height >= 44, 'Upgrade touch target too small');
    assert.ok(details.width >= 200, 'Upgrade copy is squeezed');
    await page.screenshot({ path: `output/workshop-layout/${viewport.width}-upgrade.png` });
    results.push({ viewport, overflow, details, button });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
