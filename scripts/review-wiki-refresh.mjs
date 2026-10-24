process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5246 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('dino-realms-language', 'en');
    localStorage.setItem('dino-realms-daily-opened', new Date().toISOString().slice(0,10));
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('button', { name: 'Wikipedia', exact: true }).click();
  await page.locator('.realms-wiki').waitFor();
  const data = await page.evaluate(async () => {
    const { wikiArticles } = await import('/src/realms/RealmsWiki.tsx');
    for (const lang of [0, 1]) {
      const articles = wikiArticles(lang), ids = new Set(articles.map(a => a.id));
      if (ids.size !== articles.length) throw Error('Duplicate article');
      for (const a of articles) for (const id of a.related) if (!ids.has(id)) throw Error(`Broken relation: ${id}`);
      if (!articles.find(a => a.id === 'crafting').rows.some(row => row.includes('50'))) throw Error('Missing recipe food');
      if (!articles.find(a => a.id === 'saving').paragraphs.join(' ').includes('cloud')) throw Error('Missing cloud help');
    }
    return wikiArticles(1).map(a => ({ id: a.id, title: a.title }));
  });
  assert.equal(await page.locator('.realms-wiki-results > button').count(), data.length);
  await fs.mkdir('output/realms-wiki', { recursive: true });
  await page.screenshot({ path: 'output/realms-wiki/desktop.png' });
  const search = page.getByRole('searchbox');
  await search.fill('hatchery');
  await page.locator('.realms-wiki-results > button').filter({ hasText: 'Eggs and hatchery' }).click();
  await page.locator('.realms-wiki-related').getByRole('button', { name: 'Market and buying eggs' }).click();
  await page.getByRole('heading', { name: 'Market and buying eggs', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back to articles' }).click();
  await search.fill('zzzz-no-match');
  assert.equal(await page.locator('.realms-wiki-results > button').count(), 0);
  await search.fill('');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const a of data) {
      await page.locator('.realms-wiki-results > button').filter({ has: page.getByText(a.title, { exact: true }) }).click();
      await page.getByRole('heading', { name: a.title, exact: true }).waitFor();
      const images = await page.locator('.realms-wiki-content img').evaluateAll(images => Promise.all(images.map(img => img.decode().then(() => true, () => false))));
      assert.ok(images.every(Boolean), `Broken image: ${a.id}`);
      assert.ok(await page.locator('.realms-wiki-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `Overflow: ${a.id} at ${width}`);
      if (['species', 'worlds', 'daily'].includes(a.id)) await page.screenshot({ path: `output/realms-wiki/${a.id}-${width}.png` });
      await page.getByRole('button', { name: 'Back to articles' }).click();
    }
    console.log(`All ${data.length} articles passed at ${width}px`);
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.realms-wiki').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Bilingual rules, search, links, images and mobile layout passed.');
} finally { await browser?.close(); await server.close(); }
