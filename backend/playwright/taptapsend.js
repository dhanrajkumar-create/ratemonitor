// TapTap Send — Playwright loads home page, captures /api/fxRates response
// API structure: { availableCountries: [{ isoCountryCode:'CA', currency:'CAD', corridors: [{currency, fxRate, senderCurrencyFlatFee?}] }] }

import { launchBrowser } from './browser.js';

const SUPPORTED = ['INR', 'PHP', 'LKR', 'UAH', 'NPR', 'BDT', 'PKR'];

const CURRENCY_ISO = {
  INR: 'IN', PHP: 'PH', LKR: 'LK',
  UAH: 'UA', NPR: 'NP', BDT: 'BD', PKR: 'PK',
};

export async function scrapeTapTapSend(fromCur = 'CAD', toCurrencies = SUPPORTED) {
  let browser;
  try {
    browser = await launchBrowser();
  } catch (e) {
    console.error('[TapTap] browser launch failed:', e.message);
    return [];
  }

  try {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-CA',
      extraHTTPHeaders: { 'Accept-Language': 'en-CA,en;q=0.9' },
    });

    const page = await ctx.newPage();
    let fxData = null;

    const fxRespPromise = page.waitForResponse(
      r => r.url().includes('/api/fxRates'),
      { timeout: 20000 }
    ).then(async r => { fxData = await r.json(); }).catch(() => {});

    await page.goto('https://www.taptapsend.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    await Promise.race([fxRespPromise, page.waitForTimeout(18000)]);

    if (!fxData) {
      console.error('[TapTap] fxRates not captured');
      return [];
    }

    const canada = fxData.availableCountries?.find(
      c => c.isoCountryCode === 'CA' && c.currency === fromCur
    );
    if (!canada?.corridors) return [];

    const results = [];
    for (const toCur of toCurrencies) {
      const isoCode = CURRENCY_ISO[toCur];
      const corridor = canada.corridors.find(c => c.currency === toCur)
                    || canada.corridors.find(c => c.isoCountryCode === isoCode);
      if (!corridor) continue;

      const rate = parseFloat(corridor.fxRate);
      if (!rate || rate <= 0) continue;

      const feeStr = corridor.senderCurrencyFlatFee || corridor.feeSchedule?.flatFee || '0';
      const fee = parseFloat(feeStr) || 0;

      results.push({
        fromCurrency:    fromCur,
        toCurrency:      toCur,
        exchangeRate:    rate,
        promotionalRate: null,
        fee,
        deliveryTime:    null,
        transferType:    'Online',
      });
    }

    return results;
  } catch (e) {
    console.error('[TapTap]', e.message);
    return [];
  } finally {
    await browser.close().catch(() => {});
  }
}
