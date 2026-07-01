// TapTap Send — Playwright loads home page, captures /api/fxRates response
// API structure: { availableCountries: [{ isoCountryCode:'CA', currency:'CAD', corridors: [{currency, fxRate, senderCurrencyFlatFee?}] }] }

const SUPPORTED = ['INR', 'PHP', 'LKR', 'UAH', 'NPR', 'BDT', 'PKR'];

// TapTap country ISO codes for our currencies
const CURRENCY_ISO = {
  INR: 'IN', PHP: 'PH', LKR: 'LK',
  UAH: 'UA', NPR: 'NP', BDT: 'BD', PKR: 'PK',
};

export async function scrapeTapTapSend(fromCur = 'CAD', toCurrencies = SUPPORTED) {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { return []; }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-CA',
      extraHTTPHeaders: { 'Accept-Language': 'en-CA,en;q=0.9' },
    });

    const page = await ctx.newPage();
    let fxData = null;

    // waitForResponse resolves as soon as fxRates fires — no fixed wait needed
    const fxRespPromise = page.waitForResponse(
      r => r.url().includes('/api/fxRates'),
      { timeout: 30000 }
    ).then(async r => { fxData = await r.json(); }).catch(() => {});

    await page.goto('https://www.taptapsend.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait up to 20s for fxRates — page can be slow when other browsers run in parallel
    await Promise.race([fxRespPromise, page.waitForTimeout(20000)]);

    await browser.close();

    if (!fxData) {
      console.error('[TapTap] fxRates not captured');
      return [];
    }

    // Find Canada's sending corridors
    const canada = fxData.availableCountries?.find(
      c => c.isoCountryCode === 'CA' && c.currency === fromCur
    );
    if (!canada?.corridors) return [];

    const results = [];
    for (const toCur of toCurrencies) {
      const isoCode = CURRENCY_ISO[toCur];
      // Match by currency code first, then by country ISO
      const corridor = canada.corridors.find(c => c.currency === toCur)
                    || canada.corridors.find(c => c.isoCountryCode === isoCode);
      if (!corridor) continue;

      const rate = parseFloat(corridor.fxRate);
      if (!rate || rate <= 0) continue;

      // Fee: senderCurrencyFlatFee or feeSchedule.flatFee, or 0 if not present
      const feeStr = corridor.senderCurrencyFlatFee
                  || corridor.feeSchedule?.flatFee
                  || '0';
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
    if (browser) await browser.close();
    return [];
  }
}
