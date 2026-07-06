// Instarem — Direct API primary, Playwright page scraping fallback
// Primary API: https://www.instarem.com/wp-json/instarem/v2/convert-rate/cad/
// Response: { status: true, data: { INR: 66.47, PHP: 43.15, ... } }
// Fallback: Playwright loads /en/currency-conversion/cad-to-inr/ and scrapes the rate text

import { launchBrowser } from './browser.js';

const SUPPORTED = ['INR', 'PHP', 'LKR', 'UAH', 'NPR', 'BDT', 'PKR'];

export async function scrapeInstarem(fromCur = 'CAD', toCurrencies = SUPPORTED) {
  // ── Primary: Direct WordPress API (returns all currencies at once) ──────
  try {
    const res = await fetch(
      `https://www.instarem.com/wp-json/instarem/v2/convert-rate/${fromCur.toLowerCase()}/`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://www.instarem.com/',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (res.ok) {
      const json = await res.json();
      if (json.status && json.data) {
        const results = [];
        for (const toCur of toCurrencies) {
          const rate = parseFloat(json.data[toCur]);
          if (!rate || rate <= 0) continue;
          results.push({
            fromCurrency:    fromCur,
            toCurrency:      toCur,
            exchangeRate:    rate,
            promotionalRate: null,
            fee:             null,
            deliveryTime:    null,
            transferType:    'Online',
          });
        }
        if (results.length > 0) {
          console.log(`[Instarem] API: fetched ${results.length} currencies`);
          return results;
        }
      }
    }
  } catch (e) {
    console.warn('[Instarem] direct API failed, falling back to page scraping:', e.message?.slice(0, 60));
  }

  // ── Fallback: Playwright DOM scraping ──────────────────────────────────
  let browser;
  try {
    browser = await launchBrowser();
  } catch (e) {
    console.error('[Instarem] browser launch failed:', e.message);
    return [];
  }

  const results = [];

  try {

    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-CA',
      extraHTTPHeaders: { 'Accept-Language': 'en-CA,en;q=0.9' },
    });

    for (const toCur of toCurrencies) {
      const page = await ctx.newPage();

      try {
        // Also try to capture any API response the page fires
        let apiRate = null;
        const apiCapture = page.waitForResponse(
          r => r.url().includes('convert-rate') || r.url().includes('exchange-rate'),
          { timeout: 12000 }
        ).then(async (r) => {
          try {
            const body = await r.json();
            // Various response shapes Instarem might use
            const rate = body?.data?.[toCur] || body?.rate || body?.exchange_rate;
            if (rate) apiRate = parseFloat(rate);
          } catch {}
        }).catch(() => {});

        const slug = `${fromCur.toLowerCase()}-to-${toCur.toLowerCase()}`;
        await page.goto(
          `https://www.instarem.com/en/currency-conversion/${slug}/`,
          { waitUntil: 'domcontentloaded', timeout: 35000 }
        );

        await Promise.race([apiCapture, page.waitForTimeout(6000)]);

        // Scrape rate from rendered page text
        const pageRate = await page.evaluate((toCur) => {
          const text = document.body.innerText;

          // Pattern: "1 CAD = 66.47 INR"
          const p1 = new RegExp(`1\\s+CAD\\s*[=→]\\s*([\\d.,]+)\\s+${toCur}`, 'i');
          const m1 = text.match(p1);
          if (m1) return parseFloat(m1[1].replace(',', ''));

          // Pattern: "1 CAD = 66.47" without currency
          const m2 = text.match(/1\s+CAD\s*[=→]\s*([\d.,]+)/i);
          if (m2) return parseFloat(m2[1].replace(',', ''));

          // Pattern: standalone rate number near the currency pair in large display
          const p3 = new RegExp(`([\\d.]+)\\s*${toCur}\\s*per\\s*(1\\s*)?CAD`, 'i');
          const m3 = text.match(p3);
          if (m3) return parseFloat(m3[1]);

          return null;
        }, toCur);

        const rate = apiRate ?? pageRate;
        if (rate && rate > 0 && rate < 1_000_000) {
          results.push({
            fromCurrency:    fromCur,
            toCurrency:      toCur,
            exchangeRate:    rate,
            promotionalRate: null,
            fee:             null,
            deliveryTime:    null,
            transferType:    'Online',
          });
          console.log(`[Instarem] ${toCur}: rate=${rate} (page scraping)`);
        } else {
          console.warn(`[Instarem] ${toCur}: rate not found on page`);
        }
      } catch (e) {
        console.error(`[Instarem] ${toCur}:`, e.message?.slice(0, 80));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return results;
}
