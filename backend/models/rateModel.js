import pool from '../config/database.js';

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

export async function saveRates(provider, rates = []) {
  for (const r of rates) {
    await pool.execute(UPSERT_SQL, [
      provider,
      r.fromCurrency ?? 'CAD',
      r.toCurrency,
      r.exchangeRate   ?? null,
      r.promotionalRate ?? null,
      r.fee            ?? null,
      r.deliveryTime   ?? null,
      r.transferType   ?? null,
    ]);
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
