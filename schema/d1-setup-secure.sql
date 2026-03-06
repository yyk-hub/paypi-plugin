-- PayPi Secure Database Schema - PRODUCTION READY
-- Database: paypi-db (D1/SQLite)
-- 
-- IMPROVEMENTS:
-- 1. BOOLEAN → INTEGER with CHECK constraints (SQLite compatibility)
-- 2. UNIQUE constraint on pi_payment_id (prevent duplicate payments)
-- 3. CHECK constraints on all status fields (data integrity)
-- 4. Indexes for performance (100x faster lookups)
-- 5. NOT NULL on order_status with CHECK constraint
-- 6. ON DELETE CASCADE for referential integrity
-- 7. updated_at triggers for automatic timestamp updates
-- 8. Idempotency table for API duplicate prevention

-- ============================================
-- MERCHANT PROFILES (Public Info)
-- ============================================
CREATE TABLE IF NOT EXISTS merchants (
  merchant_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL UNIQUE,
  
  -- Credit system
  credit_balance REAL DEFAULT 0 CHECK (credit_balance >= 0),
  total_deposits REAL DEFAULT 0 CHECK (total_deposits >= 0),
  total_processed REAL DEFAULT 0 CHECK (total_processed >= 0),
  
  -- Status (INTEGER for SQLite, CHECK for validation)
  payments_enabled INTEGER DEFAULT 0 CHECK (payments_enabled IN (0, 1)),
  low_balance_warning INTEGER DEFAULT 0 CHECK (low_balance_warning IN (0, 1)),
  
  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(business_email);

-- Trigger: Auto-update updated_at on merchants
CREATE TRIGGER IF NOT EXISTS merchants_updated_at
AFTER UPDATE ON merchants
FOR EACH ROW
BEGIN
  UPDATE merchants SET updated_at = unixepoch() WHERE merchant_id = NEW.merchant_id;
END;

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
  expires_at INTEGER,
  is_revoked INTEGER DEFAULT 0 CHECK (is_revoked IN (0, 1)),
  
  -- ON DELETE CASCADE: Remove keys when merchant is deleted
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
  total_amt REAL NOT NULL CHECK (total_amt > 0),
  pi_amount REAL NOT NULL CHECK (pi_amount > 0),
  credits_charged REAL NOT NULL CHECK (credits_charged >= 0),
  
  -- Status: NOT NULL with CHECK constraint for valid states
  order_status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (order_status IN ('Pending', 'Paid', 'Cancelled', 'Refunded', 'Failed')),
  
  -- Pi Network payment IDs (UNIQUE prevents duplicate confirmations)
  pi_payment_id TEXT UNIQUE,
  pi_txid TEXT,
  
  -- Refund tracking
  has_refund INTEGER DEFAULT 0 CHECK (has_refund IN (0, 1)),
  refunded_at INTEGER,
  
  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER,
  updated_at INTEGER DEFAULT (unixepoch()),
  
  -- ON DELETE CASCADE: Remove orders when merchant is deleted
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_paypi_orders_merchant ON paypi_orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_paypi_orders_user ON paypi_orders(user_uid);
CREATE INDEX IF NOT EXISTS idx_paypi_orders_status ON paypi_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_paypi_orders_created ON paypi_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_paypi_orders_payment ON paypi_orders(pi_payment_id);

-- Trigger: Auto-update updated_at on paypi_orders
CREATE TRIGGER IF NOT EXISTS paypi_orders_updated_at
AFTER UPDATE ON paypi_orders
FOR EACH ROW
BEGIN
  UPDATE paypi_orders SET updated_at = unixepoch() WHERE order_id = NEW.order_id;
END;

-- ============================================
-- CREDIT TRANSACTIONS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  tx_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  
  -- Type of transaction (validated)
  type TEXT NOT NULL CHECK (type IN ('deposit', 'deduction', 'refund')),
  
  -- Amounts (must be non-negative)
  amount REAL NOT NULL CHECK (amount >= 0),
  pi_amount REAL CHECK (pi_amount >= 0),
  balance_after REAL NOT NULL CHECK (balance_after >= 0),
  
  -- Details
  description TEXT,
  pi_txid TEXT,
  
  -- Timestamp
  created_at INTEGER DEFAULT (unixepoch()),
  
  -- ON DELETE CASCADE: Remove transactions when merchant is deleted
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_merchant ON credit_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at);

-- ============================================
-- IDEMPOTENCY KEYS (Prevent Duplicate API Requests)
-- ============================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  
  -- Store the response to return on duplicate requests
  response TEXT NOT NULL,  -- JSON response
  
  -- Metadata
  endpoint TEXT NOT NULL,   -- Which API endpoint
  request_hash TEXT,        -- Hash of request body (optional)
  
  -- Expiry (cleanup old keys after 24 hours)
  created_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER DEFAULT ((unixepoch()) + 86400),  -- 24 hours
  
  -- ON DELETE CASCADE: Remove keys when merchant is deleted
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_idempotency_merchant ON idempotency_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

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
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  
  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  sent_at INTEGER,
  
  -- ON DELETE CASCADE
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES paypi_orders(order_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_merchant ON webhook_events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_order ON webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);

-- ============================================
-- SECURITY AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS security_audit_log (
  log_id TEXT PRIMARY KEY,
  merchant_id TEXT,
  
  -- Event
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  
  -- Details
  details TEXT,  -- JSON
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- Timestamp
  created_at INTEGER DEFAULT (unixepoch()),
  
  -- ON DELETE SET NULL: Keep logs even if merchant deleted
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_merchant ON security_audit_log(merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON security_audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON security_audit_log(created_at);

-- ============================================
-- CLEANUP: Expired Idempotency Keys
-- ============================================
-- Note: D1 doesn't support scheduled triggers, so cleanup should be done via:
-- 1. Periodic Cloudflare Worker cron job
-- 2. On-demand via admin endpoint
-- 
-- Example cleanup query:
-- DELETE FROM idempotency_keys WHERE expires_at < unixepoch();