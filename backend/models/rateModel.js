import pool from '../config/database.js';

// ── Provider → company table name ─────────────────────────────────────────────
const PROVIDER_TABLE = {
  'Remitbee':      'remitbee',
  'Remitly':       'remitly',
  'TapTap Send':   'taptap_send',
  'LemFi':         'lemfi',
  'Instarem':      'instarem',
  'MoneyGram':     'moneygram',
  'Kabayan Remit': 'kabayan_remit',
};

// ── exchange_rates (latest row per provider+currency, upserted) ───────────────
const UPSERT_SQL = `
  INSERT INTO exchange_rates
    (provider, from_currency, to_currency, exchange_rate, promotional_rate, fee, delivery_time, transfer_type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    exchange_rate    = VALUES(exchange_rate),
    promotional_rate = VALUES(promotional_rate),
    fee              = VALUES(fee),
    delivery_time    = VALUES(delivery_time),
    transfer_type    = VALUES(transfer_type),
    last_updated     = CURRENT_TIMESTAMP
`;

// ── rate_history (shared append-only log) ────────────────────────────────────
const HISTORY_SQL = `
  INSERT INTO rate_history
    (provider, from_currency, to_currency, exchange_rate, promotional_rate, fee, delivery_time, transfer_type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

export async function saveRates(provider, rates = []) {
  const tableName = PROVIDER_TABLE[provider] ?? null;

  for (const r of rates) {
    const sharedValues = [
      provider,
      r.fromCurrency    ?? 'CAD',
      r.toCurrency,
      r.exchangeRate    ?? null,
      r.promotionalRate ?? null,
      r.fee             ?? null,
      r.deliveryTime    ?? null,
      r.transferType    ?? null,
    ];

    // Upsert into shared latest-rates table
    await pool.execute(UPSERT_SQL, sharedValues);

    // Append to shared history log
    await pool.execute(HISTORY_SQL, sharedValues);

    // Append to per-company history table (one row per scrape per currency)
    if (tableName) {
      const companyValues = [
        r.fromCurrency    ?? 'CAD',
        r.toCurrency,
        r.exchangeRate    ?? null,
        r.promotionalRate ?? null,
        r.fee             ?? null,
        r.deliveryTime    ?? null,
        r.transferType    ?? null,
      ];
      await pool.execute(
        `INSERT INTO \`${tableName}\`
           (from_currency, to_currency, exchange_rate, promotional_rate, fee, delivery_time, transfer_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        companyValues
      );
    }
  }
}

export async function saveLog(provider, status, message, screenshotPath = null) {
  await pool.execute(
    'INSERT INTO scrape_logs (provider, status, message, screenshot_path) VALUES (?, ?, ?, ?)',
    [provider, status, String(message ?? '').slice(0, 60000), screenshotPath]
  );
}

export async function getLatestRates(toCurrency = null) {
  const where = toCurrency ? 'WHERE to_currency = ?' : '';
  const params = toCurrency ? [toCurrency] : [];
  const [rows] = await pool.execute(
    `SELECT provider, from_currency, to_currency, exchange_rate,
            promotional_rate, fee, delivery_time, transfer_type, last_updated
     FROM exchange_rates ${where}
     ORDER BY provider, to_currency`,
    params
  );
  return rows;
}

export async function getRemitbeeRates() {
  const [rows] = await pool.execute(
    `SELECT to_currency, exchange_rate, promotional_rate
     FROM exchange_rates WHERE provider = 'Remitbee'`
  );
  return Object.fromEntries(rows.map(r => [r.to_currency, r]));
}

// ── Per-company history queries ───────────────────────────────────────────────

export async function getCompanyHistory(provider, toCurrency = null, { fromDate = null, limit = 500 } = {}) {
  const tableName = PROVIDER_TABLE[provider];
  if (!tableName) throw new Error(`Unknown provider: ${provider}`);

  const conditions = [];
  const params = [];

  if (toCurrency) { conditions.push('to_currency = ?'); params.push(toCurrency); }
  if (fromDate)   { conditions.push('recorded_at >= ?'); params.push(fromDate); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const [rows] = await pool.execute(
    `SELECT from_currency, to_currency, exchange_rate, promotional_rate,
            fee, delivery_time, transfer_type, recorded_at
     FROM \`${tableName}\` ${where}
     ORDER BY recorded_at DESC
     LIMIT ?`,
    params
  );
  return rows;
}

export async function getDailySnapshot(provider, toCurrency = null, days = 30) {
  const tableName = PROVIDER_TABLE[provider];
  if (!tableName) throw new Error(`Unknown provider: ${provider}`);

  const currencyFilter = toCurrency ? 'AND to_currency = ?' : '';
  const params = toCurrency ? [days, toCurrency] : [days];

  // One row per (currency, date) — average rate for the day
  const [rows] = await pool.execute(
    `SELECT
       to_currency,
       DATE(recorded_at)      AS rate_date,
       AVG(exchange_rate)     AS avg_rate,
       MAX(exchange_rate)     AS max_rate,
       MIN(exchange_rate)     AS min_rate,
       AVG(promotional_rate)  AS avg_promo_rate,
       AVG(fee)               AS avg_fee,
       COUNT(*)               AS scrape_count
     FROM \`${tableName}\`
     WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ${currencyFilter}
     GROUP BY to_currency, DATE(recorded_at)
     ORDER BY rate_date DESC, to_currency`,
    params
  );
  return rows;
}

// Shared history (all providers in one query)
export async function getRateHistory(toCurrency, fromDate = null) {
  const where = fromDate
    ? 'WHERE to_currency = ? AND recorded_at >= ?'
    : 'WHERE to_currency = ?';
  const params = fromDate ? [toCurrency, fromDate] : [toCurrency];
  const [rows] = await pool.execute(
    `SELECT provider, from_currency, to_currency, exchange_rate,
            promotional_rate, fee, recorded_at
     FROM rate_history ${where}
     ORDER BY recorded_at DESC
     LIMIT 500`,
    params
  );
  return rows;
}
