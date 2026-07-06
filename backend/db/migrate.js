// Run once to create all tables: node backend/db/migrate.js
import pool from '../config/database.js';

// ── Shared tables ─────────────────────────────────────────────────────────────

const SHARED_TABLES = `
CREATE TABLE IF NOT EXISTS exchange_rates (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider        VARCHAR(50)  NOT NULL,
  from_currency   VARCHAR(5)   NOT NULL DEFAULT 'CAD',
  to_currency     VARCHAR(5)   NOT NULL,
  exchange_rate   DECIMAL(18,6),
  promotional_rate DECIMAL(18,6),
  fee             DECIMAL(10,4),
  delivery_time   VARCHAR(100),
  transfer_type   VARCHAR(50),
  last_updated    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_provider_currency (provider, from_currency, to_currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rate_history (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider        VARCHAR(50)  NOT NULL,
  from_currency   VARCHAR(5)   NOT NULL DEFAULT 'CAD',
  to_currency     VARCHAR(5)   NOT NULL,
  exchange_rate   DECIMAL(18,6),
  promotional_rate DECIMAL(18,6),
  fee             DECIMAL(10,4),
  delivery_time   VARCHAR(100),
  transfer_type   VARCHAR(50),
  recorded_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_provider_currency (provider, to_currency, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS scrape_logs (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider        VARCHAR(50)  NOT NULL,
  status          VARCHAR(20)  NOT NULL,
  message         TEXT,
  screenshot_path VARCHAR(500),
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_provider (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

// ── Per-company table template ────────────────────────────────────────────────
// One row per scrape run per currency — append-only history
function companyTableSQL(tableName) {
  return `
CREATE TABLE IF NOT EXISTS \`${tableName}\` (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  from_currency    VARCHAR(5)   NOT NULL DEFAULT 'CAD',
  to_currency      VARCHAR(5)   NOT NULL,
  exchange_rate    DECIMAL(18,6),
  promotional_rate DECIMAL(18,6),
  fee              DECIMAL(10,4),
  delivery_time    VARCHAR(100),
  transfer_type    VARCHAR(50),
  recorded_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_currency      (to_currency),
  INDEX idx_date          (recorded_at),
  INDEX idx_currency_date (to_currency, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
}

// ── Provider → table name mapping ─────────────────────────────────────────────
export const PROVIDER_TABLE = {
  'Remitbee':      'remitbee',
  'Remitly':       'remitly',
  'TapTap Send':   'taptap_send',
  'LemFi':         'lemfi',
  'Instarem':      'instarem',
  'MoneyGram':     'moneygram',
  'Kabayan Remit': 'kabayan_remit',
};

async function runMigration() {
  console.log('Running database migration...\n');

  const conn = await pool.getConnection();
  try {
    // Create shared tables (split by semicolon, run individually)
    const sharedStatements = SHARED_TABLES
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const sql of sharedStatements) {
      await conn.query(sql);
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\S+)/i);
      if (match) console.log(`  ✔ Shared table: ${match[1]}`);
    }

    // Create per-company tables
    for (const [provider, tableName] of Object.entries(PROVIDER_TABLE)) {
      await conn.query(companyTableSQL(tableName));
      console.log(`  ✔ Company table: \`${tableName}\`  (${provider})`);
    }

    console.log('\nMigration complete — all tables ready.');
  } finally {
    conn.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
