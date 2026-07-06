// Kabayan Remit only supports CAD→PHP from Canada
const SUPPORTED = ['PHP'];

export async function scrapeKabayanRemit(fromCur = 'CAD', toCurrencies = SUPPORTED) {
  // Only PHP is supported from CAD — skip immediately for any other request
  const targets = toCurrencies.filter(c => SUPPORTED.includes(c));
  if (targets.length === 0) return [];

  // Dynamic import — fails gracefully on Netlify/Lambda where no browser binary exists
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.log('[KabayanRemit] playwright not available, skipping');
    return [];
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'en-CA',
    });

    const page = await ctx.newPage();

    try {
      await page.goto('https://kabayanremit.com/', {
        waitUntil: 'load',
        timeout: 30000,
      });
    } catch {
      console.log('[KabayanRemit] Site not reachable — VPN inactive or timeout, skipping');
      return [];
    }

    // Detect Cloudflare block or geo-restriction before doing anything else
    const pageTitle = await page.title();
    if (pageTitle.includes('Access denied') || pageTitle.includes('Cloudflare') ||
        pageTitle.includes('1015') || pageTitle.includes('rate limited')) {
      console.warn(`[KabayanRemit] Cloudflare block: "${pageTitle}" — switch VPN server or wait a few minutes`);
      return [];
    }

    // window.ratesConfig is set by an inline <script> block rendered server-side.
    // Wait up to 8s for it to appear in case the script runs after page load fires.
    let ratesConfig = null;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      ratesConfig = await page.evaluate(() => window.ratesConfig ?? null);
      if (ratesConfig) break;
      await page.waitForTimeout(300);
    }

    if (!ratesConfig || !Array.isArray(ratesConfig)) {
      console.warn('[KabayanRemit] window.ratesConfig not found — site may be geo-blocked');
      return [];
    }

    // Find the Canada entry
    const canadaEntry = ratesConfig.find(c => c.countryCode === 'CA');
    if (!canadaEntry) {
      console.warn('[KabayanRemit] Canada not found in ratesConfig');
      return [];
    }

    // Pick the "bank_transfer → credit_to_account" option as the reference rate
    // (standard online transfer — most comparable to other providers)
    const preferredOption = canadaEntry.paymentOptions.find(o =>
      o.paymentMethod === 'payment.payment_methods.bank_transfer' &&
      o.deliveryMethod === 'payment.delivery_methods.credit_to_account'
    ) ?? canadaEntry.paymentOptions[0];

    if (!preferredOption || !preferredOption.ranges?.length) {
      console.warn('[KabayanRemit] No payment option ranges found for Canada');
      return [];
    }

    // Use the first range (smallest amount) to get the base rate and fee
    const firstRange = preferredOption.ranges[0];
    const rate = parseFloat(firstRange.rate);
    const promoRate = firstRange.preferentialRate ? parseFloat(firstRange.preferentialRate) : null;
    const fee = parseFloat(firstRange.fee);

    if (!rate || rate <= 0) {
      console.warn('[KabayanRemit] Invalid rate in ratesConfig');
      return [];
    }

    console.log(`[KabayanRemit] CAD→PHP: rate=${rate}, promoRate=${promoRate}, fee=${fee}`);

    return [{
      fromCurrency: fromCur,
      toCurrency: 'PHP',
      exchangeRate: rate,
      promotionalRate: promoRate !== rate ? promoRate : null,
      fee,
      deliveryTime: null,
      transferType: 'Online',
    }];

  } catch (err) {
    console.error('[KabayanRemit] Error:', err.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}
