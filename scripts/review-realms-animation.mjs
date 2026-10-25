// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright',
);
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 5221 },
  logLevel: 'error',
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [],
    failures = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(server.resolvedUrls.local[0]))
      failures.push(`${r.status()} ${r.url()}`);
  });
  await fs.mkdir('output/realms/animation', { recursive: true });
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('.realm-world canvas').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.realm-world:not(.loading)').waitFor();
  await page.screenshot({ path: 'output/realms/animation/home.png' });
  await page.getByRole('button', { name: /Artă.*referințe|Art.*reference/i }).click();
  await page.getByLabel('Species', { exact: true }).waitFor();
  const inventory = JSON.parse(await fs.readFile('src/realms/animation-inventory.json', 'utf8'));
  for (const id of inventory) {
    const manifest = JSON.parse(await fs.readFile(`public/realms/animations/${id}/manifest.json`, 'utf8'));
    const stage = manifest.stage;
    const [species, element] = manifest.variantId.split('_');
    await page.getByLabel('Species', { exact: true }).selectOption(species);
    await page.getByLabel('Element', { exact: true }).selectOption(element);
    const required = stage === 'baby' ? ['idle', 'walk'] : ['idle', 'walk', 'attack', 'defend', 'hurt', 'death', ...(stage === 'adult' ? ['ultimate'] : [])];
    if (manifest.stage !== stage || required.some(name => !manifest.clips.se?.[name])) throw new Error(`${stage}: missing required South-East clips`);
    const initialClip = manifest.clips.se?.idle ? 'idle' : Object.keys(manifest.clips.se ?? {}).find(name => manifest.clips.se[name].loop);
    await page.getByLabel('Stage', { exact: true }).selectOption(stage);
    await page.getByLabel('Animation', { exact: true }).locator(`option[value="${initialClip}"]:enabled`).waitFor({ state: 'attached' });
    await page.getByLabel('Animation', { exact: true }).selectOption(initialClip);
    await page.locator('.realm-viewer canvas[data-art-ready="true"]').waitFor();
    if (await page.getByLabel('Facing', { exact: true }).inputValue() !== 'se') throw new Error('Preview must default to South-East');
    const canvas = page.locator('.realm-viewer canvas');
    await page.waitForFunction(
      () => Number(document.querySelector('.realm-viewer canvas')?.getAttribute('data-frame')) > 0,
    );
    await page.screenshot({ path: `output/realms/animation/${id}-viewer.png` });
    for (const [facing, clips] of Object.entries(manifest.clips)) {
      await page.getByLabel('Facing', { exact: true }).selectOption(facing);
      for (const name of Object.keys(clips)) {
        await page.getByLabel('Animation', { exact: true }).selectOption(name);
        await page.waitForFunction(expected => {
          const canvas = document.querySelector('.realm-viewer canvas');
          return canvas?.getAttribute('data-animation') === expected && Number(canvas.getAttribute('data-frame')) > 0;
        }, name);
        if (name === 'walk') await page.screenshot({ path: `output/realms/animation/${id}-walk-${facing}.png` });
      }
    }
    await page.getByLabel('Facing', { exact: true }).selectOption('se');
    await page.getByLabel('Animation', { exact: true }).selectOption(initialClip);
    await page.getByRole('button', { name: /Pauză|Pause/ }).click();
    await page.getByRole('button', { name: /Cadru următor|Next frame/ }).click();
    await page.waitForFunction(
      () => document.querySelector('.realm-viewer canvas')?.getAttribute('data-frame') === '1',
    );
    if (manifest.clips.se?.death) {
      await page.getByLabel('Facing', { exact: true }).selectOption('se');
      await page.getByLabel('Animation', { exact: true }).selectOption('death');
    }
    await page.getByRole('button', { name: /Redă|Play/, exact: true }).click();
    if (manifest.clips.se?.death) {
      const death = manifest.clips.se.death;
      await page.waitForFunction(
        (last) => document.querySelector('.realm-viewer canvas')?.getAttribute('data-frame') === String(last),
        death.durationsMs.length - 1,
      );
      await page.waitForTimeout(200);
      if ((await canvas.getAttribute('data-frame')) !== String(death.durationsMs.length - 1))
        throw new Error('Defeat pose looped');
    }
    await page.getByLabel('Facing', { exact: true }).selectOption('se');
    await page.getByLabel('Animation', { exact: true }).selectOption(initialClip);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (inventory.length) {
    const canvas = page.locator('.realm-viewer canvas');
    await page.waitForTimeout(200);
    const before = await canvas.getAttribute('data-frame');
    await page.waitForTimeout(250);
    if ((await canvas.getAttribute('data-frame')) !== before) throw new Error('Reduced motion did not stop frames');
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: 'output/realms/animation/landscape-viewer.png' });
  const result = {
    errors,
    failures,
    inventory,
    checks: [
      'desktop home',
      'asset viewer',
      'landscape viewer',
      ...(inventory.length ? ['frame stepping', 'reduced motion'] : []),
      ...(inventory.length ? ['all imported clips and facings render real frames', 'one-shot defeat holds its final frame'] : []),
    ],
  };
  await fs.writeFile('output/realms/animation/review.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (errors.length || failures.length) throw new Error('Browser errors or missing local assets');
} finally {
  await browser?.close();
  await server.close();
}
