import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 5213 } });
await server.listen();
const browser = await chromium.launch({
  channel: 'msedge',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { newGame, runCommand } = await import('/shared/game/index.ts');
    const now = Date.now();
    let state = newGame(now, 12345);
    state.gold = 100000;
    state.goalsClaimed = ['world'];
    for (const element of ['fire', 'earth']) {
      const result = runCommand(state, { type: 'unlockWorld', element }, now);
      if (!result.ok) throw new Error(result.error);
      state = result.state;
    }
    const home = state.buildings.find((building) => building.kind === 'habitat' && building.element === 'fire');
    home.level = 3;
    state.dinos[0].habitatId = home.id;
    state.dinos[0].level = 7;
    state.dinos.push({ id: 'language-parent', species: 'ignisaur', level: 7, habitatId: home.id });
    state.buildings.push({ id: 'language-den', kind: 'den', level: 1, slot: 'p1', stored: 0, since: now });
    state.eggs.push({ id: 'language-egg', species: 'ignisaur', element: 'fire', hatchAt: now - 1000 });
    localStorage.setItem('dino-world-save-v3', JSON.stringify(state));
    localStorage.setItem('dino-world:first-steps', 'done');
    localStorage.setItem('dino-world:guide', 'done');
    localStorage.removeItem('dino-world-language');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.world-loader').waitFor({ state: 'hidden', timeout: 60000 });
  await page.getByRole('button', { name: 'Switch to Romanian' }).waitFor();
  assert((await page.locator('html').getAttribute('lang')) === 'en', 'English must be the default');
  await page.locator('.goal-hint').filter({ hasText: 'Dinosaurs produce gold → World → Collect' }).waitFor();
  await page
    .locator('.tour-bubble strong')
    .filter({ hasText: /Collect your first gold|Collect gold produced by dinosaurs|Dinosaurs produce gold/ })
    .waitFor();
  assert(
    !(await page.locator('.goal-card, .tour-bubble').allTextContents()).join(' ').match(/[ăâîșț]/i),
    'Goals and guide must be entirely English',
  );
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Sound effects', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Română', exact: true }).click();
  await page.getByText('Efecte sonore', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Închide', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Schimbă în engleză' }).waitFor();
  assert((await page.locator('html').getAttribute('lang')) === 'ro', 'Romanian choice must persist');
  await page.getByRole('button', { name: 'Schimbă în engleză' }).click();
  await page.locator('[data-tour="wikipedia"]').click();
  await page.getByRole('searchbox', { name: 'Search Wikipedia' }).fill('breeding');
  await page.locator('.wiki-card').filter({ hasText: 'Breeding in the Den' }).first().waitFor();
  await page.keyboard.press('Escape');
  await page.evaluate(() =>
    document
      .querySelector('[data-building-id="language-den"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
  await page.getByRole('button', { name: '💞 Breed', exact: true }).waitFor();
  assert(!(await page.locator('.bp-modal').innerText()).match(/[ăâîșț]/i), 'Breeding panel must be English');
  await page.getByRole('button', { name: '💞 Breed', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('dino-world-save-v3'));
    const id = state.buildings.find((building) => building.kind === 'hatchery').id;
    document.querySelector(`[data-building-id="${id}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.getByRole('button', { name: '🐣 Hatch', exact: true }).click();
  await page.locator('[data-tour="hatch-home"]').first().click();
  await page.locator('.toast').filter({ hasText: 'Ignisaur has hatched!' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Paste text/ }).click();
  await page.getByPlaceholder('Paste your save text here').fill('invalid save');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await page.getByText('This does not look like a Dino World save. Check the file or text.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Română', exact: true }).click();
  await page.getByText('Nu pare o salvare Dino World. Verifică fișierul sau textul.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  const switcher = page.getByRole('button', { name: 'Switch to Romanian' });
  const box = await switcher.boundingBox();
  assert(box && box.x >= 0 && box.x + box.width <= 390, 'Language button must fit on mobile');
  await fs.mkdir(new URL('../output/languages/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../output/languages/mobile-english.png', import.meta.url)) });
  await switcher.click();
  await page.locator('.hud-actions button').filter({ hasText: 'Strânge tot' }).waitFor();
  assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
  console.log(
    'Language browser checks passed: default, switching, persistence, search, breeding, hatching, errors, mobile.',
  );
} finally {
  await browser.close();
  await server.close();
}
