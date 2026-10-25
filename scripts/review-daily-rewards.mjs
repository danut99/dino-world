// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5263 }, logLevel: 'error' });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('.daily-panel').waitFor();
  await page.setViewportSize({ width: 360, height: 740 });
  await fs.mkdir('output/daily-rewards', { recursive: true });
  await page.getByRole('button', { name: 'Spin for free' }).click();
  await page.waitForTimeout(500);
  const duringSpin = await page.locator('.daily-wheel').evaluate(el => getComputedStyle(el).transform);
  assert.notEqual(duringSpin, 'matrix(1, 0, 0, 1, 0, 0)', 'Wheel must animate on mobile');
  await page.screenshot({ path: 'output/daily-rewards/mobile-spinning.png' });
  await page.getByRole('button', { name: 'Come back tomorrow' }).waitFor();
  const landed = await page.locator('.daily-wheel').evaluate(el => {
    const wheel = el.getBoundingClientRect();
    const save = JSON.parse(localStorage.getItem('dino-realms-save-v1'));
    const prize = el.children[save.daily.spin].getBoundingClientRect();
    return { offset: Math.abs(prize.x + prize.width / 2 - wheel.x - wheel.width / 2), top: prize.y, center: wheel.y + wheel.height / 2 };
  });
  assert.ok(landed.offset < 2 && landed.top < landed.center, 'Winning prize must land under the pointer');
  assert.match(await page.locator('.daily-result').innerText(), /You won/);
  assert.equal(await page.locator('.daily-quest').count(), 4);
  await page.reload();
  await page.getByRole('button', { name: 'Daily rewards and missions' }).click();
  assert.equal(await page.getByRole('button', { name: 'Come back tomorrow' }).isDisabled(), true);
  await fs.mkdir('output/daily-rewards', { recursive: true });
  for (const width of [1440,390,360,320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('.daily-panel').evaluate(el => el.scrollIntoView({ block:'start' }));
    await page.screenshot({ path: `output/daily-rewards/${width}.png` });
    const wheelSize = await page.locator('.daily-wheel-frame').boundingBox();
    assert.ok(Math.abs(wheelSize.width - wheelSize.height) < 1, `Wheel must stay circular at ${width}px`);
    const dimensions = await page.locator('.realm-window-body').evaluate(el => ({ width:el.clientWidth, scroll:el.scrollWidth }));
    if(dimensions.scroll>dimensions.width+1) console.log(await page.locator('.realm-window-body').evaluate(el => { const r=el.getBoundingClientRect(); return [...el.querySelectorAll('*')].map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right-r.left,width:e.getBoundingClientRect().width})).filter(e=>e.right>el.clientWidth); }));
    assert.ok(dimensions.scroll <= dimensions.width+1, `Overflow at ${width}: ${JSON.stringify(dimensions)}`);
  }
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  // A new UTC day opens automatically once, including after returning to the game.
  await page.evaluate(() => localStorage.setItem('dino-realms-daily-opened', '2000-01-01'));
  await page.reload();
  await page.locator('.daily-panel').waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(async () => {
    const { DAILY_QUESTS, dailyQuests } = await import('/src/realms/daily.ts');
    const save=JSON.parse(localStorage.getItem('dino-realms-save-v1'));
    for (const id of dailyQuests(save.daily.day)) save.daily.progress[id]=DAILY_QUESTS[id].target;
    localStorage.setItem('dino-realms-save-v1',JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Daily rewards and missions' }).click();
  for(let i=0;i<4;i++) await page.getByRole('button',{name:'Claim reward',exact:true}).first().click();
  await page.getByRole('button',{name:'Claim bonus',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Bonus claimed ✓',exact:true}).isDisabled(),true);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(() => {
    const key = 'dino-realms-save-v1';
    const save = JSON.parse(localStorage.getItem(key));
    save.updatedAt = Date.now() - 300_000;
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  const strip = page.locator('.realm-offline-strip');
  await strip.waitFor();
  const wheel = await page.locator('.realm-daily-access').boundingBox();
  const camera = await page.locator('.realm-recenter').boundingBox();
  assert.ok(wheel.y + wheel.height < camera.y, 'Daily wheel must sit above camera controls');
  assert.ok(await strip.locator('small').isVisible(), 'Offline duration must be visible on mobile');
  await page.screenshot({ path: 'output/daily-rewards/mobile-offline.png' });
  await page.getByRole('button', { name: 'Collect available', exact: true }).click();
  await strip.waitFor({ state: 'detached' });
  const collected = await page.evaluate(() => JSON.parse(localStorage.getItem('dino-realms-save-v1')).storedGold);
  assert.ok(collected < 1, 'Stored gold must be collected');
  assert.deepEqual(errors,[]);
  console.log('Daily spin persists across reload, four missions and one-time bonus claims work; desktop and mobile layouts passed.');
} finally { await browser?.close(); await server.close(); }
