// Shared Chromium launcher for all scrapers.
//
// On Netlify / Lambda  →  @sparticuz/chromium (Lambda-optimised binary, included in node_modules)
//                         + playwright-core (no bundled browser — connects via executablePath)
// Local / VPS          →  full playwright (bundled Chromium already on disk)
//
// Usage:
//   import { launchBrowser } from './browser.js';
//   const browser = await launchBrowser();                  // standard
//   const browser = await launchBrowser({ stealth: true }); // DataDome-proof (MoneyGram)

const IS_LAMBDA = !!(
  process.env.NETLIFY ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

const BASE_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-blink-features=AutomationControlled',
  '--disable-gpu',
  '--single-process',       // required on Lambda — no forking allowed
];

export async function launchBrowser({ stealth = false } = {}) {
  if (IS_LAMBDA) {
    let chromiumBin;
    try {
      chromiumBin = (await import('@sparticuz/chromium')).default;
    } catch (e) {
      throw new Error(`@sparticuz/chromium not available: ${e.message}`);
    }

    const executablePath = await chromiumBin.executablePath();

    const launchOpts = {
      args: [...chromiumBin.args, ...BASE_ARGS],
      executablePath,
      headless: chromiumBin.headless ?? true,
    };

    if (stealth) {
      // playwright-extra + stealth plugin overrides executablePath too
      const { chromium } = await import('playwright-extra');
      const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
      chromium.use(StealthPlugin()); // playwright-extra deduplicates repeated use() calls
      return chromium.launch(launchOpts);
    }

    const { chromium } = await import('playwright-core');
    return chromium.launch(launchOpts);
  }

  // ── Local / VPS ──────────────────────────────────────────────────────────
  const launchOpts = {
    headless: true,
    args: BASE_ARGS,
  };

  if (stealth) {
    const { chromium } = await import('playwright-extra');
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    chromium.use(StealthPlugin());
    return chromium.launch(launchOpts);
  }

  const { chromium } = await import('playwright');
  return chromium.launch(launchOpts);
}
