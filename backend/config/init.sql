-- Run this once to initialize the database:
-- mysql -u root -p < backend/config/init.sql

CREATE DATABASE IF NOT EXISTS rate_monitor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rate_monitor;

CREATE TABLE IF NOT EXISTS exchange_rates (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  provider         VARCHAR(50)     NOT NULL,
  from_currency    CHAR(3)         NOT NULL DEFAULT 'CAD',
  to_currency      CHAR(3)         NOT NULL,
  exchange_rate    DECIMAL(12, 5)  DEFAULT NULL,
  promotional_rate DECIMAL(12, 5)  DEFAULT NULL,
  fee              DECIMAL(10, 2)  DEFAULT NULL,
  delivery_time    VARCHAR(100)    DEFAULT NULL,
  transfer_type    VARCHAR(50)     DEFAULT NULL,
  last_updated     TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_provider_pair (provider, from_currency, to_currency),
  INDEX idx_to_currency (to_currency),
  INDEX idx_provider   (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS scrape_logs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  provider        VARCHAR(50)                   NOT NULL,
  status          ENUM('success','error')        NOT NULL,
  message         TEXT,
  screenshot_path VARCHAR(255)                  DEFAULT NULL,
  created_at      TIMESTAMP                     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_provider_ts (provider, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
