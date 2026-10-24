// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(
    process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright',
  ));
}
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 5218 },
  logLevel: 'error',
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [],
    failed = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(server.resolvedUrls.local[0])) failed.push(`${r.status()} ${r.url()}`);
  });
  await fs.mkdir('output/realms', { recursive: true });
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('.realm-world canvas').waitFor();
  await page.evaluate(async () => {
    await Promise.all(
      [
        '/realms/home-island-wide-v1.webp',
        '/realms/building-concepts.webp',
        '/realms/worlds/fire-wide-v1.webp',
      ].map((src) => {
        const i = new Image();
        i.src = src;
        return i.decode();
      }),
    );
  });
  await page.screenshot({ path: 'output/realms/home.png' });
  await page.clock.install();
  await page.getByRole('button', { name: 'Continuă povestea' }).click();
  await page.getByRole('button', { name: 'Începe incubarea · 30s' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Continuă povestea' }).click();
  await page.clock.fastForward(31_000);
  await page.getByRole('button', { name: 'Eclozează oul' }).click();
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: /^Hrănește/ }).click();
  await page.getByRole('button', { name: /^Evoluează/ }).click();
  await page.screenshot({ path: 'output/realms/juvenile.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /Expediții$/ }).click();
  await page.getByRole('button', { name: 'Începe aventura' }).click();
  await page.getByRole('button', { name: /Flacără/ }).click();
  await page.reload();
  await page.getByRole('dialog', { name: 'Poiana de antrenament' }).waitFor();
  await page.screenshot({ path: 'output/realms/battle.png' });
  for (let i = 0; i < 12 && (await page.getByRole('button', { name: /Lovitură/ }).count()); i++)
    await page.getByRole('button', { name: /Lovitură/ }).click();
  await page.getByRole('button', { name: 'Colectează recompensa' }).click();
  if ((await page.locator('.realm-world').getAttribute('data-realm')) !== 'fire')
    throw Error('Hatched dinosaur must live in the fire world');
  await page.screenshot({ path: 'output/realms/fire-world.png' });
  await page.getByRole('button', { name: /Construiește$/ }).click();
  await page.getByRole('button', { name: '100 ●', exact: true }).click();
  const canvas = page.locator('.realm-world canvas'),
    r = await canvas.boundingBox();
  await page.mouse.click(r.x + (639 / 1536) * r.width, r.y + (539 / 1024) * r.height);
  await page.getByRole('button', { name: /^❧ Fermă/ }).click();
  await page.getByRole('button', { name: 'Plantează · gratuit' }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.clock.fastForward(61_000);
  await page.getByRole('button', { name: /^❧ Fermă/ }).click();
  await page.getByRole('button', { name: 'Recoltează · +25 hrană' }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.screenshot({ path: 'output/realms/progress.png' });
  if (
    (await page.locator('.realm-world').getAttribute('data-realm')) !== 'home' ||
    (await page.locator('.realm-world').getAttribute('data-residents')) !== '0'
  )
    throw Error('Home must contain utilities, not habitat residents');
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')));
  if (progress.victories !== 1 || progress.food !== 205 || progress.gold !== 1350 || progress.dino.level !== 10)
    throw Error(`Unexpected tutorial state: ${JSON.stringify(progress)}`);
  if (progress.buildings.some((b) => b.kind === 'habitat') || progress.dino.realm !== 'fire')
    throw Error('Habitat must be a separate world');
  const worlds = [
    ['fire', 'Foc'],
    ['water', 'Apă'],
    ['earth', 'Pământ'],
    ['nature', 'Natură'],
    ['ice', 'Gheață'],
    ['lightning', 'Fulger'],
    ['wind', 'Vânt'],
    ['dark', 'Întuneric'],
    ['light', 'Lumină'],
    ['arcane', 'Arcan'],
  ];
  const worldArt = [];
  for (const [id, name] of worlds) {
    await page.getByRole('button', { name: /Tărâmuri$/ }).click();
    if (id === 'fire') await page.screenshot({ path: 'output/realms/world-map.png' });
    await page.getByRole('button', { name: `Intră în lumea: ${name}`, exact: true }).click();
    await page.locator('.realm-world[data-environment-ready="true"]').waitFor();
    const dimensions = await page.evaluate(async (worldId) => {
      const img = new Image();
      img.src = `/realms/worlds/${worldId}.png`;
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight };
    }, id);
    if (dimensions.width < 1500 || dimensions.height < 1000)
      throw Error(`World art is too small: ${id} ${JSON.stringify(dimensions)}`);
    worldArt.push({ id, ...dimensions });
    if ((await page.locator('.realm-world').getAttribute('data-realm')) !== id)
      throw Error(`World navigation failed: ${id}`);
    if ((await page.locator('.realm-world').getAttribute('data-residents')) !== (id === 'fire' ? '1' : '0'))
      throw Error(`Resident leaked into ${id}`);
    await page.screenshot({ path: `output/realms/world-${id}.png` });
  }
  await page.getByRole('button', { name: /Insula principală$/ }).click();
  await page.getByRole('button', { name: 'Setări', exact: true }).click();
  await page.locator('.realm-settings select').selectOption('1');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /Collection$/ }).click();
  await page.screenshot({ path: 'output/realms/collection.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: 'output/realms/landscape.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/realms/portrait.png' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /Collection$/ }).click();
  await page.screenshot({ path: 'output/realms/mobile-collection.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server.resolvedUrls.local[0]}?mode=classic`);
  await page.locator('.hud-brand').waitFor();
  await page.screenshot({ path: 'output/realms/classic.png' });
  const result = {
    errors,
    failed,
    visitedWorlds: worlds.map(([id]) => id),
    worldArt,
    progress: {
      level: progress.dino.level,
      stage: progress.dino.stage,
      residentWorld: progress.dino.realm,
      mainBuildings: progress.buildings.map((b) => b.kind),
      food: progress.food,
      gold: progress.gold,
      victories: progress.victories,
    },
    screenshots: 21,
  };
  await fs.writeFile('output/realms/review.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (errors.length || failed.length) throw Error('Browser errors detected');
} finally {
  await browser?.close();
  await server.close();
}
