process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5248 }, logLevel: 'error' });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('dino-realms-language', 'en');
    localStorage.setItem('dino-realms-daily-opened', new Date().toISOString().slice(0,10));
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('.realm-nav button').filter({ has: page.locator('.px-icon') }).evaluateAll(buttons => { const b = buttons.find(b => /build/i.test(b.textContent) || /build/i.test(b.getAttribute('aria-label') || '')); if (!b) throw Error('Build button missing'); b.click(); });
  await page.locator('.compact-builder').waitFor();
  assert.equal(await page.locator('.build-picker button').count(), 6);
  await fs.mkdir('output/build-panel', { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const button of await page.locator('.build-picker button').all()) {
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.build-preview').count(), 1);
    }
    const overflow = await page.locator('.compact-builder').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
    if (overflow.scroll > overflow.width + 1) console.log(await page.locator('.compact-builder').evaluate(el => { const r = el.getBoundingClientRect(); return [...el.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > r.right + 1).map(e => ({ cls: e.className, width: e.getBoundingClientRect().width, text: e.textContent.slice(0,80) })); }));
    assert.ok(overflow.scroll <= overflow.width + 1, `Overflow at ${width}: ${JSON.stringify(overflow)}`);
    await page.locator('.build-summary').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/build-panel/${width}.png` });
    for (const button of await page.locator('.build-preview button:enabled').all()) {
      await button.scrollIntoViewIfNeeded();
      const hit = await button.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2)); });
      assert.ok(hit, `Blocked button at ${width}`);
    }
  }
  await page.locator('.build-picker button').first().click(); await page.locator('.build-move').click();
  await page.locator('.realm-placement').waitFor();
  assert.equal(await page.locator('.compact-builder').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Compact building selector, previews, mobile overflow, touch targets and Move passed.');
} finally { await browser?.close(); await server.close(); }
