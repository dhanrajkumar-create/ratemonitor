export async function scrapeXE(fromCur, toCur) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCur}`);
    if (!res.ok) return null;
    const data = await res.json();
    const baseRate = data.rates[toCur];
    if (baseRate) {
      return {
        rate: baseRate * 0.985, // Simulate a realistic 1.5% XE margin
        fee: 20 // Typical XE flat fee for small amounts
      };
    }
    return null;
  } catch (err) {
    console.error("XE simulated scraper error:", err.message);
    return null;
  }
}
