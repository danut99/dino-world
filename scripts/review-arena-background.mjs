// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5257 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(async () => {
    const { newSave } = await import('/src/realms/game.ts');
    const now = Date.now();
    const save = newSave(now);
    save.dinos = [{ id: 'ignis', species: 'trex', element: 'fire', level: 12, stage: 'juvenile', nickname: 'Ignis' }];
    save.champion = 'ignis'; save.rewardedTutorial = true;
    save.cleared = ['training'];
    save.buildings.push({ id: 'arena', kind: 'arena', x: 7, y: 7 });
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(save));
  });
  await page.clock.install();
  await page.reload();
  await page.locator('.realm-nav button').filter({ hasText: 'PvE Arena' }).click();
  await page.locator('.arena-preview-stage canvas').waitFor();
  await page.locator('.adventure-start').click();
  await page.locator('.arena-embedded-battle').waitFor();
  assert.equal(await page.locator('.gameplay-screen').count(), 1, 'Battle stays inside the existing arena page');
  assert.equal(await page.locator('.adventure-detail').count(), 1, 'Arena sidebar stays mounted');
  await page.locator('.battle-stage').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.battle-stage canvas').length >= 2);
  await page.evaluate(() => {
    window.arenaRemovals = 0;
    window.arenaClipChanges = 0;
    window.arenaObserver = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes' && record.attributeName === 'data-animation') window.arenaClipChanges++;
        for (const node of record.removedNodes) {
          if (node.nodeType === 1 && (node.matches('canvas') || node.querySelector('canvas'))) window.arenaRemovals++;
        }
      }
    });
    window.arenaObserver.observe(document.querySelector('.battle-stage'), { subtree: true, childList: true, attributes: true, attributeFilter: ['data-animation'] });
  });
  await page.clock.runFor(12000);
  const continuity = await page.evaluate(() => ({ removed: window.arenaRemovals, changes: window.arenaClipChanges }));
  assert.equal(continuity.removed, 0, 'Characters must retain their canvases when attacks change');
  assert.ok(continuity.changes > 0, 'Must observe actual animation transitions');
  await fs.mkdir('output/arena-background', { recursive: true });
  const checks = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    // A landed blow briefly shakes and scales the stage; measure it at rest.
    await page.evaluate(() => Promise.all(document.querySelector('.battle-stage').getAnimations().map(a => a.finished)));
    const stage = await page.locator('.battle-stage').boundingBox();
    const host = await page.locator('.battle-environment').boundingBox();
    assert.ok(stage.x >= host.x - 1 && stage.y >= host.y - 1);
    assert.ok(stage.x + stage.width <= host.x + host.width + 1);
    assert.ok(stage.y + stage.height <= host.y + host.height + 1);
    assert.ok(Math.abs(stage.width - host.width) < 1 && Math.abs(stage.height - host.height) < 1);
    const health = await page.locator('.battle-vitals.ally').boundingBox();
    const foeHealth = await page.locator('.battle-vitals.enemy').boundingBox();
    assert.ok(health.x + health.width <= foeHealth.x + 1, 'Health cards must not overlap');
    await page.screenshot({ path: `output/arena-background/${viewport.width}.png` });
    checks.push({ viewport, stage });
  }
  for (let i = 0; i < 12 && !(await page.locator('.battle-result').count()); i++) await page.clock.runFor(5000);
  await page.locator('.battle-result .realm-button').click();
  await page.locator('.arena-preview-stage').waitFor();
  assert.equal(await page.locator('.gameplay-screen').count(), 1);
  assert.equal(await page.locator('.gameplay-arena').count(), 1, 'Claiming returns to the same arena');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, continuity, errors }, null, 2));
} finally { await browser?.close(); await server.close(); }
