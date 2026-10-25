import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

// All authentication and save requests stay in this mock; no real accounts are created.
process.env.VITE_SUPABASE_URL = 'https://signup-test.supabase.co';
process.env.VITE_SUPABASE_KEY = 'sb_publishable_test';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright')); }
const server = await createServer({
  configLoader: 'runner', server: { host: '127.0.0.1', port: 5229 }, logLevel: 'error',
  plugins: process.argv.includes('--baseline') ? [{
    name: 'reproduce-previous-signup-race', enforce: 'pre',
    transform(source, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/realms/SignInGate.tsx'))
        return source.replace(' && start.anonymous === anonymous', '');
    },
  }] : [],
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  let user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const token = () => {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.signature`;
  };
  let row = null;
  let writes = 0;
  let profile = null;
  await page.route('https://signup-test.supabase.co/**', async (route) => {
    const request = route.request(), url = new URL(request.url());
    const body = request.postDataJSON();
    let data;
    if (url.pathname === '/auth/v1/signup') {
      data = { access_token: token(), refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user };
    } else if (url.pathname === '/auth/v1/user') {
      if (request.method() === 'PUT') user = { ...user, ...body, is_anonymous: false };
      data = user;
    } else if (url.pathname === '/rest/v1/profiles') {
      if (request.method() === 'POST') profile = { name: body.name };
      data = profile;
    } else if (url.pathname === '/rest/v1/saves') {
      if (request.method() === 'GET') data = row;
      else {
        if (request.method() === 'POST' && row) {
          await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate' }) });
          return;
        }
        if (request.method() === 'PATCH' && row && url.searchParams.get('updated_at') !== `eq.${row.updated_at}`) data = [];
        else {
          row = { ...body, updated_at: new Date(Date.now() + ++writes).toISOString() };
          data = [{ updated_at: row.updated_at }];
        }
      }
    } else throw new Error(`Unexpected backend request: ${request.method()} ${url.pathname}`);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('.realm-world canvas').waitFor();
  await page.getByRole('button', { name: 'Go →', exact: true }).click();
  await page.getByRole('button', { name: 'Incubate', exact: true }).click();
  // Let the hatch timer elapse without waiting thirty seconds in real time.
  await page.clock.install();
  await page.clock.fastForward(31_000);
  await page.getByRole('button', { name: 'Hatch', exact: true }).click();
  await page.clock.runFor(2000);
  for (let n = 0; n < 5 && !(await page.locator('input[type="email"]').count()); n++) {
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.clock.runFor(250);
  }
  await page.waitForFunction(() => document.querySelector('input[type="email"]'));
  await page.locator('input[type="email"]').fill('regression@example.test');
  await page.locator('input[type="password"]').fill('test-password-123');
  const savedBefore = row?.data;
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.locator('input[autocomplete="nickname"]').waitFor();
  // The name screen leaves time for the obsolete game instance's queued upload to complete.
  await page.clock.runFor(1000);
  await page.locator('input[autocomplete="nickname"]').fill('Test Raptor');
  await page.getByRole('button', { name: 'Enter the game', exact: true }).click();
  await page.clock.runFor(5000);
  await page.waitForFunction(() => !document.querySelector('input[type="email"]'));
  assert.equal(user.is_anonymous, false);
  assert.equal(row.data.dinos.length, 1, 'signup must preserve the hatched guest dinosaur');
  assert.ok(row.data.revision >= savedBefore.revision, 'signup must not reset guest actions');
  console.log('PASS: email signup without confirmation preserves guest progress.');
} finally {
  await browser?.close();
  await server.close();
}
