// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
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
    s.arenaLevel = 2;
    s.buildings.push({ id: 'arena', kind: 'arena', x: 7, y: 5 });
    // Three level-50 bosses with no edge against the late leagues, so every Champion tier is won and its boss shows.
    s.dinos = ['fire', 'water', 'earth'].map((element) => ({ id: `review-${element}`, species: 'boss', element, stage: 'adult', level: 50, rarity: 'legendary', nickname: element }));
    s.team = s.dinos.map((d) => d.id);
    s.champion = s.team[0];
    s.habitats = Object.fromEntries(ELEMENTS.map(e => [e.id, 1]));
    s.arenaTickets = Object.fromEntries(ELEMENTS.map(e => [e.id, 9]));
    // Two stars on the first two tiers of every league open its Champion tier.
    s.stars = Object.fromEntries(ENCOUNTERS.filter(e => !e.id.endsWith('-3')).map(e => [e.id, 3]));
    s.cleared = Object.keys(s.stars);
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(s));
    localStorage.setItem('dino-realms-current-world', 'home');
  });
  await page.reload();
  await fs.mkdir('output/arena-bosses', { recursive: true });
  await page.getByRole('button', { name: /PvE Arena/ }).click();
  const elements = ['fire', 'water', 'earth', 'nature', 'ice', 'lightning', 'wind', 'dark', 'light', 'arcane'];
  for (const [index, element] of elements.entries()) {
    // League chips, then the Champion tier chip; the boss enters last in the lobby line-up.
    await page.locator('.arena-league-chips button').nth(index).click();
    await page.locator('.arena-tier-chips button').nth(2).click();
    await page.locator(`.arena-foe-figure.boss canvas[data-boss="${element}"]`).waitFor();
    await page.screenshot({ path: `output/arena-bosses/${element}-lobby.jpg`, type: 'jpeg', quality: 78 });
    await page.locator('.adventure-start').click();
    // A fight the forecast calls lost asks for a second click.
    if (await page.locator('.adventure-start.armed').count()) await page.locator('.adventure-start').click();
    await page.locator('.battle-unit.enemy').waitFor();
    // The relay plays out at once; the boss is the last opponent on stage.
    await page.getByRole('button', { name: /Skip/ }).click();
    await page.locator(`.battle-unit.enemy canvas[data-boss="${element}"]`).waitFor();
    await page.screenshot({ path: `output/arena-bosses/${element}-battle.jpg`, type: 'jpeg', quality: 78 });
    // Clear only this review fixture's battle (and the team's rest) to inspect the next league independently.
    await page.evaluate(() => { const key = 'dino-realms-save-v1'; const s = JSON.parse(localStorage.getItem(key)); s.battle = null; s.rewardPending = false; s.tired = {}; localStorage.setItem(key, JSON.stringify(s)); });
    await page.reload(); await page.getByRole('button', { name: /PvE Arena/ }).click();
  }
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  await fs.writeFile('output/arena-bosses/review.json', JSON.stringify({ leagues: elements.length, lobbyAndBattle: true, errors, missing }, null, 2));
  console.log('All released bosses render in their champion lobby and battle. No browser errors or missing boss assets.');
} finally { await browser?.close(); await server.close(); }
