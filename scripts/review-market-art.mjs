// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds.
process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:5237},logLevel:'error'});
await server.listen();let browser;
try {
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('dino-realms-language','en'));
 await page.goto(server.resolvedUrls.local[0]);
 await page.evaluate(async()=>{const {newSave}=await import('/src/realms/game.ts');const s=newSave(Date.now());s.gold=5000;s.buildings.push({id:'market',kind:'market',x:7,y:5});localStorage.setItem('dino-realms-save-v1',JSON.stringify(s));localStorage.setItem('dino-realms-current-world','home');});
 await page.reload();await page.locator('.realm-world[data-environment-ready="true"]').waitFor();
 await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('market-building-pixel.webp')));
 await page.evaluate(async()=>{const i=new Image();i.src='/realms/gameplay/market-building-pixel.webp';await i.decode();});
 await fs.mkdir('output/market-review',{recursive:true});
 await page.screenshot({path:'output/market-review/island.jpg',type:'jpeg',quality:82});
 await page.getByRole('button',{name:/Build$/}).click();
 await page.locator('image[href="/realms/gameplay/market-building-pixel.webp"]').waitFor({state:'attached'});
 await page.screenshot({path:'output/market-review/shop.jpg',type:'jpeg',quality:82});
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Market art loaded on island and building shop; no browser errors.');
} finally {await browser?.close();await server.close();}
