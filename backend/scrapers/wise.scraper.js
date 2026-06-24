export async function scrapeWise(fromCur, toCur) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCur}`);
    if (!res.ok) return null;
    const data = await res.json();
    const baseRate = data.rates[toCur];
    if (baseRate) {
      return {
        rate: baseRate * 0.995, // Simulate a realistic 0.5% Wise margin
        fee: 5 // Typical Wise flat fee
      };
    }
    return null;
  } catch (err) {
    console.error("Wise simulated scraper error:", err.message);
    return null;
  }
}
