process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server = await createServer({ configLoader: 'runner', server: { host:'127.0.0.1', port:5258 }, logLevel:'error' });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel:'msedge', headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 }, reducedMotion:'reduce' });
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(()=>{ localStorage.setItem('dino-realms-language','en'); localStorage.setItem('dino-realms-daily-opened',new Date().toISOString().slice(0,10)); });
  await page.goto(server.resolvedUrls.local[0], { waitUntil:'domcontentloaded', timeout:60000 });
  await page.evaluate(async()=>{ const {newSave,SAVE_KEY}=await import('/src/realms/game.ts'); const s=newSave(Date.now()); s.dinos=[{id:'hero',species:'trex',element:'fire',stage:'juvenile',level:12,nickname:'Ignis'}];s.champion='hero';localStorage.setItem(SAVE_KEY,JSON.stringify(s)); });
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.locator('.realm-nav button').evaluateAll(buttons=>{ const b=buttons.find(b=>/collection/i.test(b.textContent));if(!b)throw Error('Collection missing');b.click(); });
  await page.locator('.hero-book').waitFor();
  await fs.mkdir('output/hero-book',{recursive:true});
  for(const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:900});
    for(const tab of await page.locator('.hero-elements button').all()) {
      await tab.click(); assert.equal(await tab.getAttribute('aria-pressed'),'true');
      for(const stage of ['Baby','Juvenile','Adult']) {
        await page.getByLabel('Evolution stage',{exact:true}).getByRole('button',{name:stage,exact:true}).click();
        await page.locator('.hero-specimen canvas[data-art-ready="true"]').first().waitFor();
      }
      assert.ok(await page.locator('.hero-book').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`Overflow ${width}`);
    }
    await page.locator('.hero-elements button').first().click();
    await page.getByRole('checkbox',{name:'Owned only'}).check();
    assert.equal(await page.locator('.hero-specimen').count(),1);
    await page.getByRole('checkbox',{name:'Owned only'}).uncheck();
    await page.locator('.hero-book-summary').scrollIntoViewIfNeeded();
    await page.screenshot({path:`output/hero-book/${width}.png`});
  }
  await page.getByRole('button',{name:'Ignis',exact:false}).last().click();
  await page.locator('.hero-book').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  console.log('Ten elements, three stages, owned filter, mobile overflow and owned-hero navigation passed.');
} finally {await browser?.close();await server.close();}
