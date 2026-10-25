// Browser checks run the game without accounts (no sign-in gate), whatever .env.local holds. With --guest the game
// runs as an anonymous guest against a mocked backend (no real accounts), where the first hatch invites to save.
const guest = process.argv.includes('--guest');
process.env.VITE_SUPABASE_URL = guest ? 'https://tour-test.supabase.co' : '';
process.env.VITE_SUPABASE_KEY = 'sb_publishable_test';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 5271 }, logLevel: 'error' });
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: 'msedge', headless: true });
  await fs.mkdir('output/guided-tour', { recursive: true });
  for (const [name, viewport] of guest ? [['guest', { width: 1440, height: 900 }]] : [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 800 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { if (!localStorage.getItem('dino-realms-tour')) localStorage.setItem('dino-realms-tour', 'show'); });
    if (guest) {
      const user = { id: '22222222-2222-4222-8222-222222222222', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
      const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.signature`;
      let row = null, writes = 0;
      await page.route('https://tour-test.supabase.co/**', async (route) => {
        const request = route.request(), url = new URL(request.url()), body = request.postDataJSON();
        let data = null;
        if (url.pathname === '/auth/v1/signup') data = { access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user };
        else if (url.pathname === '/auth/v1/user') data = user;
        else if (url.pathname === '/rest/v1/saves') {
          if (request.method() === 'GET') data = row;
          else { row = { ...body, updated_at: new Date(Date.now() + ++writes).toISOString() }; data = [{ updated_at: row.updated_at }]; }
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      });
    }
    await page.goto(server.resolvedUrls.local[0]);
    const bubble = page.locator('.tour-bubble');
    // A guest keeps its save under its own key: read whichever game save is there.
    const readSave = () => page.evaluate(() => Object.keys(localStorage).filter((k) => /^dino-realms-save-v1/.test(k) && !k.includes('recovery')).map((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }).find((v) => v?.buildings));
    let shot = 0;
    const snap = () => page.screenshot({ path: `output/guided-tour/${name}-${String(++shot).padStart(2, '0')}.png` });
    const nextStep = async () => { await bubble.waitFor(); await snap(); await bubble.getByRole('button', { name: /Mai departe|Am înțeles/ }).click(); await page.waitForTimeout(350); };
    // The tour itself must light each button before the player presses it.
    const press = async (selector) => { await page.locator('.tour-ring.pulse').waitFor(); await snap(); await page.locator(selector).first().click(); await page.waitForTimeout(350); };
    for (let i = 0; i < 4; i++) await nextStep();
    await press('.realm-quest .realm-button');
    await press('.hatch-shelf .realm-button');
    await press('.hatch-nest.warming .realm-gem-finish');
    await press('.hatch-nest.ready .realm-button');
    // The guide stays through the hero cutscene: it explains the vision, then lights the green button.
    const vision = page.getByRole('dialog', { name: 'Un erou se trezește' });
    await vision.waitFor();
    await page.waitForTimeout(2500);
    assert.match(await bubble.innerText(), /viziune din viitor/i, 'The guide explains the vision');
    await snap();
    await page.locator('.hero-vision[data-phase="done"]').waitFor({ timeout: 40000 });
    await page.waitForTimeout(500);
    await snap();
    await press('.hero-vision-primary');
    await press('.dino-grow-buttons .realm-button:not(.secondary)');
    await press('.realm-window .realm-close');
    await press('.realm-daily-access');
    await press('.daily-spin');
    await nextStep();
    await press('.realm-window .realm-close');
    await press('.realm-quest .realm-button');
    for (const kind of ['farm', 'market']) {
      await press('.realm-quest .realm-button');
      await press('.build-buttons .realm-button:not(.secondary)');
      // The island is a canvas: try spots around the middle until one is free.
      await bubble.waitFor();
      await snap();
      // The guide moves past its "pick a spot" step once the building stands.
      const built = async () => !/Alege un loc/.test(await bubble.innerText().catch(() => ''));
      for (let i = 0; i < 40 && !(await built()); i++) {
        const angle = i * 2.4, r = 40 + i * 9;
        await page.mouse.click(viewport.width / 2 + Math.cos(angle) * r, viewport.height / 2 + Math.sin(angle) * r * 0.6);
        await page.waitForTimeout(150);
      }
      assert.ok(await built(), `The ${kind} must be placed`);
      await page.waitForTimeout(400);
      await press('.realm-quest .realm-button');
    }
    await nextStep();
    await press('.market-egg .realm-button:not(:disabled)');
    await nextStep();
    assert.equal(await page.locator('.tour').count(), 0, 'The guide closes after its last step');
    assert.equal(await page.evaluate(() => localStorage.getItem('dino-realms-tour')), 'done');
    const save = await readSave();
    if (!guest) {
      assert.equal(save.dinos.length, 1, 'The guide hatched the first egg');
      assert.equal(save.eggs.length, 1, 'The guide bought a second egg');
      assert.ok(['farm', 'market'].every((k) => save.buildings.some((b) => b.kind === k)), 'The guide built the farm and market');
    } else {
      await page.locator('.realm-window .realm-close').click();
      await page.getByRole('dialog', { name: 'Salvează-ți progresul' }).waitFor();
      await snap();
    }
    await page.waitForTimeout(400);
    await snap();
    await page.reload();
    await page.waitForTimeout(800);
    assert.equal(await page.locator('.tour').count(), 0, 'The guide shows only once');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Guided tour OK');
} finally {
  await browser?.close();
  await server.close();
}
