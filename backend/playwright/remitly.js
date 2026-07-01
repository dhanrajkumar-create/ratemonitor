// Remitly — Direct API call to api.remitly.io (no browser needed)
// API discovered via network interception: /v3/calculator/estimate?conduit=CAN:CAD-IND:INR

const SUPPORTED = ['INR', 'PHP', 'LKR', 'UAH', 'NPR', 'BDT', 'PKR'];

const COUNTRY_MAP = {
  INR: 'IND', PHP: 'PHL', LKR: 'LKA',
  UAH: 'UKR', NPR: 'NPL', BDT: 'BGD', PKR: 'PAK',
};

export async function scrapeRemitly(fromCur = 'CAD', toCurrencies = SUPPORTED) {
  const results = [];

  for (const toCur of toCurrencies) {
    const country3 = COUNTRY_MAP[toCur];
    if (!country3) continue;

    const conduit = encodeURIComponent(`CAN:CAD-${country3}:${toCur}`);
    const url = `https://api.remitly.io/v3/calculator/estimate?conduit=${conduit}&anchor=SEND&amount=1000&purpose=OTHER`;

    let data = null;
    let backoff = 600;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        if (res.status === 429) {
          console.warn(`[Remitly] ${toCur}: 429, retrying in ${backoff}ms`);
          await new Promise(r => setTimeout(r, backoff));
          backoff *= 2;
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        break;
      } catch (e) {
        console.error(`[Remitly] ${toCur}:`, e.message);
        break;
      }
    }

    const est = data?.estimate;
    if (!est) continue;

    const base  = parseFloat(est.exchange_rate?.base_rate);
    const promo = parseFloat(est.exchange_rate?.promotional_exchange_rate);
    const fee   = parseFloat(est.fee?.total_fee_amount);
    const delivery = est.pay_in_method === 'INTERAC' ? 'Minutes (Interac)' : null;

    if (!base || base <= 0) continue;

    results.push({
      fromCurrency:    fromCur,
      toCurrency:      toCur,
      exchangeRate:    base,
      promotionalRate: isNaN(promo) || promo <= 0 ? null : promo,
      fee:             isNaN(fee) ? 0 : fee,
      deliveryTime:    delivery,
      transferType:    'Online',
    });
  }

  return results;
}
