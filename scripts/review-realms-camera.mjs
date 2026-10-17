import { createRequire } from 'node:module';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Danut/.codex/dragon-preview-tools/node_modules/playwright',
);
const server = await createServer({
  configLoader: 'runner',
  server: { host: '127.0.0.1', port: 5220 },
  logLevel: 'error',
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [],
    checks = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('dino-realms-language', 'en'));
  await fs.mkdir('output/realms/camera', { recursive: true });
  const covered = async () => {
    const result = await page.evaluate(() => {
      const host = document.querySelector('.realm-world'),
        canvas = host.querySelector('canvas'),
        r = canvas.getBoundingClientRect(),
        ctx = canvas.getContext('2d');
      const x = Number(host.dataset.cameraX),
        y = Number(host.dataset.cameraY),
        z = Number(host.dataset.cameraZoom);
      const w = (host.clientWidth / r.width) * canvas.width,
        h = (host.clientHeight / r.height) * canvas.height;
      const valid =
        Math.abs(x) <= (canvas.width * z - w) / 2 + 0.01 && Math.abs(y) <= (canvas.height * z - h) / 2 + 0.01;
      const alpha = [];
      for (const px of [3, innerWidth - 3])
        for (const py of [3, innerHeight - 3])
          alpha.push(
            ctx.getImageData(
              Math.floor(((px - r.left) / r.width) * canvas.width),
              Math.floor(((py - r.top) / r.height) * canvas.height),
              1,
              1,
            ).data[3],
          );
      return { valid, alpha, x, y, zoom: z };
    });
    if (!result.valid || result.alpha.some((a) => a !== 255))
      throw Error(`Camera exposed background: ${JSON.stringify(result)}`);
    return result;
  };
  for (const realm of ['home', 'fire']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(server.resolvedUrls.local[0]);
    await page.evaluate((r) => localStorage.setItem('dino-realms-current-world', r), realm);
    await page.reload();
    await page.locator('.realm-world[data-environment-ready="true"]').waitFor();
    for (const size of [
      { width: 1440, height: 900 },
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      const prompt = page.getByRole('button', { name: 'Continue', exact: true });
      if (await prompt.isVisible()) await prompt.click();
      for (const zoom of [1, 2]) {
        if (zoom === 2) await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
        for (const [dx, dy] of [
          [1, 1],
          [-1, -1],
          [1, -1],
          [-1, 1],
        ]) {
          for (let i = 0; i < 4; i++) {
            await page.mouse.move(size.width * 0.65, size.height * 0.55);
            await page.mouse.down();
            await page.mouse.move(dx > 0 ? size.width - 2 : 2, dy > 0 ? size.height - 2 : 2, { steps: 5 });
            await page.mouse.up();
          }
          checks.push({ realm, size, ...(await covered()) });
        }
      }
      await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
      checks.push({ realm, size, ...(await covered()) });
      await page.screenshot({ path: `output/realms/camera/${realm}-${size.width}.png` });
    }
  }
  await fs.writeFile('output/realms/camera/review.json', JSON.stringify({ errors, checks }, null, 2));
  console.log(JSON.stringify({ errors, edgeChecks: checks.length, screenshots: 6 }));
  if (errors.length) throw Error('Browser errors');
} finally {
  await browser?.close();
  await server.close();
}
