export async function scrapeTransferGo(fromCur, toCur) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fromCur}`);
    if (!res.ok) return null;
    const data = await res.json();
    const baseRate = data.rates[toCur];
    if (baseRate) {
      return {
        rate: baseRate * 0.990, // Simulate a realistic 1.0% TransferGo margin
        fee: 0 // Usually 0 fee for standard delivery
      };
    }
    return null;
  } catch (err) {
    console.error("TransferGo simulated scraper error:", err.message);
    return null;
  }
}
