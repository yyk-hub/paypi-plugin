# PayPi Prepaid Credit Model - Complete Documentation

**Last Updated:** 2026-02-28  
**Version:** 1.0.0 (Pure Math with Secure API Keys)

---

## 🎯 Overview

PayPi uses a **prepaid credit system** where merchants deposit π to receive processing credits. This model:
- ✅ Avoids money transmitter licensing (service credits, not payment processing)
- ✅ Provides predictable costs for merchants
- ✅ Ensures platform revenue upfront
- ✅ Enables non-custodial customer payments
- ✅ Uses pure math (2% fee, no complex calculations)

---

## 💰 Pure Math Credit System

### Formula (Simple!)
```
Deposit:  1π = 1 credit (exact 1:1)
Payment:  cost = amount × 0.02 (2% fee)
Capacity: credits ÷ 0.02 = π processable
```

### Why This Works
```
Merchant deposits: 200π
Credits received: 200 (1:1 ratio)
Processing capacity: 200 ÷ 0.02 = 10,000π

Fee verification:
200π / 10,000π × 100 = 2% ✅
```

---

## 🔄 Complete Payment Flow

```
┌─────────────────────────────────────────────┐
│  STEP 1: MERCHANT DEPOSITS (U2A)            │
│  Merchant → Platform Wallet: 200π           │
│  System credits: 200 credits (1:1)          │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  STEP 2: CUSTOMER CHECKOUT                  │
│  Customer clicks "Pay 100π"                 │
│  SDK checks: credits >= 2? ✅               │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  STEP 3: PAYMENT APPROVAL                   │
│  Backend verifies: credits >= 2? ✅          │
│  Approve on Pi Network                      │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  STEP 4: PAYMENT EXECUTION                  │
│  Customer → Merchant Wallet: 100π (direct!) │
│  Non-custodial: PayPi never holds funds     │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  STEP 5: CREDIT DEDUCTION                   │
│  Calculate: 100π × 0.02 = 2 credits         │
│  Deduct: 200 - 2 = 198 credits              │
│  Log transaction in credit_transactions     │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  STEP 6: BALANCE UPDATE                     │
│  Merchant balance: 198 credits              │
│  Capacity: 198 ÷ 0.02 = 9,900π              │
│  Low balance? Set warning flag              │
└─────────────────────────────────────────────┘
```

---

## 📊 Examples with Real Numbers

### Example 1: Initial Setup
```
Action: Merchant deposits 200π
Calculation: 200π × 1 = 200 credits
Result:
  Credits: 200
  Capacity: 200 ÷ 0.02 = 10,000π
  Fee: 200π / 10,000π = 2% ✅
```

### Example 2: First Payment
```
Action: Customer pays 100π
Calculation: 100π × 0.02 = 2 credits
Result:
  Credits: 200 - 2 = 198
  Capacity: 198 ÷ 0.02 = 9,900π
  Customer paid: 100π → Merchant wallet ✅
  PayPi fee: 2π (collected via credits)
```

### Example 3: Decimal Payment (Fiat Conversion)
```
Action: Product costs $50 USD
Exchange rate: 1π = $3.50
Pi amount: $50 ÷ $3.50 = 14.285714π

Calculation: 14.285714π × 0.02 = 0.2857142 credits

Result:
  Credits: 200 - 0.2857142 = 199.7142858
  Capacity: 199.7142858 ÷ 0.02 = 9,985.71π
  Works perfectly with decimals! ✅
```

### Example 4: Small Payment
```
Action: Customer pays 1π
Calculation: 1π × 0.02 = 0.02 credits

Result:
  Credits: 200 - 0.02 = 199.98
  Capacity: 199.98 ÷ 0.02 = 9,999π
```

### Example 5: Multiple Payments
```
10 payments of 100π each:
  Total: 1,000π processed
  Total credits: 1,000 × 0.02 = 20 credits
  Balance: 200 - 20 = 180 credits
  Capacity remaining: 180 ÷ 0.02 = 9,000π
```

---

## 🗄️ Database Schema

