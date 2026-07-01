// Remitbee — uses their public API. Captures regular rate + promotional/offer/bonus rate.
const SUPPORTED = ['INR', 'PHP', 'LKR', 'UAH', 'NPR', 'BDT', 'PKR'];

export async function scrapeRemitbee(fromCur = 'CAD', toCurrencies = SUPPORTED) {
  // Use plain fetch — no extra headers to avoid triggering bot protection
  const res = await fetch(
    'https://api.remitbee.com/public-services/compressed/online-rates-multi-currency'
  );
  if (!res.ok) throw new Error(`Remitbee API HTTP ${res.status}`);
  const data = await res.json();

  const results = [];
  for (const toCur of toCurrencies) {
    const r = data.rates?.find(x => x.currency_code === toCur);
    if (!r) continue;

    const exchangeRate    = r.rate         ? parseFloat(r.rate)         : null;
    const promotionalRate = r.special_rate ? parseFloat(r.special_rate)
                          : r.offer_rate   ? parseFloat(r.offer_rate)
                          : r.bonus_rate   ? parseFloat(r.bonus_rate)
                          : null;

    results.push({
      fromCurrency: fromCur,
      toCurrency: toCur,
      exchangeRate,
      promotionalRate,
      fee: 0,
      deliveryTime: null,
      transferType: 'Online',
    });
  }
  return results;
}
