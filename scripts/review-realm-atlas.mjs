process.env.VITE_SUPABASE_URL='';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:5259},logLevel:'error'});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('dino-realms-language','en');localStorage.setItem('dino-realms-daily-opened',new Date().toISOString().slice(0,10));});
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:60000});
 await page.evaluate(async()=>{const {newSave,SAVE_KEY}=await import('/src/realms/game.ts');const s=newSave(Date.now());s.gold=100000;for(const id of Object.keys(s.inventory))s.inventory[id]=100;localStorage.setItem(SAVE_KEY,JSON.stringify(s));});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.realm-nav button').evaluateAll(buttons=>{const b=buttons.find(b=>/realms/i.test(b.textContent));if(!b)throw Error('Realms button missing');b.click();});
 await page.locator('.realm-atlas').waitFor();await fs.mkdir('output/realm-atlas',{recursive:true});
 for(const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:900});
  for(const button of await page.locator('.atlas-elements button').all()) {
   await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');
   await page.locator('.atlas-landscape img').evaluate(img=>img.decode());
   assert.ok(await page.locator('.realm-atlas').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`Overflow ${width}`);
  }
  await page.locator('.atlas-summary').scrollIntoViewIfNeeded();await page.screenshot({path:`output/realm-atlas/locked-${width}.png`});
  await page.locator('.atlas-elements button').first().click();await page.locator('.atlas-summary').scrollIntoViewIfNeeded();await page.screenshot({path:`output/realm-atlas/open-${width}.png`});
 }
 const water=page.locator('.atlas-elements button[aria-label="Water"]');await water.click();
 await page.getByRole('button',{name:'Unlock world',exact:false}).click();
 await page.getByRole('button',{name:'Enter world',exact:false}).waitFor();
 await page.getByRole('button',{name:'Upgrade habitat',exact:false}).click();
 assert.ok((await page.locator('.atlas-stats').innerText()).includes('2'));
 await page.getByRole('button',{name:'Enter world',exact:false}).click();await page.locator('.realm-atlas').waitFor({state:'detached'});
 assert.equal(await page.locator('.realm-world').getAttribute('data-realm'),'water');assert.deepEqual(errors,[]);
 console.log('All ten realms, images, mobile layouts, unlock, upgrade and entering a world passed.');
} finally {await browser?.close();await server.close();}