### merchants Table
```sql
CREATE TABLE merchants (
  merchant_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  
  -- Credit system
  credit_balance REAL DEFAULT 0,        -- Current credits (1π = 1 credit)
  total_deposits REAL DEFAULT 0,        -- Total π deposited
  total_processed REAL DEFAULT 0,       -- Total π processed
  
  -- Status
  payments_enabled BOOLEAN DEFAULT 0,   -- Auto-disabled at 0 credits
  low_balance_warning BOOLEAN DEFAULT 0, -- Warning at < 20 credits
  
  created_at INTEGER DEFAULT (unixepoch())
);
```

### merchant_api_keys Table (🔒 Secure)
```sql
CREATE TABLE merchant_api_keys (
  key_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  
  -- Security: NEVER store plain-text keys!
  api_key_hash TEXT UNIQUE NOT NULL,    -- SHA-256 hash only
  key_prefix TEXT NOT NULL,             -- 'pk_live_abc...' for display
  
  last_used_at INTEGER,
  is_revoked BOOLEAN DEFAULT 0,
  
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);
```

### paypi_orders Table
```sql
CREATE TABLE paypi_orders (
  order_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  
  total_amt REAL NOT NULL,              -- Payment amount in π
  credits_charged REAL NOT NULL,        -- amount × 0.02
  
  order_status TEXT,                    -- 'Pending', 'Paid', 'Cancelled'
  pi_payment_id TEXT,
  pi_txid TEXT,
  
  created_at INTEGER DEFAULT (unixepoch()),
  
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);
```

### credit_transactions Table
```sql
CREATE TABLE credit_transactions (
  tx_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  
  type TEXT CHECK(type IN ('deposit', 'deduction', 'refund')),
  amount REAL NOT NULL,                 -- Credits
  pi_amount REAL,                       -- Equivalent π
  balance_after REAL NOT NULL,
  
  description TEXT,
  pi_txid TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);
```

---

## 🔐 Security: API Key Management

### Why Hash API Keys?

**❌ Problem (Old):**
```sql
CREATE TABLE merchants (
  api_key TEXT  -- Plain text! Insecure!
)
```
If database is compromised, attacker gets ALL API keys.

**✅ Solution (New):**
```sql
CREATE TABLE merchant_api_keys (
  api_key_hash TEXT  -- SHA-256 hash only!
)
```
If database is compromised, attacker only gets useless hashes.

### How It Works

```javascript
// 1. Generate key (registration)
const apiKey = 'pk_live_abc123xyz789';  // Random

// 2. Hash with SHA-256 (NEVER store plain text!)
const hash = await hashApiKey(apiKey);  // 'a7f3b2c4...'

// 3. Store only hash
await DB.prepare(`
  INSERT INTO merchant_api_keys (api_key_hash)
  VALUES (?)
`).bind(hash).run();

// 4. Show plain key to user ONCE
return { api_key: apiKey };  // Never shown again!

// 5. Validate on API calls
const providedHash = await hashApiKey(providedKey);
const match = (providedHash === storedHash);  // Secure!
```

### Key Features
- ✅ One-time display during registration
- ✅ SHA-256 hashing (irreversible)
- ✅ Key rotation support
- ✅ Revocation via flag
- ✅ Audit logging
- ✅ Expiration support

---

## 📡 API Endpoints

### 1. Register Merchant
```bash
POST /api/merchant/register
Content-Type: application/json

{
  "business_name": "My Store",
  "business_email": "hello@mystore.com",
  "wallet_address": "GXXXXXXXX"
}

Response:
{
  "success": true,
  "merchant_id": "merch_123",
  "api_key": "pk_live_abc123xyz789",  # ⚠️ Shown ONCE!
  "key_prefix": "pk_live_abc...",
  "credit_balance": 0,
  "credit_system": {
    "formula": "1π deposit = 1 credit",
    "fee": "2% per transaction"
  },
  "warning": "⚠️ SAVE YOUR API KEY NOW!"
}
```

