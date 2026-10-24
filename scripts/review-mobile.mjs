// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright')); }
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5226 }, logLevel: 'error' });
await server.listen();
let browser;
const errors = [];
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  await fs.mkdir('output/mobile', { recursive: true });
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [844, 390], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
    await page.goto(server.resolvedUrls.local[0]);
    await page.locator('.realm-world[data-environment-ready="true"]').waitFor();
    await page.screenshot({ path: `output/mobile/compact-${width}.png` });
    if (width <= 760 || (height <= 500 && width <= 1050)) {
      if (await page.locator('.realm-nav > button:visible').count() !== 2)
        throw Error(`${width}x${height}: mobile menu should start folded`);
      await page.locator('.realm-avatar').click();
      await page.locator('.realm-profile-card').waitFor();
      if (await page.locator('.realm-profile-stats .realm-resource').count() !== 3)
        throw Error('Profile must show gold, food and level');
      await page.screenshot({ path: `output/mobile/profile-${width}.png` });
      await page.locator('.realm-profile-card').getByRole('button', { name: 'Close resources' }).click();
      await page.getByRole('button', { name: 'Show the story', exact: true }).click();
      await page.getByRole('button', { name: 'Collapse the story', exact: true }).click();
    }
    const toggle = page.locator('.realm-nav-toggle');
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    const check = async (selector) => {
      const issues = await page.locator(selector).evaluateAll((nodes) => nodes.flatMap((node) => {
        const r = node.getBoundingClientRect();
        if (!r.width || !r.height) return [];
        return r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1
          ? [`${node.className}: ${JSON.stringify({ x: r.x, y: r.y, width: r.width, height: r.height })}`] : [];
      }));
      if (issues.length) throw Error(`${width}x${height}: ${issues.join('; ')}`);
    };
    await check('.realm-hud, .realm-hud > button, .realm-resource, .realm-nav, .realm-nav > button, .realm-camera');
    await page.screenshot({ path: `output/mobile/home-${width}.png` });
    for (const name of ['Build', 'Collection', 'Realms']) {
      await page.getByRole('button', { name: new RegExp(`${name}$`) }).click();
      await page.getByRole('dialog').waitFor();
      await check('.realm-window, .realm-close');
      const overflow = await page.locator('.realm-window-body').evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      if (overflow) throw Error(`${width}x${height}: ${name} panel overflows horizontally`);
      await page.screenshot({ path: `output/mobile/${name.toLowerCase()}-${width}.png` });
      await page.getByRole('button', { name: 'Close', exact: true }).click();
    }
    await page.close();
    console.log(`Passed ${width}x${height}`);
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser?.close(); await server.close(); }
