import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5255 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await fs.mkdir('output/farm-states', { recursive: true });
  const results = await page.evaluate(async () => {
    const { FARM_STATES, drawFarm } = await import('/src/realms/animatedFarm.ts');
    const { tierArt, groundLine } = await import('/src/realms/buildingTiers.ts');
    const sheet = document.createElement('canvas');
    sheet.width = 1200; sheet.height = 840;
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#241c18'; ctx.fillRect(0, 0, 1200, 840);
    const results = [];
    for (const [column, state] of FARM_STATES.entries()) {
      const img = new Image(); img.src = state.art; await img.decode();
      const frames = [0, 2500].map(ms => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 400;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        drawFarm(context, img, ms, 0, 0, 400);
        ctx.drawImage(canvas, column * 400, ms ? 440 : 20);
        return context.getImageData(0, 0, 400, 400).data;
      });
      const regionChanges = (x, y, radius) => {
        let changed = 0;
        for (let py = Math.max(0, y - radius); py < Math.min(400, y + radius); py++)
          for (let px = Math.max(0, x - radius); px < Math.min(400, x + radius); px++) {
            const i = (py * 400 + px) * 4;
            if ([0, 1, 2, 3].some(n => frames[0][i + n] !== frames[1][i + n])) changed++;
          }
        return changed;
      };
      ctx.fillStyle = '#f6eed9'; ctx.font = '16px monospace'; ctx.fillText(`Level ${state.from}`, column * 400 + 12, 18);
      results.push({ level: state.from, art: tierArt({ farmLevel: state.from }, 'farm'), ground: groundLine(img), rotorChanges: regionChanges(state.rig.rotor.x, state.rig.rotor.y, state.rig.rotor.radius + 5), smokeChanges: regionChanges(state.rig.chimney.x, state.rig.chimney.y - 25, 30) });
    }
    document.body.replaceChildren(sheet);
    document.body.style.cssText = 'margin:0;overflow:auto';
    sheet.id = 'farm-review';
    return results;
  });
  for (const state of results) {
    assert.ok(state.art.endsWith(`level-${state.level}.png`));
    assert.ok(state.rotorChanges > 100, 'Rotor must animate');
    assert.ok(state.smokeChanges > 20, 'Smoke must animate');
  }
  await page.locator('#farm-review').screenshot({ path: 'output/farm-states/frames.png' });
  await page.reload();
  for (const level of [1, 2, 3]) {
    await page.evaluate(async level => {
      const { newSave } = await import('/src/realms/game.ts');
      const { FARM_LEVELS } = await import('/src/realms/content.ts');
      const save = newSave(Date.now()); save.farmLevel = level;
      save.plots = Array(FARM_LEVELS[level - 1].plots).fill(null);
      save.buildings.push({ id: 'farm', kind: 'farm', x: 7, y: 5 });
      localStorage.setItem('dino-realms-save-v1', JSON.stringify(save));
    }, level);
    await page.reload();
    await page.locator('.realm-nav button').filter({ hasText: 'Build' }).click();
    const farm = page.locator('.realm-build-card').filter({ hasText: 'Farm' });
    await farm.locator('canvas.utility-sprite').waitFor();
    await farm.screenshot({ path: `output/farm-states/shop-${level}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally { await browser?.close(); await server.close(); }
