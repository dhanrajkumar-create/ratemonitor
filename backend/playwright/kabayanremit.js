// Kabayan Remit — only supports CAD→PHP from Canada
// Rate data is in window.ratesConfig, injected server-side by PHP before page load.

import { launchBrowser } from './browser.js';

const SUPPORTED = ['PHP'];

export async function scrapeKabayanRemit(fromCur = 'CAD', toCurrencies = SUPPORTED) {
  const targets = toCurrencies.filter(c => SUPPORTED.includes(c));
  if (targets.length === 0) return [];

  let browser;
  try {
    browser = await launchBrowser();
  } catch (e) {
    console.error('[KabayanRemit] browser launch failed:', e.message);
    return [];
  }

  try {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'en-CA',
    });

    const page = await ctx.newPage();

    try {
      await page.goto('https://kabayanremit.com/', { waitUntil: 'load', timeout: 20000 });
    } catch {
      console.log('[KabayanRemit] Site not reachable — VPN inactive or timeout');
      return [];
    }

    const pageTitle = await page.title();
    if (pageTitle.includes('Access denied') || pageTitle.includes('Cloudflare') ||
        pageTitle.includes('1015') || pageTitle.includes('rate limited')) {
      console.warn(`[KabayanRemit] Cloudflare block: "${pageTitle}"`);
      return [];
    }

    // window.ratesConfig is set by PHP-rendered inline script — poll until present
    let ratesConfig = null;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      ratesConfig = await page.evaluate(() => window.ratesConfig ?? null);
      if (ratesConfig) break;
      await page.waitForTimeout(300);
    }

    if (!ratesConfig || !Array.isArray(ratesConfig)) {
      console.warn('[KabayanRemit] window.ratesConfig not found');
      return [];
    }

    const canadaEntry = ratesConfig.find(c => c.countryCode === 'CA');
    if (!canadaEntry) return [];

    const preferredOption = canadaEntry.paymentOptions.find(o =>
      o.paymentMethod === 'payment.payment_methods.bank_transfer' &&
      o.deliveryMethod === 'payment.delivery_methods.credit_to_account'
    ) ?? canadaEntry.paymentOptions[0];

    if (!preferredOption?.ranges?.length) return [];

    const firstRange = preferredOption.ranges[0];
    const rate      = parseFloat(firstRange.rate);
    const promoRate = firstRange.preferentialRate ? parseFloat(firstRange.preferentialRate) : null;
    const fee       = parseFloat(firstRange.fee);

    if (!rate || rate <= 0) return [];

    console.log(`[KabayanRemit] CAD→PHP: rate=${rate}, promoRate=${promoRate}, fee=${fee}`);

    return [{
      fromCurrency:    fromCur,
      toCurrency:      'PHP',
      exchangeRate:    rate,
      promotionalRate: promoRate !== rate ? promoRate : null,
      fee,
      deliveryTime:    null,
      transferType:    'Online',
    }];

  } catch (err) {
    console.error('[KabayanRemit] Error:', err.message);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}