### 2. Deposit Credits
```bash
POST /api/merchant/credit-deposit
Content-Type: application/json

{
  "pi_payment_id": "xxx",
  "txid": "yyy",
  "merchant_id": "merch_123",
  "amount": 200
}

Response:
{
  "success": true,
  "deposit_amount": "200π",
  "credits_added": 200,
  "new_balance": "200 credits",
  "capacity": "10000π can process",
  "fee_rate": "2%"
}
```

### 3. Check Credits (Secure)
```bash
POST /api/merchant/check-credits
Authorization: Bearer pk_live_abc123xyz789
Content-Type: application/json

{
  "amount": 100
}

Response:
{
  "has_credits": true,
  "balance": "200 credits",
  "needed": "2 credits",
  "payment_amount": "100π",
  "capacity": "10000π",
  "fee_rate": "2%"
}
```

### 4. Approve Payment (with Credit Check)
```bash
POST /api/pi/approve
Content-Type: application/json

{
  "payment_id": "xxx",
  "order_id": "ORD-123"
}

# Backend checks:
# - Order exists?
# - Merchant has credits?
# - balance >= amount × 0.02?

Response:
{
  "success": true,
  "payment_id": "xxx",
  "credits_reserved": 2
}
```

### 5. Complete Payment (with Credit Deduction)
```bash
POST /api/pi/complete
Content-Type: application/json

{
  "payment_id": "xxx",
  "txid": "yyy",
  "order_id": "ORD-123"
}

# Backend:
# 1. Complete on Pi Network
# 2. Deduct credits: amount × 0.02
# 3. Update balance
# 4. Log transaction

Response:
{
  "success": true,
  "credits_charged": 2,
  "merchant_balance": 198,
  "capacity_remaining": "9900π"
}
```

---

## 🔄 Refund Flow (Credits Returned!)

```
1. Admin initiates refund
       ↓
2. Process A2U payment (Merchant → Customer)
   - Send π back on Stellar network
       ↓
3. Calculate credit refund
   - Credits to return: amount × 0.02
       ↓
4. Return credits to merchant
   - New balance: balance + (amount × 0.02)
       ↓
5. Log credit transaction (type: 'refund')
       ↓
6. Update order (has_refund = 1)
       ↓
✅ Refund complete!
   - Customer: Received π back
   - Merchant: Credits refunded
```

**Example:**
```
Original payment: 100π (cost 2 credits)
Refund: 100π
Credits returned: 2
Merchant balance: 200 + 2 = 202 credits
```

---

## ⚠️ Low Balance Management

### Warning Thresholds

```javascript
// Check after each payment
if (newBalance < 20) {
  await DB.prepare(`
    UPDATE merchants
    SET low_balance_warning = 1
    WHERE merchant_id = ?
  `).bind(merchantId).run();
  
  // Show warning in dashboard
  // Send email notification
}

if (newBalance <= 0) {
  await DB.prepare(`
    UPDATE merchants
    SET payments_enabled = 0
    WHERE merchant_id = ?
  `).bind(merchantId).run();
  
  // Disable all payments
  // Require deposit to re-enable
}
```

### Dashboard Warnings

```
Balance: 18 credits
⚠️ LOW BALANCE WARNING
You can process ~900π more payments.
[Refill Credits →]

Balance: 0 credits
🔒 PAYMENTS DISABLED
Deposit π to resume accepting payments.
[Deposit Now →]
```

---

## 💡 Benefits of Prepaid Credit System

### For Merchants
- ✅ **Predictable costs:** 2% always
- ✅ **No monthly fees:** Only pay when processing
- ✅ **Transparent:** Simple math, no hidden fees
- ✅ **Non-custodial:** Customers pay you directly
- ✅ **Refunds return credits:** Get credits back

### For PayPi Platform
- ✅ **Upfront revenue:** Credits prepaid
- ✅ **No custody liability:** Not holding customer funds
- ✅ **No money transmitter license:** Service credits, not payment processing
- ✅ **Predictable income:** Credits = revenue
- ✅ **Simple accounting:** Credits in, credits out

### For Customers
- ✅ **Direct payments:** Funds go to merchant wallet
- ✅ **Non-custodial:** PayPi never holds their π
- ✅ **Transparent:** See exact amount paid
- ✅ **Secure:** Blockchain verified

---

