import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright')); }
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await fs.mkdir('output/live-signup', { recursive: true });
const errors = [], requests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', async (response) => {
  const url = new URL(response.url());
  if (!url.hostname.endsWith('.supabase.co')) return;
  const entry = { path: url.pathname, method: response.request().method(), status: response.status() };
  try {
    const body = await response.json();
    if (response.status() >= 400) entry.error = body;
    if (url.pathname === '/rest/v1/saves') entry.save = body;
    if (url.pathname.startsWith('/auth/')) {
      const user = body.user ?? body;
      entry.user = { id: user.id, anonymous: user.is_anonymous };
    }
  } catch {}
  requests.push(entry);
});
try {
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await page.goto('https://dino-world-9ezw.onrender.com/');
  await page.locator('.realm-world canvas').waitFor({ timeout: 60000 });
  console.log('INITIAL', (await page.locator('body').innerText()).slice(-6000));
  await page.screenshot({ path: 'output/live-signup/initial.png' });
  const continueButton = page.getByRole('button', { name: 'Continue the story' });
  if (await continueButton.count()) await continueButton.click();
  console.log('AFTER STORY', (await page.locator('body').innerText()).slice(-4500));
  await page.getByRole('button', { name: 'Go →', exact: true }).click();
  console.log('HATCHERY', (await page.locator('body').innerText()).slice(-4000));
  await page.getByRole('button', { name: 'Incubate', exact: true }).click();
  await page.waitForTimeout(31_000);
  console.log('READY TO HATCH', (await page.locator('body').innerText()).slice(-4000));
  await page.getByRole('button', { name: 'Hatch', exact: true }).click();
  await page.getByText('A hero awakens', { exact: true }).waitFor();
  console.log('AFTER HATCH', (await page.locator('body').innerText()).slice(-4000));
  await page.screenshot({ path: 'output/live-signup/after-hatch.png' });
  for (let n = 0; n < 5 && !(await page.locator('input[type="email"]').count()); n++) {
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.waitForTimeout(250);
  }
  await page.locator('input[type="email"]').waitFor();
  await page.screenshot({ path: 'output/live-signup/before-signup.png' });
  await page.locator('input[type="email"]').fill(`dino-regression-${Date.now()}@example.com`);
  await page.locator('input[type="password"]').fill(randomBytes(24).toString('base64url'));
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForTimeout(5000);
  console.log('AFTER SIGNUP', (await page.locator('body').innerText()).slice(-5000));
  await page.screenshot({ path: 'output/live-signup/after-signup.png' });
  const nickname = page.locator('input[autocomplete="nickname"]');
  if (await nickname.count()) {
    await nickname.fill(`TestRaptor${Date.now().toString().slice(-7)}`);
    await page.getByRole('button', { name: 'Enter the game', exact: true }).click();
    await page.waitForTimeout(5000);
  }
  console.log('AFTER NAME', (await page.locator('body').innerText()).slice(-5000));
  await page.screenshot({ path: 'output/live-signup/after-name.png' });
  await page.reload();
  await page.waitForTimeout(5000);
  console.log('AFTER RELOAD', (await page.locator('body').innerText()).slice(-4000));
} finally {
  await fs.writeFile('output/live-signup/network.json', JSON.stringify({ errors, requests }, null, 2));
  await browser.close();
}
