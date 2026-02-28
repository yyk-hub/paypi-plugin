-- PayPi Secure Database Schema
-- Database: paypi-db (D1/SQLite)

-- ============================================
-- MERCHANT PROFILES (Public Info)
-- ============================================
CREATE TABLE IF NOT EXISTS merchants (
  merchant_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  
  -- Credit system
  credit_balance REAL DEFAULT 0,
  total_deposits REAL DEFAULT 0,
  total_processed REAL DEFAULT 0,
  
  -- Status
  payments_enabled BOOLEAN DEFAULT 0,
  low_balance_warning BOOLEAN DEFAULT 0,
  
  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(business_email);

-- ============================================
-- API KEYS (Hashed - SECURE)
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_api_keys (
  key_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  
  -- Security
  api_key_hash TEXT UNIQUE NOT NULL,  -- SHA-256 hash, NEVER plain text
  key_prefix TEXT NOT NULL,            -- e.g., 'pk_live_abc' for display
  
  -- Tracking
  last_used_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER,                  -- Optional expiration
  is_revoked BOOLEAN DEFAULT 0,
  
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_merchant ON merchant_api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON merchant_api_keys(api_key_hash);

-- ============================================
-- PAYMENT ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS paypi_orders (
  order_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  pi_username TEXT,
  
  -- Amounts
  total_amt REAL NOT NULL,
  pi_amount REAL NOT NULL,
  credits_charged REAL NOT NULL,
  
  -- Status
  order_status TEXT,
  
  -- Pi Network payment IDs
  pi_payment_id TEXT,
  pi_txid TEXT,
  
  -- Refund tracking
  has_refund BOOLEAN DEFAULT 0,
  refunded_at INTEGER,
  
  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER,
  
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_paypi_orders_merchant ON paypi_orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_paypi_orders_user ON paypi_orders(user_uid);
CREATE INDEX IF NOT EXISTS idx_paypi_orders_status ON paypi_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_paypi_orders_created ON paypi_orders(created_at);

-- ============================================
-- CREDIT TRANSACTIONS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  tx_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  
  -- Type of transaction
  type TEXT CHECK(type IN ('deposit', 'deduction', 'refund')) NOT NULL,
  
  -- Amounts
  amount REAL NOT NULL,  -- Credits
  pi_amount REAL,        -- Equivalent π value
  balance_after REAL NOT NULL,
  
  -- Details
  description TEXT,
  pi_txid TEXT,  -- For deposits
  
  -- Timestamp
  created_at INTEGER DEFAULT (unixepoch()),
  
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_merchant ON credit_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at);

-- ============================================
-- WEBHOOK EVENTS LOG (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT,
  
  -- Event details
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,  -- JSON
  
  -- Response tracking
  response_status INTEGER,
  response_body TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  sent_at INTEGER,
  
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id),
  FOREIGN KEY (order_id) REFERENCES paypi_orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_merchant ON webhook_events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_order ON webhook_events(order_id);

-- ============================================
-- SECURITY AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS security_audit_log (
  log_id TEXT PRIMARY KEY,
  merchant_id TEXT,
  
  -- Event
  event_type TEXT NOT NULL,  -- 'api_key_created', 'api_key_used', 'api_key_revoked', 'login_failed', etc.
  ip_address TEXT,
  user_agent TEXT,
  
  -- Details
  details TEXT,  -- JSON
  severity TEXT CHECK(severity IN ('info', 'warning', 'critical')),
  
  -- Timestamp
  created_at INTEGER DEFAULT (unixepoch()),
  
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_merchant ON security_audit_log(merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON security_audit_log(created_at);