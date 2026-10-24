process.env.VITE_SUPABASE_URL='';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:5278},logLevel:'error'});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 await fs.mkdir('output/mobile-nav',{recursive:true});
 for(const [w,h] of [[390,844],[320,640],[844,390],[1440,900]]) {
 const page=await browser.newPage({viewport:{width:w,height:h},isMobile:w<1000,hasTouch:w<1000});
 await page.addInitScript(()=>{localStorage.setItem('dino-realms-language','ro');localStorage.setItem('dino-realms-daily-opened',new Date().toISOString().slice(0,10));});
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:60000});
 await page.evaluate(async()=>{
 const {newSave,parseSave,SAVE_KEY}=await import('/src/realms/game.ts');
 const s=newSave(Date.now());
 s.dinos=[{id:'ignis',species:'trex',element:'fire',level:10,stage:'juvenile',nickname:'Ignis'}];
 s.champion='ignis'; s.cleared=['training'];
 s.buildings.push({id:'arena',kind:'arena',x:7,y:7},{id:'workshop',kind:'workshop',x:6,y:1});
 if(!parseSave(JSON.stringify(s))) throw new Error('invalid save'); localStorage.setItem(SAVE_KEY,JSON.stringify(s));
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.realm-nav').waitFor();
 await page.waitForTimeout(800);
 const info=async()=>page.locator('.realm-nav').evaluate(n=>{const r=n.getBoundingClientRect();return {cls:n.className,w:Math.round(r.width),h:Math.round(r.height),buttons:[...n.querySelectorAll(':scope>button')].filter(b=>getComputedStyle(b).display!=='none').map(b=>(b.getAttribute('aria-label')||'')+':'+Math.round(b.getBoundingClientRect().width)+'x'+Math.round(b.getBoundingClientRect().height))};});
 console.log(w,h,JSON.stringify(await info()));
 await page.screenshot({path:`output/mobile-nav/${w}x${h}-a.png`});
 if(w===390){await page.locator('.realm-mobile-profile .realm-avatar').click();await page.waitForTimeout(300);await page.screenshot({path:'output/mobile-nav/profile.png'});await page.locator('.realm-mobile-profile .realm-avatar').click({force:true}).catch(()=>{});await page.keyboard.press('Escape');}
 await page.locator('.realm-nav-toggle').click();
 await page.waitForTimeout(400);
 console.log(w,h,JSON.stringify(await info()));
 await page.screenshot({path:`output/mobile-nav/${w}x${h}-b.png`});
 await page.close();
 }
} finally {await browser?.close();await server.close();}
