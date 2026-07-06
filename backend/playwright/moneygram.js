// MoneyGram — playwright-extra + stealth plugin to bypass DataDome bot detection
//
// DataDome fingerprints headless browsers via JS APIs (webdriver, plugins, chrome runtime, etc.)
// playwright-extra + puppeteer-extra-plugin-stealth patches 20+ of those APIs so the
// headless browser is indistinguishable from a real Chrome user.
//
// Strategy:
//   1. Launch stealth Chromium (works on Lambda via @sparticuz/chromium + stealth plugin)
//   2. Load the INR currency-converter page (establishes DataDome session)
//   3. Capture the automatic fee-quote response for INR (confirms session is live)
//   4. Use page.evaluate() to fetch all other currencies via in-page fetch
//      (same DataDome session cookie — no extra page loads needed)

import { launchBrowser } from './browser.js';

const SUPPORTED = ['INR', 'PHP', 'LKR', 'UAH', 'NPR', 'BDT', 'PKR'];

const COUNTRY_CODE = {
  INR: 'IND', PHP: 'PHL', LKR: 'LKA',
  UAH: 'UKR', NPR: 'NPL', BDT: 'BGD', PKR: 'PAK',
};

export async function scrapeMoneyGram(fromCur = 'CAD', toCurrencies = SUPPORTED) {
  let browser;
  try {
    browser = await launchBrowser({ stealth: true });
  } catch (e) {
    console.error('[MoneyGram] browser launch failed:', e.message);
    return [];
  }

  const results = [];

  try {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'en-CA',
      extraHTTPHeaders: { 'Accept-Language': 'en-CA,en;q=0.9' },
    });

    const page = await ctx.newPage();

    let sessionAllowed = false;
    let sessionBlocked = false;

    page.on('response', async (r) => {
      if (!r.url().includes('fee-quote/v2')) return;
      const ct = r.headers()['content-type'] || '';
      if (ct.includes('javascript')) return;
      if (ct.includes('html')) { sessionBlocked = true; return; }
      if (r.status() === 200 && ct.includes('json')) {
        try {
          const body = await r.json();
          if (body?.url?.includes('captcha')) { sessionBlocked = true; return; }
          if (body?.feeQuotesByCurrency) sessionAllowed = true;
        } catch {}
      } else {
        sessionBlocked = true;
      }
    });

    try {
      await page.goto(
        'https://www.moneygram.com/ca/en/currency-converter/cad-to-inr',
        { waitUntil: 'domcontentloaded', timeout: 20000 }
      );

      const deadline = Date.now() + 15000;
      while (!sessionAllowed && !sessionBlocked && Date.now() < deadline) {
        await page.waitForTimeout(300);
      }

      if (sessionBlocked) {
        console.warn('[MoneyGram] DataDome still blocking — stealth may need update');
        return [];
      }

      if (!sessionAllowed) {
        console.warn('[MoneyGram] fee-quote timed out, attempting in-page fetch anyway');
      } else {
        console.log('[MoneyGram] Session established — fetching all currencies');
      }

      await page.waitForTimeout(1000);

      const targets = toCurrencies
        .map(cur => ({ cur, code: COUNTRY_CODE[cur] }))
        .filter(({ code }) => !!code);

      const allData = await page.evaluate(async (targets) => {
        const results = await Promise.all(targets.map(async ({ cur, code }) => {
          try {
            const url = `/api/send-money/fee-quote/v2?senderCountryCode=CAN&senderCurrencyCode=CAD&receiverCountryCode=${code}&sendAmount=100.00`;
            const res = await fetch(url, {
              credentials: 'include',
              headers: { Accept: 'application/json, */*' },
            });
            if (!res.ok) return { cur, err: `HTTP ${res.status}` };
            const body = await res.json();
            if (!body || typeof body !== 'object') return { cur, err: 'bad_json' };
            if (body?.url?.includes('captcha')) return { cur, err: 'captcha' };
            const q = body?.feeQuotesByCurrency?.[cur];
            return q
              ? { cur, fxRate: q.fxRate, sendFee: q.sendFee, promo: q.promo }
              : { cur, err: `no_key_${cur}` };
          } catch (e) { return { cur, err: e.message }; }
        }));
        return results;
      }, targets);

      for (const d of allData) {
        if (d.err) { console.warn(`[MoneyGram] ${d.cur}: ${d.err}`); continue; }
        const fxRate    = parseFloat(d.fxRate);
        const sendFee   = parseFloat(d.sendFee ?? 0);
        const promoRate = d.promo
          ? parseFloat(d.promo.fxRate ?? d.promo.exchangeRate ?? d.promo.rate ?? 0)
          : 0;

        if (fxRate > 0 && fxRate < 1_000_000) {
          results.push({
            fromCurrency:    fromCur,
            toCurrency:      d.cur,
            exchangeRate:    fxRate,
            promotionalRate: promoRate > 0 && promoRate !== fxRate ? promoRate : null,
            fee:             isNaN(sendFee) ? null : sendFee,
            deliveryTime:    null,
            transferType:    'Online',
          });
          console.log(`[MoneyGram] ${d.cur}: rate=${fxRate}, promo=${promoRate || 'none'}, fee=${sendFee}`);
        }
      }

      if (results.length === 0) {
        console.warn('[MoneyGram] No valid rates (DataDome may still be blocking)');
      }
    } catch (e) {
      console.error('[MoneyGram]', e.message?.slice(0, 100));
    } finally {
      await page.close().catch(() => {});
      await ctx.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return results;
}
