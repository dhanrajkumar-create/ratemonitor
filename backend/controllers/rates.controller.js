import { getLatestRates, getRemitbeeRates } from '../models/rateModel.js';
import { scrapeRemitbee }   from '../playwright/remitbee.js';
import { scrapeRemitly }    from '../playwright/remitly.js';
import { scrapeTapTapSend } from '../playwright/taptapsend.js';
import { scrapeLemFi }      from '../playwright/lemfi.js';
import { scrapeInstarem }   from '../playwright/instarem.js';
import { scrapeMoneyGram }  from '../playwright/moneygram.js';

const TO_CURRENCIES = ['INR', 'PHP', 'LKR', 'UAH', 'NPR', 'BDT', 'PKR'];
const PROVIDERS = [
  { name: 'Remitbee',    fn: scrapeRemitbee   },
  { name: 'Remitly',     fn: scrapeRemitly    },
  { name: 'TapTap Send', fn: scrapeTapTapSend },
  { name: 'LemFi',       fn: scrapeLemFi      },
  { name: 'Instarem',    fn: scrapeInstarem   },
  { name: 'MoneyGram',   fn: scrapeMoneyGram  },
];

// Per-currency in-memory cache (5 min) — keyed by currency code or 'all'
const memCache = {};

export async function getRates(req, res) {
  const toCurrency = req.query.to || null;
  const cacheKey = toCurrency || 'all';

  try {
    // ── Try MySQL ──────────────────────────────────────────────────────────
    const rows = await getLatestRates(toCurrency);
    if (rows.length > 0) {
      const remitbeeMap = await getRemitbeeRates();
      return res.json({ success: true, source: 'db', data: attachVsRemitbee(rows, remitbeeMap) });
    }
  } catch {
    // MySQL not configured — fall through to live scraping
  }

  // ── Live scraping fallback (Netlify / no DB) ────────────────────────────
  const now = Date.now();
  const cached = memCache[cacheKey];
  if (cached && now - cached.ts < 5 * 60 * 1000) {
    return res.json({ success: true, source: 'cache', data: cached.data });
  }

  try {
    const currencies = toCurrency ? [toCurrency] : TO_CURRENCIES;

    // Each provider gets 45 seconds max — prevents one slow/hung provider from blocking all
    const withTimeout = (promise, ms) => Promise.race([
      promise,
      new Promise(resolve => setTimeout(() => resolve([]), ms)),
    ]);

    const allRates = await Promise.allSettled(
      PROVIDERS.map(p =>
        withTimeout(
          p.fn('CAD', currencies).then(rates => rates.map(r => ({ ...r, provider: p.name }))),
          45000
        )
      )
    );

    const rows = allRates
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .map(r => ({
        provider:         r.provider,
        from_currency:    r.fromCurrency || 'CAD',
        to_currency:      r.toCurrency,
        exchange_rate:    r.exchangeRate,
        promotional_rate: r.promotionalRate,
        fee:              r.fee,
        delivery_time:    r.deliveryTime,
        transfer_type:    r.transferType,
        last_updated:     new Date().toISOString(),
      }));

    const remitbeeMap = {};
    rows.filter(r => r.provider === 'Remitbee').forEach(r => { remitbeeMap[r.to_currency] = r; });

    const result = attachVsRemitbee(rows, remitbeeMap);
    memCache[cacheKey] = { data: result, ts: now };

    return res.json({ success: true, source: 'live', data: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function attachVsRemitbee(rows, remitbeeMap) {
  return rows.map(r => {
    const bee = remitbeeMap[r.to_currency];
    const beeRate = parseFloat(bee?.exchange_rate ?? bee?.exchangeRate ?? 0);
    const myRate  = parseFloat(r.exchange_rate ?? r.exchangeRate ?? 0);

    let vsRemitbee = null;
    let vsLabel    = null;
    let vsColor    = null;

    if (r.provider !== 'Remitbee' && beeRate > 0 && myRate > 0) {
      const diff = myRate - beeRate;
      vsRemitbee = diff;
      if (Math.abs(diff) < 0.0001) {
        vsLabel = 'Equal'; vsColor = 'gray';
      } else if (diff > 0) {
        vsLabel = '▲ Better'; vsColor = 'green';
      } else {
        vsLabel = '▼ Lower'; vsColor = 'red';
      }
    }

    return { ...r, vsRemitbee, vsLabel, vsColor };
  });
}
