import pool from '../config/database.js';

// ── exchange_rates (latest row per provider+currency, upserted) ──────────────
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

// ── rate_history (append-only, keeps full history) ───────────────────────────
const HISTORY_SQL = `
  INSERT INTO rate_history
    (provider, from_currency, to_currency, exchange_rate, promotional_rate, fee, delivery_time, transfer_type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

export async function saveRates(provider, rates = []) {
  for (const r of rates) {
    const values = [
      provider,
      r.fromCurrency ?? 'CAD',
      r.toCurrency,
      r.exchangeRate   ?? null,
      r.promotionalRate ?? null,
      r.fee            ?? null,
      r.deliveryTime   ?? null,
      r.transferType   ?? null,
    ];
    await pool.execute(UPSERT_SQL, values);
    await pool.execute(HISTORY_SQL, values); // also append to history
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
