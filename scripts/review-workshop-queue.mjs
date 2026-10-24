process.env.VITE_SUPABASE_URL='';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:5277},logLevel:'error'});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.addInitScript(()=>{localStorage.setItem('dino-realms-language','ro');localStorage.setItem('dino-realms-daily-opened',new Date().toISOString().slice(0,10));});
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:60000});
 await page.evaluate(async()=>{
 const {newSave,SAVE_KEY}=await import('/src/realms/game.ts');
 const {RECIPES}=await import('/src/realms/content.ts');
 const now=Date.now(),s=newSave(now);
 s.buildings.push({id:'workshop',kind:'workshop',x:6,y:1});
 const longest=RECIPES.reduce((a,b)=>a.seconds>b.seconds?a:b); s.crafting=[{id:'ready',recipeId:RECIPES[0].id,startedAt:now-120000,endsAt:now-60000},{id:'active',recipeId:longest.id,startedAt:now,endsAt:now+longest.seconds*1000},{id:'queued',recipeId:RECIPES[2].id,startedAt:now+longest.seconds*1000,endsAt:now+(longest.seconds+RECIPES[2].seconds)*1000}];
 localStorage.setItem(SAVE_KEY,JSON.stringify(s));
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.realm-nav').waitFor();
 await page.locator('.realm-nav button').evaluateAll(bs=>bs.find(b=>/atelier/i.test(b.textContent)).click());
 await page.locator('.craft-job.finished').waitFor();
 await fs.mkdir('output/workshop-queue',{recursive:true});
 for(const width of [1440,1024,390,320]) {
 await page.setViewportSize({width,height:900});
 for(const card of await page.locator('.craft-job:not(.free)').all()) {
 const result=await card.evaluate(el=>{const copy=el.querySelector('div').getBoundingClientRect(),button=el.querySelector('button').getBoundingClientRect();return {overflow:el.scrollWidth-el.clientWidth,separate:button.top>=copy.bottom,height:button.height,copyWidth:copy.width};});
 assert.ok(result.overflow<=1&&result.separate&&result.height>=44&&result.copyWidth>100,JSON.stringify({width,result}));
 }
 await page.locator('.craft-queue').scrollIntoViewIfNeeded();
 await page.screenshot({path:`output/workshop-queue/${width}.png`});
 }
 await page.locator('.craft-job.finished button').click();
 await assert.equal(await page.locator('.craft-job.finished').count(),0);
 console.log('Queue layout and Collect verified at 1440, 1024, 390 and 320px.');
} finally {await browser?.close();await server.close();}


