// Netlify Scheduled Background Function
// Runs every 30 minutes (cron set in netlify.toml).
// Background functions have a 15-minute timeout — no pressure for browser scrapers.
// Scrapes all 7 providers in parallel, saves results to Netlify Blobs.
// The /api/rates function reads from Blobs instantly — all 7 providers, zero timeout risk.

import { getStore } from '@netlify/blobs';
import { scrapeRemitbee }     from '../playwright/remitbee.js';
import { scrapeRemitly }      from '../playwright/remitly.js';
import { scrapeTapTapSend }   from '../playwright/taptapsend.js';
import { scrapeLemFi }        from '../playwright/lemfi.js';
import { scrapeInstarem }     from '../playwright/instarem.js';
import { scrapeMoneyGram }    from '../playwright/moneygram.js';
import { scrapeKabayanRemit } from '../playwright/kabayanremit.js';

const TO_CURRENCIES = ['INR', 'PHP', 'LKR', 'UAH', 'NPR', 'BDT', 'PKR'];

const PROVIDERS = [
  { name: 'Remitbee',      fn: scrapeRemitbee     },
  { name: 'Remitly',       fn: scrapeRemitly      },
  { name: 'TapTap Send',   fn: scrapeTapTapSend   },
  { name: 'LemFi',         fn: scrapeLemFi        },
  { name: 'Instarem',      fn: scrapeInstarem     },
  { name: 'MoneyGram',     fn: scrapeMoneyGram    },
  { name: 'Kabayan Remit', fn: scrapeKabayanRemit },
];

export const handler = async () => {
  console.log('[Scrape] Scheduled run — scraping all 7 providers in parallel');

  const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise(r => setTimeout(() => r([]), ms))]);

  const settled = await Promise.allSettled(
    PROVIDERS.map(p =>
      withTimeout(
        p.fn('CAD', TO_CURRENCIES).catch(() => []),
        120000  // 2 min per provider — fine within 15-min background limit
      ).then(rates =>
        (rates || []).map(r => ({
          provider:         p.name,
          from_currency:    r.fromCurrency || 'CAD',
          to_currency:      r.toCurrency,
          exchange_rate:    r.exchangeRate,
          promotional_rate: r.promotionalRate ?? null,
          fee:              r.fee ?? null,
          delivery_time:    r.deliveryTime ?? null,
          transfer_type:    r.transferType ?? 'Online',
          last_updated:     new Date().toISOString(),
        }))
      )
    )
  );

  const rows = settled
    .filter(s => s.status === 'fulfilled')
    .flatMap(s => s.value);

  const providerCounts = PROVIDERS.map((p, i) => {
    const count = settled[i].status === 'fulfilled' ? settled[i].value.length : 0;
    return `${p.name}=${count}`;
  }).join(' ');
  console.log(`[Scrape] Results: ${rows.length} total — ${providerCounts}`);

  if (rows.length === 0) {
    console.warn('[Scrape] No rates fetched — skipping Blobs write');
    return { statusCode: 200, body: 'no data' };
  }

  try {
    const store = getStore({ name: 'rates', consistency: 'strong' });
    await store.setJSON('all', rows);
    await store.setJSON('meta', {
      updated_at: new Date().toISOString(),
      count: rows.length,
      providers: PROVIDERS.map((p, i) =>
        settled[i].status === 'fulfilled' ? p.name : null
      ).filter(Boolean),
    });
    console.log(`[Scrape] Saved ${rows.length} rates to Netlify Blobs`);
  } catch (e) {
    console.error('[Scrape] Blobs write failed:', e.message);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ count: rows.length }),
  };
};
