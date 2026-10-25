process.env.VITE_SUPABASE_URL='';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:5270},logLevel:'error'});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('dino-realms-language','en');localStorage.setItem('dino-realms-daily-opened',new Date().toISOString().slice(0,10));});
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:60000});
 await page.evaluate(async()=>{const {newSave,command,SAVE_KEY}=await import('/src/realms/game.ts');let s=newSave(Date.now());s.gold=10000;s=command(s,{type:'build',kind:'farm',x:5,y:8},Date.now());s=command(s,{type:'upgradeFarm'},Date.now());localStorage.setItem(SAVE_KEY,JSON.stringify(s));});
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.realm-nav').waitFor();await page.locator('.realm-nav button').evaluateAll(bs=>bs.find(b=>/^build$/i.test(b.getAttribute('aria-label')||b.textContent.trim())).click());await page.locator('.build-picker button').filter({hasText:'Farm'}).click();await page.locator('.build-preview').getByRole('button',{name:'Open',exact:false}).click();await page.locator('.farm-layout').waitFor();
 assert.ok(await page.locator('.realm-window').evaluate(el=>el.classList.contains('wide')));
 await fs.mkdir('output/farm-layout',{recursive:true});
 for(const width of [1440,1024,390,320]) {
  await page.setViewportSize({width,height:900});
  await page.locator('.realm-crop').last().click();assert.ok(await page.locator('.farm-plant-button').isDisabled());assert.equal(await page.locator('.farm-seeds .requirement-link').count(),1);
  await page.locator('.realm-crop').first().click();assert.ok(await page.locator('.farm-plant-button').isEnabled());
  assert.ok(await page.locator('.realm-farm').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`Overflow ${width}`);
  await page.locator('.realm-farm-head').scrollIntoViewIfNeeded();await page.screenshot({path:`output/farm-layout/${width}.png`});
 }
 await page.locator('.realm-plot.empty').nth(1).click();await page.locator('.farm-plant-button').click();
 assert.equal(await page.locator('.realm-plot.growing').count(),1);
 const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('dino-realms-save-v1')));assert.ok(save.plots[1]);assert.equal(save.plots[0],null);assert.deepEqual(errors,[]);
 console.log('Wide modal, selected crops, locked crop help, mobile overflow and planting on the chosen plot passed.');
} finally {await browser?.close();await server.close();}
