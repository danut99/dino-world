process.env.VITE_SUPABASE_URL='';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:5281},logLevel:'error'});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1830,height:900}});
 await fs.mkdir('output/ankylobiped-size',{recursive:true});
 for(const species of ['ankylobiped_lightning','ankylosaurus_ice']) {
 for(const stage of ['baby','juvenile','adult']) {
 await page.goto(server.resolvedUrls.local[0]+`?mode=preview&dino=${species}_${stage}&scene=arena&foe=trex_lightning_${stage}`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.battle-unit.ally canvas[data-frame]').waitFor({timeout:60000});
 await page.locator('.battle-unit.enemy canvas[data-frame]').waitFor();
 const sizes=await page.locator('.battle-unit canvas').evaluateAll(cs=>cs.map(c=>{const ctx=c.getContext('2d'),d=ctx.getImageData(0,0,c.width,c.height).data;let lo=c.height,hi=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>100){lo=Math.min(lo,y);hi=Math.max(hi,y);}return (hi-lo+1)*c.getBoundingClientRect().height/c.height;}));
 assert.ok(sizes[0]/sizes[1]>.88&&sizes[0]/sizes[1]<1.12,JSON.stringify({stage,sizes}));
 await page.screenshot({path:`output/ankylobiped-size/${species}-${stage}.png`});
 console.log(species,stage,JSON.stringify(sizes));
 }
 }
}finally{await browser?.close();await server.close();}
