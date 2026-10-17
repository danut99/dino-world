import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5238 }, logLevel: 'error' });
await server.listen(); let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], missing = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().includes('/realms/bosses/')) missing.push(r.url()); });
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(async () => {
    const { newSave, ELEMENTS } = await import('/src/realms/game.ts');
    const { ENCOUNTERS } = await import('/src/realms/content.ts');
    const s = newSave(Date.now());
    s.buildings.push({ id: 'arena', kind: 'arena', x: 7, y: 5 });
    s.dinos = [{ id: 'boss-review-hero', species: 'trex', element: 'fire', stage: 'adult', level: 50, nickname: 'Ignis' }];
    s.champion = s.dinos[0].id;
    s.habitats = Object.fromEntries(ELEMENTS.map(e => [e.id, 1]));
    s.cleared = ENCOUNTERS.filter(e => e.mode === 'arena' && !e.id.endsWith('-3')).map(e => e.id);
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(s));
    localStorage.setItem('dino-realms-current-world', 'home');
  });
  await page.reload();
  await fs.mkdir('output/arena-bosses', { recursive: true });
  await page.getByRole('button', { name: /PvE Arena/ }).click();
  const elements = ['fire','water','earth','nature','ice'];
  for (const element of elements) {
    await page.locator(`.arena-leagues button`).nth(elements.indexOf(element)).click();
    await page.locator('.arena-ladder button').nth(2).click();
    const boss = page.locator(`.arena-lobby-enemy[data-boss="${element}"]`);
    await boss.waitFor(); await boss.evaluate(img => img.decode());
    await page.screenshot({ path: `output/arena-bosses/${element}-lobby.jpg`, type: 'jpeg', quality: 78 });
    await page.locator('.adventure-start').click();
    const enemy = page.locator(`.battle-unit.enemy [data-boss="${element}"]`);
    await enemy.waitFor(); await enemy.evaluate(img => img.decode());
    await page.screenshot({ path: `output/arena-bosses/${element}-battle.jpg`, type: 'jpeg', quality: 78 });
    // Clear only this review fixture's battle to inspect the next league independently.
    await page.evaluate(() => { const key = 'dino-realms-save-v1'; const s = JSON.parse(localStorage.getItem(key)); s.battle = null; localStorage.setItem(key, JSON.stringify(s)); });
    await page.reload(); await page.getByRole('button', { name: /PvE Arena/ }).click();
  }
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  await fs.writeFile('output/arena-bosses/review.json', JSON.stringify({ leagues: elements.length, lobbyAndBattle: true, errors, missing }, null, 2));
  console.log('All released bosses render in their champion lobby and battle. No browser errors or missing boss assets.');
} finally { await browser?.close(); await server.close(); }
