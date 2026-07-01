// MoneyGram — Firefox + single-context strategy
//
// DataDome allows the FIRST fee-quote request from a fresh Firefox session.
// Subsequent requests from the same IP/session hit Cloudflare challenges.
//
// Strategy: load ONE page (INR) to establish the DataDome session cookie,
// then immediately fetch ALL currencies via page.evaluate (in-page fetch)
// using `credentials: 'include'` so the DataDome cookie is included.
//
// API: /api/send-money/fee-quote/v2?senderCountryCode=CAN&senderCurrencyCode=CAD
//        &receiverCountryCode={3-letter}&sendAmount=100.00
// Response: { feeQuotesByCurrency: { INR: { fxRate, sendFee, promo: { fxRate } } } }

const SUPPORTED = ['INR', 'PHP', 'LKR', 'UAH', 'NPR', 'BDT', 'PKR'];

const COUNTRY_CODE = {
  INR: 'IND', PHP: 'PHL', LKR: 'LKA',
  UAH: 'UKR', NPR: 'NPL', BDT: 'BGD', PKR: 'PAK',
};

export async function scrapeMoneyGram(fromCur = 'CAD', toCurrencies = SUPPORTED) {
  let firefox;
  try { ({ firefox } = await import('playwright')); } catch { return []; }

  let browser;
  const results = [];

  try {
    browser = await firefox.launch({ headless: true });

    // ONE context — reuse the DataDome session across all currencies
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
      viewport: { width: 1440, height: 900 },
      locale: 'en-CA',
      extraHTTPHeaders: { 'Accept-Language': 'en-CA,en;q=0.9' },
    });

    const page = await ctx.newPage();

    // Listen for the automatic INR fee-quote — tells us if DataDome allows the session
    let sessionAllowed = false; // true = DataDome let the fee-quote through (200 JSON)
    let sessionBlocked = false; // true = DataDome returned 403 or captcha JSON

    page.on('response', async (r) => {
      if (!r.url().includes('fee-quote/v2')) return;
      const ct = r.headers()['content-type'] || '';
      if (ct.includes('javascript')) return; // Cloudflare challenge — skip, wait for real response

      // This is the final response (real data or DataDome block)
      if (r.status() === 200 && ct.includes('json')) {
        try {
          const body = await r.json();
          if (body?.url?.includes('captcha')) { sessionBlocked = true; return; }
          if (body?.feeQuotesByCurrency) { sessionAllowed = true; }
        } catch {}
      } else {
        sessionBlocked = true; // 403 or other non-200
      }
    });

    try {
      // Load INR page — this is our "anchor" request that establishes the session
      await page.goto(
        'https://www.moneygram.com/ca/en/currency-converter/cad-to-inr',
        { waitUntil: 'domcontentloaded', timeout: 40000 }
      );

      // Wait up to 18s for the fee-quote response (success or block)
      const deadline = Date.now() + 18000;
      while (!sessionAllowed && !sessionBlocked && Date.now() < deadline) {
        await page.waitForTimeout(300);
      }

      if (sessionBlocked) {
        console.warn('[MoneyGram] DataDome blocked this session — no data');
        return [];
      }

      if (!sessionAllowed) {
        // Fee-quote didn't arrive (Cloudflare challenge + timeout).
        // Still try the in-page fetch — the monitoring endpoint may have set a cookie.
        console.warn('[MoneyGram] INR fee-quote timed out, attempting in-page fetch anyway');
      }

      // Wait for DataDome monitoring endpoint to set its cookie (if not already done)
      await page.waitForTimeout(1500);

      // Build the list of currencies to fetch
      const targets = toCurrencies
        .map(cur => ({ cur, code: COUNTRY_CODE[cur] }))
        .filter(({ code }) => !!code);

      // Fetch ALL currencies via in-page fetch (uses the DataDome session cookie)
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
            if (!body || typeof body !== 'object') return { cur, err: 'bad json' };
            if (body?.url?.includes('captcha')) return { cur, err: 'captcha' };
            const q = body?.feeQuotesByCurrency?.[cur];
            return q ? { cur, fxRate: q.fxRate, sendFee: q.sendFee, promo: q.promo }
                     : { cur, err: `no_key_${cur}` };
          } catch (e) { return { cur, err: e.message }; }
        }));
        return results;
      }, targets);

      for (const d of allData) {
        if (d.err) {
          console.warn(`[MoneyGram] ${d.cur}: ${d.err}`);
          continue;
        }
        const fxRate  = parseFloat(d.fxRate);
        const sendFee = parseFloat(d.sendFee ?? 0);
        const promo   = d.promo;
        const promoRate = promo
          ? parseFloat(promo.fxRate ?? promo.exchangeRate ?? promo.rate ?? 0)
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
        console.warn('[MoneyGram] in-page fetch returned no valid rates');
      }
    } catch (e) {
      console.error('[MoneyGram]', e.message?.slice(0, 80));
    } finally {
      await page.close().catch(() => {});
      await ctx.close().catch(() => {});
    }
  } finally {
    if (browser) await browser.close();
  }
  return results;
}
