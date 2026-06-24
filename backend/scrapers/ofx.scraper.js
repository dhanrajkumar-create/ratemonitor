export async function scrapeOFX(fromCur, toCur) {
  try {
    const res = await fetch(`https://api.ofx.com/PublicSite.ApiService/OFX/spotrate/Individual/${fromCur}/${toCur}/10000?format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.CustomerRate ? { rate: parseFloat(data.CustomerRate), fee: 0 } : null;
  } catch (err) {
    console.error("OFX scraper error:", err.message);
    return null;
  }
}
