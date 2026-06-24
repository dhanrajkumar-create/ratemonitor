export async function scrapeRia(fromCur, toCur) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCur}`);
    if (!res.ok) return null;
    const data = await res.json();
    const baseRate = data.rates[toCur];
    if (baseRate) {
      return {
        rate: baseRate * 0.988, // Simulate a realistic 1.2% Ria margin
        fee: 0
      };
    }
    return null;
  } catch (err) {
    console.error("Ria simulated scraper error:", err.message);
    return null;
  }
}
