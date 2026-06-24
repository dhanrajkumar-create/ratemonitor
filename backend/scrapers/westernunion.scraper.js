export async function scrapeWesternUnion(fromCur, toCur) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCur}`);
    if (!res.ok) return null;
    const data = await res.json();
    const baseRate = data.rates[toCur];
    if (baseRate) {
      return {
        rate: baseRate * 0.980, // Simulate a realistic 2.0% WU margin
        fee: 10 // Typical WU flat fee
      };
    }
    return null;
  } catch (err) {
    console.error("WesternUnion simulated scraper error:", err.message);
    return null;
  }
}
