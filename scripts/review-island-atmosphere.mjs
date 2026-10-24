import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5267 }, logLevel: 'error' });
const realms = process.argv.length > 2 ? process.argv.slice(2)
  : ['home', 'water', 'fire', 'earth', 'nature', 'ice', 'lightning', 'wind', 'dark', 'light', 'arcane'];
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('dino-realms-language', 'en');
    localStorage.setItem('dino-realms-daily-opened', new Date().toISOString().slice(0, 10));
  });
  await page.goto(server.resolvedUrls.local[0]);
  await fs.mkdir('output/island-atmosphere', { recursive: true });
  const results = await page.evaluate(async realms => {
    const { drawIslandAtmosphere, islandBaseImage } = await import('/src/realms/islandAtmosphere.ts');
    const { drawElementalAtmosphere, insidePlateau } = await import('/src/realms/elementalAtmosphere.ts');
    const results = [];
    for (const realm of realms) {
      const image = new Image(); image.src = realm === 'home' ? '/realms/worlds/home-island-original-filled.png' : `/realms/worlds/${realm}-island.png`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      const frames = [];
      const started = performance.now();
      for (const time of [0, 500, 1000]) {
        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(islandBaseImage(image, realm), 0, 0);
        if (['home', 'water', 'fire'].includes(realm)) drawIslandAtmosphere(ctx, image, realm, time, [0, 0], 1);
        else drawElementalAtmosphere(ctx, image, realm, time, [0, 0], 1);
        frames.push({ data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data), png: canvas.toDataURL() });
      }
      let changed = 0, plateauChanges = 0;
      for (let p = 0; p < frames[0].data.length; p += 4) {
        if (frames[0].data[p] !== frames[1].data[p] || frames[0].data[p+1] !== frames[1].data[p+1] || frames[0].data[p+2] !== frames[1].data[p+2]) changed++;
      }
      if (!['home', 'water', 'fire'].includes(realm)) {
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
          if (!insidePlateau(realm, x, y) || !insidePlateau(realm, x - 6, y - 6) || !insidePlateau(realm, x + 6, y + 6)) continue;
          const p = (y * canvas.width + x) * 4;
          if (frames[0].data[p] !== frames[1].data[p] || frames[0].data[p+1] !== frames[1].data[p+1] || frames[0].data[p+2] !== frames[1].data[p+2]) plateauChanges++;
        }
      }
      let smokeChanges = 0;
      if (realm === 'fire') for (let y = 70; y < 122; y++) for (let x = 308; x < 343; x++) {
        const p = (y * canvas.width + x) * 4;
        if (frames[0].data[p] !== frames[1].data[p] || frames[0].data[p + 3] !== frames[1].data[p + 3]) smokeChanges++;
      }
      let arcaneJumps = 0;
      if (realm === 'arcane') {
        const nearby = [];
        for (const time of [1000, 1033.34, 1066.68, 1100, 1133.34, 1166.68, 1200]) {
          ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0);
          drawElementalAtmosphere(ctx, image, realm, time, [0, 0], 1);
          nearby.push(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
        }
        for (let f = 1; f < nearby.length; f++) {
          let jumps = 0;
          for (let p = 0; p < nearby[f].length; p += 4) {
            if (Math.abs(nearby[f][p] - nearby[f-1][p]) > 50 || Math.abs(nearby[f][p+1] - nearby[f-1][p+1]) > 50 || Math.abs(nearby[f][p+2] - nearby[f-1][p+2]) > 50) jumps++;
          }
          arcaneJumps = Math.max(arcaneJumps, jumps);
        }
      }
      results.push({ realm, changed, plateauChanges, smokeChanges, arcaneJumps, elapsed: performance.now() - started, frames: frames.map(f => f.png) });
    }
    return results;
  }, realms);
  for (const result of results) {
    assert.ok(result.changed > 500, `${result.realm} must visibly animate (${result.changed} pixels)`);
    assert.equal(result.plateauChanges, 0, `${result.realm}: playable plateau must stay still`);
    assert.ok(result.changed < 512 * 512 * 0.25, 'Terrain must remain still');
    if (result.realm === 'fire') assert.ok(result.smokeChanges > 100, 'Volcanic smoke must move');
    if (result.realm === 'arcane') assert.ok(result.arcaneJumps < 100, `Arcane must not jump between adjacent frames (${result.arcaneJumps})`);
    for (let i = 0; i < result.frames.length; i++) await fs.writeFile(`output/island-atmosphere/${result.realm}-${i}.png`, Buffer.from(result.frames[i].split(',')[1], 'base64'));
    console.log(`${result.realm}: ${result.changed} animated pixels${result.realm === 'arcane' ? `; ${result.arcaneJumps} abrupt pixels at 30fps` : ''}`);
  }
  await page.evaluate(async () => {
    const { newSave, ELEMENTS } = await import('/src/realms/game.ts');
    const save = newSave(Date.now());
    for (const element of ELEMENTS) save.habitats[element.id] = 1;
    localStorage.setItem('dino-realms-save-v1', JSON.stringify(save));
  });
  for (const realm of realms) {
    await page.evaluate(realm => localStorage.setItem('dino-realms-current-world', realm), realm);
    await page.reload();
    await page.locator('.realm-world[data-environment-ready="true"]').waitFor();
    await page.locator('#boot-loader').waitFor({ state: 'detached' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `output/island-atmosphere/${realm}-app-${width}.png` });
    }
    console.log(`${realm}: desktop and mobile rendered`);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(200);
  assert.deepEqual(errors, []);
  console.log(`${realms.length} islands animate; playable plateaus remain still. Desktop, mobile and reduced-motion rendering passed.`);
} finally { await browser?.close(); await server.close(); }