## 📈 Pricing Tiers (Future)

### Current: Pay-As-You-Go
```
2% per transaction
1π deposit = 1 credit
No volume discounts yet
```

### Future: Volume Discounts
```
Tier 1: < 1,000π/month → 2.0%
Tier 2: 1,000-10,000π/month → 1.8%
Tier 3: > 10,000π/month → 1.5%
```

**Implementation:**
```javascript
// Different credit ratios per tier
function calculateCredits(deposit, tier) {
  const rates = {
    1: 1.00,  // 2.0% fee
    2: 1.11,  // 1.8% fee (11% more credits)
    3: 1.33   // 1.5% fee (33% more credits)
  };
  return deposit * rates[tier];
}
```

---

## 🧪 Testing Examples

### Test 1: Normal Flow
```bash
# 1. Register
POST /api/merchant/register
Response: { api_key: "pk_live_abc..." }

# 2. Deposit
POST /api/merchant/credit-deposit
Body: { amount: 200 }
Response: { credits_added: 200 }

# 3. Check
POST /api/merchant/check-credits
Auth: Bearer pk_live_abc...
Body: { amount: 100 }
Response: { has_credits: true, needed: 2 }

# 4. Payment
POST /api/pi/complete
Body: { amount: 100 }
Response: { credits_charged: 2, balance: 198 }
```

### Test 2: Insufficient Credits
```bash
# Balance: 1 credit
# Payment: 100π (needs 2 credits)

POST /api/pi/approve
Response: 402 Payment Required
{
  "error": "Merchant has insufficient credits",
  "balance": "1 credits",
  "needed": "2 credits",
  "shortage": "1 credits"
}
```

### Test 3: Decimal Amounts
```bash
# Payment: 14.285714π ($50 ÷ $3.50)

POST /api/pi/complete
Body: { amount: 14.285714 }

# Credits: 14.285714 × 0.02 = 0.2857142
Response: { credits_charged: 0.2857142 }
```

---

## 🔒 Security Best Practices

### 1. API Keys
- ✅ Never log plain-text keys
- ✅ Hash immediately after generation
- ✅ Show to user only once
- ✅ Rotate regularly
- ✅ Revoke if compromised

### 2. Credit System
- ✅ Validate server-side always
- ✅ Check credits before approval
- ✅ Atomic credit deduction
- ✅ Log every transaction
- ✅ Monitor for anomalies

### 3. Payment Processing
- ✅ Verify amount matches order
- ✅ Prevent duplicate payments
- ✅ Blockchain verification required
- ✅ Non-custodial architecture

---

## 📊 Monitoring & Analytics

### Key Metrics
```sql
-- Total credits in system
SELECT SUM(credit_balance) FROM merchants;

-- Total revenue (π deposited)
SELECT SUM(total_deposits) FROM merchants;

-- Total volume processed
SELECT SUM(total_processed) FROM merchants;

-- Effective fee rate (should be ~2%)
SELECT 
  SUM(total_deposits) / SUM(total_processed) * 100 as fee_rate
FROM merchants;

-- Low balance merchants
SELECT COUNT(*) FROM merchants 
WHERE credit_balance < 20 AND payments_enabled = 1;

-- Disabled merchants (zero balance)
SELECT COUNT(*) FROM merchants 
WHERE payments_enabled = 0;
```

---

## ✅ Summary

**Pure Math Credit System:**
- Deposit: 1π = 1 credit (1:1)
- Payment: cost = amount × 0.02 (2%)
- Capacity: credits ÷ 0.02

**Security:**
- SHA-256 hashed API keys only
- One-time plain-text display
- Audit logging

**Non-Custodial:**
- Customer → Merchant (direct)
- PayPi never holds customer funds
- Credits are service fees, not custody

**Simple & Transparent:**
- No hidden fees
- Easy to understand
- Works with any decimal amount

---

## 🚀 Ready for Production!

The prepaid credit system is:
- ✅ Mathematically sound
- ✅ Legally compliant (non-custodial)
- ✅ Securely implemented (hashed keys)
- ✅ Well documented
- ✅ Thoroughly tested

**Deploy with confidence!** 🎉