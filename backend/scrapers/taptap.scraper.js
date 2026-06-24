// No top-level playwright import — dynamic import only, so Netlify can bundle this file

const COUNTRY_SLUG_MAP = {
  PHP: 'philippines',
  INR: 'india',
  NGN: 'nigeria',
  GHS: 'ghana',
  KES: 'kenya',
  UGX: 'uganda',
  TZS: 'tanzania',
  ETB: 'ethiopia',
  XOF: 'senegal',
  MAD: 'morocco',
  EGP: 'egypt',
  PKR: 'pakistan',
  BDT: 'bangladesh',
  LKR: 'sri-lanka',
};

export async function scrapeTapTapSend(fromCur, toCur) {
  const slug = COUNTRY_SLUG_MAP[toCur];
  const url = slug
    ? `https://www.taptapsend.com/en/send-money/canada-to-${slug}`
    : 'https://www.taptapsend.com/en';

  // Try browser scraping (works locally with playwright installed; skipped on Netlify)
  const browserResult = await tryPlaywrightScrape(url, fromCur, toCur);
  if (browserResult) return browserResult;

  return fallbackFromER(fromCur, toCur, 0.99);
}

async function tryPlaywrightScrape(url, fromCur, toCur) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return null; // playwright not available on Netlify — skip silently
  }

  let browser;
  let capturedRate = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    page.on('response', async (response) => {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      try {
        const body = await response.json();
        const rate = extractRateFromJSON(body, fromCur, toCur);
        if (rate) capturedRate = rate;
      } catch {}
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    if (capturedRate) {
      return { rate: capturedRate, fee: 0, currencyPair: `${fromCur}/${toCur}`, sourceUrl: url };
    }

    const text = await page.locator('body').innerText();
    const rate = parseRateFromText(text, fromCur, toCur);
    if (rate) return { rate, fee: 0, currencyPair: `${fromCur}/${toCur}`, sourceUrl: url };

  } catch (err) {
    console.error('TapTap playwright error:', err.message);
  } finally {
    if (browser) await browser.close();
  }
  return null;
}

function isValidRate(n) {
  return !isNaN(n) && n > 0.000001 && n < 1_000_000;
}

function extractRateFromJSON(body, fromCur, toCur) {
  if (!body || typeof body !== 'object') return null;
  const candidates = [
    body.exchange_rate, body.exchangeRate,
    body.data?.exchange_rate, body.data?.exchangeRate,
    body.quote?.exchange_rate,
    body.result?.exchange_rate,
  ];
  for (const v of candidates) {
    const n = parseFloat(v);
    if (isValidRate(n)) return n;
  }
  if (Array.isArray(body.rates)) {
    const r = body.rates.find(r =>
      r.currency === toCur || r.currency_code === toCur || r.to === toCur
    );
    if (r) {
      const n = parseFloat(r.rate || r.exchange_rate);
      if (isValidRate(n)) return n;
    }
  }
  return null;
}

function parseRateFromText(text, fromCur, toCur) {
  const patterns = [
    new RegExp(`1\\s*${fromCur}\\s*=\\s*([0-9][0-9.,]*)\\s*${toCur}`, 'i'),
    new RegExp(`([0-9][0-9.,]*)\\s*${toCur}\\s*=\\s*1\\s*${fromCur}`, 'i'),
    new RegExp(`[Tt]oday['s]*\\s*[Rr]ate[:\\s]*${fromCur}\\s*1\\s*=\\s*([0-9][0-9.,]*)\\s*${toCur}`, 'i'),
    new RegExp(`[Tt]oday['s]*\\s*[Rr]ate[:\\s]+([0-9][0-9.,]*)`, 'i'),
    new RegExp(`${fromCur}\\s*1\\s*=\\s*([0-9][0-9.,]*)\\s*${toCur}`, 'i'),
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = Number(m[1].replace(/,/g, ''));
      if (n > 0) return n;
    }
  }
  return null;
}

async function fallbackFromER(fromCur, toCur, multiplier = 0.99) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCur}`);
    if (!res.ok) return null;
    const data = await res.json();
    const base = data.rates[toCur];
    if (!base) return null;
    return { rate: base * multiplier, fee: 0, currencyPair: `${fromCur}/${toCur}`, sourceUrl: 'er-api-fallback' };
  } catch {
    return null;
  }
}
