import {createServer} from 'vite';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright');
const server=await createServer({configLoader:'runner',server:{host:'127.0.0.1',port:5245},logLevel:'error'});await server.listen();let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('dino-realms-language','en'));await page.goto(server.resolvedUrls.local[0]);
 await page.getByRole('button',{name:'Wikipedia',exact:true}).click();
 await page.getByRole('heading',{name:'Dino Realms guide',exact:true}).waitFor();
 assert.equal(await page.locator('.realms-wiki-results > button').count(),18);
 const search=page.getByRole('searchbox');await search.fill('hatchery');assert.ok(await page.locator('.realms-wiki-results > button').count()>0);
 await page.locator('.realms-wiki-results > button').filter({hasText:'Eggs and hatchery'}).click();
 await page.getByRole('heading',{name:'Eggs and hatchery',exact:true}).waitFor();
 await page.locator('.realms-wiki-related').getByRole('button',{name:'Market and rare eggs'}).click();await page.getByRole('heading',{name:'Market and rare eggs',exact:true}).waitFor();
 await page.getByRole('button',{name:'Back to articles'}).click();
 await page.getByRole('navigation',{name:'Wikipedia categories'}).getByRole('button',{name:/Activities/}).click();
 assert.equal(await page.locator('.realms-wiki-results > button').count(),6);
 await search.fill('zzzz-no-match');await page.getByText('No results. Try another word or category.',{exact:true}).waitFor();
 await search.fill('');await page.getByRole('navigation',{name:'Wikipedia categories'}).getByRole('button',{name:/All articles/}).click();
 await fs.mkdir('output/realms-wiki',{recursive:true});await page.screenshot({path:'output/realms-wiki/desktop.jpg',type:'jpeg',quality:80});
 await page.keyboard.press('Escape');assert.equal(await page.locator('.realms-wiki').count(),0);
 await page.setViewportSize({width:390,height:844});const cont=page.locator('.realm-portrait button');if(await cont.isVisible())await cont.click();await page.getByRole('button',{name:'Wikipedia',exact:true}).click();await page.screenshot({path:'output/realms-wiki/mobile.jpg',type:'jpeg',quality:80});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log('18 articles: opening, search, categories, related links, empty search, Escape, and mobile passed.');
}finally{await browser?.close();await server.close();}
