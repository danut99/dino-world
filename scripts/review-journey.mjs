process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ??
    `${process.env.USERPROFILE}/.codex/dragon-preview-tools/node_modules/playwright-core`,
);
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 5293 },
  logLevel: 'error',
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  await fs.mkdir('output/journey', { recursive: true });
  const errors = [];
  const results = [];
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60_000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' });
  for (const lang of ['ro', 'en']) {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [844, 390],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(async (lang) => {
        const g = await import('/src/realms/game.ts');
        let save = g.command(g.newSave(Date.now() - 30_000), { type: 'incubate' }, Date.now() - 30_000);
        save = g.command(save, { type: 'hatch' }, Date.now());
        localStorage.setItem(g.SAVE_KEY, JSON.stringify(save));
        localStorage.setItem('dino-realms-language', lang);
        localStorage.setItem('dino-realms-tour', 'done');
        localStorage.setItem('dino-realms-daily-opened', new Date().toISOString().slice(0, 10));
      }, lang);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.realm-journey-link').waitFor({ state: 'attached' });
      await page.locator('.realm-journey-link').evaluate((el) => el.click());
      const journal = page.locator('.adventure-journal');
      await journal.waitFor();
      await page.waitForTimeout(200);
      const check = async () => {
        const fit = await page.locator('.realm-window').evaluate((el) => {
          const r = el.getBoundingClientRect();
          return {
            horizontal: el.scrollWidth > el.clientWidth + 2,
            outside: r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1,
          };
        });
        assert.equal(fit.horizontal, false, `${lang}/${width}: horizontal overflow`);
        assert.equal(fit.outside, false, `${lang}/${width}: window outside viewport`);
      };
      await check();
      await page.screenshot({ path: `output/journey/${lang}-${width}-story.png` });
      await journal.locator('.journey-steps .realm-button').click();
      assert.match(await journal.locator('[aria-current="step"] h3').textContent(), /ferm|farm/i);
      await journal.locator('.journey-chapters button').last().click();
      assert.equal(
        await journal.locator('.journey-steps .realm-button').count(),
        0,
        'Preview must not bypass chapter order',
      );
      await journal.getByRole('tab').nth(1).click();
      await page.screenshot({ path: `output/journey/${lang}-${width}-targets.png` });
      assert.match(await journal.locator('.collection-goal').first().textContent(), /Ignasaur/);
      await journal.locator('.collection-goal .realm-button').first().click();
      assert.equal(await journal.getByRole('tab').first().getAttribute('aria-selected'), 'true');
      await journal.getByRole('tab').nth(1).click();
      await journal.locator('.journey-open-album').click();
      await page.locator('.hero-book .pk-foot .realm-link').click();
      assert.equal(await page.locator('.hero-book .collection-goal').count(), 1);
      await check();
      await page.screenshot({ path: `output/journey/${lang}-${width}-album.png` });
      results.push({ lang, width, height, passed: true });
      console.log('Passed', lang, width, height);
    }
  }
  assert.deepEqual(errors, []);
  await fs.writeFile('output/journey/report.json', JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
