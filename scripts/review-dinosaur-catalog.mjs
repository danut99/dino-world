import { createRequire } from 'node:module';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const elements = ['fire', 'water', 'earth', 'nature', 'ice', 'lightning', 'wind', 'dark', 'light', 'arcane'];
const names = ['Fire', 'Water', 'Earth', 'Nature', 'Ice', 'Lightning', 'Wind', 'Dark', 'Light', 'Arcane'];
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5224 }, logLevel: 'error' });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], failed = [], checked = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(server.resolvedUrls.local[0])) failed.push(response.url()); });
  await fs.mkdir('output/dinosaur-review', { recursive: true });
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  const shot = name => page.screenshot({ path: `output/dinosaur-review/${name}.jpg`, type: 'jpeg', quality: 78 });
  const isolated = process.argv.includes('--isolated');
  await page.goto(server.resolvedUrls.local[0] + (isolated ? 'scripts/dinosaur-art-review.html' : ''));
  for (let i = 0; i < elements.length; i++) {
    await page.evaluate(element => localStorage.setItem('dino-realms-current-world', element), elements[i]);
    await page.reload();
    await page.locator(`.realm-world[data-realm="${elements[i]}"][data-dinosaur-art-ready="true"][data-environment-ready="true"]`).waitFor();
    assert.equal(await page.locator('.realm-world').getAttribute('data-preview-residents'), '5');
    await shot(`world-${elements[i]}`);
    await page.getByRole('button', { name: /5 species.*Resident art previews/ }).click();
    const filters = page.getByLabel('Element filter');
    await filters.getByRole('button', { name: new RegExp(`${names[i]}$`) }).click();
    for (const stage of ['Baby', 'Juvenile', 'Adult']) {
      await page.getByLabel('Evolution stage', { exact: true }).getByRole('button', { name: stage, exact: true }).click();
      await page.locator('[data-dinosaur] svg[data-art-ready="true"]').first().waitFor();
      assert.equal(await page.locator('[data-dinosaur]').count(), 5);
      const images = await page.locator('[data-dinosaur] svg').evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute('aria-label'), box: node.getAttribute('viewBox'), href: node.querySelector('image').getAttribute('href') })));
      for (const image of images) {
        assert.match(image.label, new RegExp(`^${elements[i]} .* ${stage.toLowerCase()}$`));
        assert.ok(image.box.split(' ').every(value => Number.isFinite(Number(value))));
      }
      checked.push(...images.map(image => image.label));
    }
    await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('[data-dinosaur] image')].map(node => new Promise((resolve, reject) => { const img = new Image(); img.onload = resolve; img.onerror = reject; img.src = node.getAttribute('href'); }))); });
    await shot(`collection-${elements[i]}`);
  }
  for (const width of [844, 390]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    const continuePortrait = page.locator('.realm-portrait button');
    if (await continuePortrait.isVisible()) await continuePortrait.click();
    await shot(`collection-${width}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  assert.equal(checked.length, 150);
  assert.equal(new Set(checked).size, 150);
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  const report = { entry: isolated ? 'isolated component review' : 'full app', designs: checked.length, worlds: elements.length, errors, failed, checked };
  await fs.writeFile('output/dinosaur-review/review.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ designs: checked.length, worlds: elements.length, errors, failed }));
} finally { await browser?.close(); await server.close(); }
