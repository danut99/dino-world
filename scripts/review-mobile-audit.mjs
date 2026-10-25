process.env.VITE_SUPABASE_URL = '';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ??
    `${process.env.USERPROFILE}/.codex/dragon-preview-tools/node_modules/playwright-core`,
);
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 5289 },
  logLevel: 'error',
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.addInitScript(() => {
    localStorage.setItem('dino-realms-language', 'en');
    localStorage.setItem('dino-realms-daily-opened', new Date().toISOString().slice(0, 10));
  });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const g = await import('/src/realms/game.ts');
    const s = g.newSave(Date.now());
    s.gold = 100000;
    s.food = 100000;
    s.questEggs = g.QUEST_EGGS.map((q) => q.id);
    s.eggs = [];
    s.dinos = ['trex', 'ignasaur'].map((species, i) => ({
      id: 'd' + i,
      species,
      element: 'fire',
      level: 18,
      stage: 'juvenile',
      nickname: 'Hero ' + i,
    }));
    s.team = ['d0', 'd1'];
    s.champion = 'd0';
    s.portalLevel = 1;
    s.arenaLevel = 1;
    s.arenaTickets = { fire: 20 };
    s.expeditionProgress = { training: 3 };
    for (const kind of ['farm', 'market', 'workshop', 'arena', 'portal']) {
      let placed = false;
      for (let y = 0; y < 12 && !placed; y++)
        for (let x = 0; x < 12 && !placed; x++)
          if (g.canPlace(s, x, y)) {
            s.buildings.push({ id: kind, kind, x, y });
            placed = true;
          }
    }
    g.parseSave(JSON.stringify(s));
    localStorage.setItem(g.SAVE_KEY, JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await fs.mkdir('output/mobile-audit', { recursive: true });

  const report = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 932],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    for (const name of [
      'Build',
      'Dinosaurs',
      'Collection',
      'Realms',
      'Hatchery',
      'Farm',
      'Market',
      'Expeditions',
      'PvE Arena',
      'Workshop',
      'Daily rewards and missions',
      'Wikipedia',
      'Diamond shop',
      'Resources',
      'Settings',
    ]) {
      await page.evaluate(() => {
        document.querySelector('.realm-close')?.click();
        document
          .querySelector('.arena-side-toolbar .gameplay-close, .expedition-panel-close, .gameplay-floating-close')
          ?.click();
        document.querySelector('[aria-label="Got it"]')?.click();
      });
      const opened = await page.evaluate((name) => {
        const b = [...document.querySelectorAll('button')].find(
          (b) =>
            b.getAttribute('aria-label') === name ||
            b.title === name ||
            (name === 'Settings' && b.textContent.trim() === name),
        );
        b?.click();
        return !!b;
      }, name);
      if (!opened) {
        report.push({ width, height, name, missing: true });
        continue;
      }
      await page.waitForTimeout(120);
      const root = page.locator('.gameplay-screen, .realm-window, .realm-profile-card').last();
      if (!(await root.count())) continue;
      const count = await root.getByRole('tab').count();
      for (let tab = 0; tab < Math.max(1, count); tab++) {
        if (count) await root.getByRole('tab').nth(tab).click({ force: true });
        await page.waitForTimeout(80);
        const info = await root.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const clipped = [...el.querySelectorAll('button')]
            .filter((n) => {
              const r = n.getBoundingClientRect();
              if (!r.width || !r.height || n.closest('.ui-paged')) return false;
              let a = n.parentElement;
              while (a && a !== el) {
                const s = getComputedStyle(a),
                  b = a.getBoundingClientRect();
                if (['hidden', 'clip'].includes(s.overflowY) && r.bottom > b.bottom + 3) return true;
                a = a.parentElement;
              }
              return r.left < box.left - 2 || r.right > box.right + 2;
            })
            .map((n) => n.textContent.trim().slice(0, 65));
          return {
            w: Math.round(box.width),
            h: Math.round(box.height),
            horizontal: el.scrollWidth > el.clientWidth + 2,
            clipped,
          };
        });
        report.push({ width, height, name, tab, ...info });
        await page.screenshot({ path: `output/mobile-audit/${width}-${name.replace(/\W/g, '')}-${tab}.png` });
        if (name === 'PvE Arena' && tab === 0) {
          await page.locator('.arena-ticket-line button').click();
          const modal = page.locator('.arena-ticket-modal');
          const bounds = await modal.boundingBox();
          report.push({
            width,
            height,
            name: 'Arena tickets',
            horizontal: await modal.evaluate((el) => el.scrollWidth > el.clientWidth + 2),
            outside:
              bounds.x < 0 ||
              bounds.y < 0 ||
              bounds.x + bounds.width > width + 1 ||
              bounds.y + bounds.height > height + 1,
          });
          await page.screenshot({ path: `output/mobile-audit/${width}-tickets.png` });
          await page.keyboard.press('Escape');
          if (!(await page.locator('.gameplay-arena').count())) throw Error('Closing tickets also closed arena');
        }
        if (name === 'Workshop' && tab === 0 && width <= 760) {
          const next = page.locator('.craft-recipes-tab .ui-pager-step').last();
          for (let i = 0; i < 5 && (await next.isEnabled()); i++) {
            await next.click();
            await page.waitForTimeout(60);
            const clipped = await page.locator('.craft-grid').evaluate((el) => {
              const r = el.getBoundingClientRect();
              return [...el.querySelectorAll('button')]
                .filter((b) => {
                  const x = b.getBoundingClientRect();
                  return x.width && x.height && (x.bottom > r.bottom + 2 || x.right > r.right + 2);
                })
                .map((b) => b.textContent.trim());
            });
            report.push({ width, height, name: 'Recipe page ' + (i + 2), clipped });
          }
        }
      }
    }
    console.log('Checked', width, height);
  }
  await fs.writeFile('output/mobile-audit/report.json', JSON.stringify({ report, errors }, null, 2));
  const issues = report.filter((r) => r.horizontal || r.clipped?.length || r.missing || r.outside);
  console.log(JSON.stringify(issues));
  if (issues.length || errors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
