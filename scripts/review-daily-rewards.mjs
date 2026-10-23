import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5263 }, logLevel: 'error' });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('button', { name: 'Daily rewards and missions' }).click();
  await page.getByRole('button', { name: 'Spin for free' }).click();
  await page.getByRole('button', { name: 'Come back tomorrow' }).waitFor();
  assert.match(await page.locator('.daily-result').innerText(), /You won/);
  assert.equal(await page.locator('.daily-quest').count(), 4);
  await page.reload();
  await page.getByRole('button', { name: 'Daily rewards and missions' }).click();
  assert.equal(await page.getByRole('button', { name: 'Come back tomorrow' }).isDisabled(), true);
  await fs.mkdir('output/daily-rewards', { recursive: true });
  for (const width of [1440,390,360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('.daily-panel').evaluate(el => el.scrollIntoView({ block:'start' }));
    await page.screenshot({ path: `output/daily-rewards/${width}.png` });
    const dimensions = await page.locator('.realm-window-body').evaluate(el => ({ width:el.clientWidth, scroll:el.scrollWidth }));
    if(dimensions.scroll>dimensions.width+1) console.log(await page.locator('.realm-window-body').evaluate(el => { const r=el.getBoundingClientRect(); return [...el.querySelectorAll('*')].map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right-r.left,width:e.getBoundingClientRect().width})).filter(e=>e.right>el.clientWidth); }));
    assert.ok(dimensions.scroll <= dimensions.width+1, `Overflow at ${width}: ${JSON.stringify(dimensions)}`);
  }
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
  assert.deepEqual(errors,[]);
  console.log('Daily spin persists across reload, four missions and one-time bonus claims work; desktop and mobile layouts passed.');
} finally { await browser?.close(); await server.close(); }
