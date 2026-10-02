// Screenshots of the live product for its README, taken by the Publisher's `screenshots` job (no secrets):
//
//   PLAYWRIGHT_DIR=<dir with playwright-core installed> node .github/scripts/screenshots.mjs <url> <out-dir>
//
// It drives the runner's own Google Chrome through playwright-core, so nothing is downloaded. The Cloudflare Web
// Analytics beacon is blocked, so these visits never count as traffic. Locally, point CHROME_PATH at any Chromium.
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const [url, outDir] = process.argv.slice(2);
if (!url || !/^https?:\/\//.test(url) || !outDir) {
  console.error('usage: node .github/scripts/screenshots.mjs <url> <out-dir>');
  process.exit(2);
}

const require = createRequire(join(process.env.PLAYWRIGHT_DIR ?? process.cwd(), 'noop.js'));
const { chromium } = require('playwright-core');

// What a visitor sees first, plus (desktop) the first numbered section, in the light theme the site opens in.
// Phones at 2x so text stays sharp.
const VIEWS = [
  { name: 'desktop-light', theme: 'light', viewport: { width: 1440, height: 960 }, scale: 1, mobile: false },
  { name: 'mobile-light', theme: 'light', viewport: { width: 390, height: 844 }, scale: 2, mobile: true },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' },
);
try {
  for (const view of VIEWS) {
    const context = await browser.newContext({
      viewport: view.viewport,
      deviceScaleFactor: view.scale,
      isMobile: view.mobile,
      hasTouch: view.mobile,
      colorScheme: view.theme,
      reducedMotion: 'reduce',
    });
    // The template's theme switch reads localStorage before first paint (index.html, src/lib/theme.ts).
    await context.addInitScript((theme) => {
      try {
        localStorage.setItem('theme', theme);
      } catch {
        // storage blocked: the page falls back to light
      }
    }, view.theme);
    await context.route(/cloudflareinsights\.com/, (route) => route.abort());
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const path = join(outDir, `${view.name}.png`);
    await page.screenshot({ path });
    console.log(`${view.name}: ${path}`);

    // On desktop, also the tool itself: the first numbered section, scrolled to just under the sticky header.
    if (!view.mobile && (await page.locator('main section[id]').count()) > 0) {
      await page.evaluate(() => {
        const section = document.querySelector('main section[id]');
        const header = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
        if (section) window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY - header);
      });
      await page.waitForTimeout(300);
      const sectionPath = join(outDir, `${view.name.replace('desktop', 'section')}.png`);
      await page.screenshot({ path: sectionPath });
      console.log(`${view.name.replace('desktop', 'section')}: ${sectionPath}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
