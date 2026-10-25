process.env.VITE_SUPABASE_URL='';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:5269},logLevel:'error'});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('dino-realms-language','en');localStorage.setItem('dino-realms-daily-opened',new Date().toISOString().slice(0,10));});
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:60000});
 await page.evaluate(async()=>{
  const {newSave,command,SAVE_KEY}=await import('/src/realms/game.ts');const now=Date.now();let s=newSave(now);s.gold=10000;
  s=command(s,{type:'build',kind:'workshop',x:6,y:1},now);
  s=command(s,{type:'build',kind:'farm',x:5,y:8},now);
  s.food=0;for(const id of Object.keys(s.inventory))s.inventory[id]=0;
  localStorage.setItem(SAVE_KEY,JSON.stringify(s));
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.realm-nav button').evaluateAll(buttons=>buttons.find(b=>/realms/i.test(b.textContent)).click());
 await page.locator('.atlas-upgrade .resource-help summary').click();
 await page.locator('.atlas-upgrade .resource-help').getByRole('button',{name:/Craft in Workshop: Habitat/}).click();
 await page.locator('.craft-card.focus').filter({hasText:'Habitat kit'}).waitFor();
 await page.locator('.craft-card.focus .resource-help summary').click();
 assert.ok((await page.locator('.craft-card.focus .resource-help').innerText()).includes('3 missing'));
 await page.locator('.craft-card.focus .resource-help').getByRole('button',{name:/Earn from expedition/}).first().click();
 await page.locator('.gameplay-expedition').waitFor();
 await page.locator('.gameplay-header').getByRole('button',{name:'Workshop',exact:true}).click();
 await page.locator('.craft-card').filter({hasText:'Supply pack'}).locator('.resource-help summary').click();
 await page.locator('.craft-card').filter({hasText:'Supply pack'}).locator('.resource-help').getByRole('button',{name:/Grow and harvest/}).click();
 await page.locator('.realm-farm-plots').waitFor();
 await fs.mkdir('output/resource-help',{recursive:true});
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:900});
  const help=page.locator('.realm-farm-upgrade .resource-help');await help.evaluate(el=>el.open=true);await help.scrollIntoViewIfNeeded();
  assert.ok(await help.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`Overflow ${width}`);
  await page.screenshot({path:`output/resource-help/farm-${width}.png`});
 }
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dino-realms-save-v1')));
 assert.equal(saved.food,0);assert.equal(saved.inventory.habitatKit,0);assert.equal(saved.inventory.wood,0);
 await page.evaluate(()=>{const key='dino-realms-save-v1';const s=JSON.parse(localStorage.getItem(key));s.buildings=s.buildings.filter(b=>b.kind!=='workshop');s.gold=0;localStorage.setItem(key,JSON.stringify(s));});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.realm-nav button').evaluateAll(buttons=>buttons.find(b=>/realms/i.test(b.textContent)).click());
 await page.locator('.atlas-upgrade .resource-help summary').click();
 await page.locator('.atlas-upgrade .resource-help').getByRole('button',{name:'Build the Workshop',exact:false}).click();
 assert.equal(await page.locator('.build-preview').getAttribute('aria-label'),'Workshop');
 await page.locator('.build-preview .resource-help summary').click();
 await page.locator('.build-preview .resource-help').getByRole('button',{name:/Collect gold from habitats/}).click();
 await page.locator('.realm-habitat-list').waitFor();
 assert.deepEqual(errors,[]);
 console.log('Habitat kit → exact kit recipe → expeditions; food → Farm; missing counts, mobile layout and navigation without spending passed.');
} finally {await browser?.close();await server.close();}
