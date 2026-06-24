export async function scrapeRemitBee(fromCur, toCur) {
  try {
    const res = await fetch('https://api.remitbee.com/public-services/compressed/online-rates-multi-currency');
    if (!res.ok) return null;
    
    const data = await res.json();
    const rateData = data.rates.find(r => r.currency_code === toCur);
    
    if (rateData) {
      // Use special_rate if available, otherwise regular rate
      const exactRate = rateData.special_rate ? parseFloat(rateData.special_rate) : parseFloat(rateData.rate);
      return {
        rate: exactRate,
        fee: 0 // Typically Remitbee has 0 fee for amounts over threshold
      };
    }
    
    return null;
  } catch (err) {
    console.error("RemitBee exact API error:", err.message);
    return null;
  }
}
