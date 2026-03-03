# ✅ Pi API Files - Updated for PayPi Credit System

All 3 Pi payment API endpoints updated to work with prepaid credit system.

---

## 🎯 Key Changes:

### 1️⃣ **approve.js** - Credit Check BEFORE Approval

**Added:**
- Check merchant credit balance before approving
- Verify merchant has sufficient credits (amount × 0.02)
- Return 402 error if insufficient credits
- Prevent payment if merchant balance too low

**Flow:**
```
1. Verify order exists
2. Get merchant from order.merchant_id
3. Calculate credits needed: amount × 0.02
4. Check: balance >= needed?
   - NO → Return 402 error (Payment Required)
   - YES → Continue
5. Approve payment on Pi Network
6. Save payment_id
```

**New Error Responses:**
```javascript
// Insufficient credits
{
  "success": false,
  "error": "Merchant has insufficient credits",
  "balance": "15 credits",
  "needed": "20 credits",
  "shortage": "5 credits"
}

// Payments disabled
{
  "success": false,
  "error": "Merchant payments disabled. Please deposit credits."
}
```

---

### 2️⃣ **complete.js** - Deduct Credits AFTER Completion

**Added:**
- Calculate credit cost: amount × 0.02
- Deduct credits from merchant balance
- Update merchant.total_processed
- Set low_balance_warning if < 20 credits
- Disable payments if balance <= 0
- Log credit transaction
- Save credits_charged to order

**Flow:**
```
1. Verify payment with Pi Network
2. Complete payment on Pi Network
3. Calculate credit cost: amount × 0.02
4. Deduct credits from merchant
5. Update merchant stats
6. Log credit transaction
7. Update order with credits_charged
```

**Credit Deduction:**
```javascript
const creditCost = order.total_amt * 0.02;
const newBalance = merchant.credit_balance - creditCost;

// Update merchant
UPDATE merchants SET
  credit_balance = newBalance,
  total_processed = total_processed + amount,
  low_balance_warning = (newBalance < 20),
  payments_enabled = (newBalance > 0)
```

**New Response Fields:**
```javascript
{
  "success": true,
  "credits_charged": 2.0,
  "merchant_balance": 198,
  "capacity_remaining": "9900π"
}
```

---

### 3️⃣ **cancel.js** - Updated Table Name

**Changed:**
- Table: `ceo_orders` → `paypi_orders`
- No credit deduction (payment not completed)

**Flow:**
```
1. Find order by payment_id
2. Check if already cancelled/paid
3. Update status to 'Cancelled'
4. Clear pi_payment_id and pi_txid
5. No credits charged
```

---

## 📊 Database Changes:

### paypi_orders Table (Updated)
```sql
-- Added field
credits_charged REAL NOT NULL  -- Amount × 0.02

-- Example
INSERT INTO paypi_orders (
  order_id,
  merchant_id,
  total_amt,
  credits_charged  -- NEW
) VALUES (
  'ORD-123',
  'merch_abc',
  100,
  2.0  -- 100 × 0.02
);
```

### merchants Table (Updates)
```sql
UPDATE merchants SET
  credit_balance = credit_balance - 2.0,     -- Deduct
  total_processed = total_processed + 100,   -- Track volume
  low_balance_warning = 1,                   -- If < 20
  payments_enabled = 1                       -- If > 0
WHERE merchant_id = 'merch_abc';
```

### credit_transactions Table (New Entries)
```sql
INSERT INTO credit_transactions (
  tx_id,
  merchant_id,
  type,
  amount,
  pi_amount,
  balance_after,
  description
) VALUES (
  'TXN_1234567890',
  'merch_abc',
  'deduction',
  2.0,          -- Credits
  100,          -- Pi amount
  198,          -- Balance after
  'Payment ORD-123'
);
```

---

## 🧪 Testing Scenarios:

### Test 1: Normal Payment (Sufficient Credits)
```bash
# Setup
Merchant balance: 200 credits
Payment amount: 100π
Credits needed: 100 × 0.02 = 2

# Expected Flow
1. approve.js: Check credits → ✅ Has 200, needs 2
2. approve.js: Approve on Pi → ✅
3. complete.js: Deduct 2 credits → ✅
4. complete.js: New balance: 198 → ✅

# Result
Order: Paid
Merchant balance: 198 credits
Capacity: 9,900π
```

### Test 2: Insufficient Credits
```bash
# Setup
Merchant balance: 1 credit
Payment amount: 100π
Credits needed: 2

# Expected Flow
1. approve.js: Check credits → ❌ Has 1, needs 2
2. approve.js: Return 402 error → STOP

# Result
{
  "error": "Merchant has insufficient credits",
  "balance": "1 credits",
  "needed": "2 credits",
  "shortage": "1 credits"
}
```

### Test 3: Payment Cancelled
```bash
# Setup
Order status: Pending
Payment initiated but user cancelled

# Expected Flow
1. cancel.js: Find order → ✅
2. cancel.js: Check if paid → ❌ (still pending)
3. cancel.js: Update to Cancelled → ✅
4. cancel.js: No credits deducted → ✅

# Result
Order: Cancelled
Merchant balance: Unchanged
```

### Test 4: Low Balance Warning
```bash
# Setup
Merchant balance: 25 credits
Payment amount: 250π
Credits needed: 5

# Expected Flow
1. approve.js: Check credits → ✅ Has 25, needs 5
2. complete.js: Deduct 5 → New balance: 20
3. complete.js: Set low_balance_warning = 1 → ✅

# Result
Merchant balance: 20 credits (warning triggered)
Admin dashboard shows: "⚠️ Low balance"
```

### Test 5: Zero Balance (Payments Disabled)
```bash
# Setup
Merchant balance: 2 credits
Payment amount: 100π
Credits needed: 2

# Expected Flow
1. approve.js: Check credits → ✅ Has 2, needs 2
2. complete.js: Deduct 2 → New balance: 0
3. complete.js: Set payments_enabled = 0 → ✅

# Result
Merchant balance: 0 credits
Payments disabled
Next payment attempt: 402 error
```

---

## 🔄 Complete Payment Flow:

```
┌─────────────────────────────────────────────┐
│  1. SDK calls /api/pi/approve               │
│     - Checks merchant credits               │
│     - Verifies: balance >= amount × 0.02    │
└─────────────────┬───────────────────────────┘
                  ↓
          Sufficient credits?
          ├─ NO → 402 Error, STOP
          └─ YES → Continue
                  ↓
┌─────────────────────────────────────────────┐
│  2. Approve on Pi Network                   │
│     - Pi API: /payments/{id}/approve        │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  3. SDK calls /api/pi/complete              │
│     - Verify payment with Pi                │
│     - Complete on Pi Network                │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  4. Deduct Credits                          │
│     - Calculate: amount × 0.02              │
│     - Update: balance = balance - cost      │
│     - Check: low balance? disable?          │
│     - Log: credit_transactions              │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  5. Update Order                            │
│     - Status: Paid                          │
│     - Save: pi_txid, user_uid               │
│     - Save: credits_charged                 │
└─────────────────────────────────────────────┘
                  ↓
                 ✅ DONE
```

---

## ✅ Files Updated:

1. ✅ **approve.js** - Credit check before approval
2. ✅ **complete.js** - Credit deduction after completion
3. ✅ **cancel.js** - Table name updated, no credit changes

---

## 🚀 Ready to Deploy!

All Pi payment endpoints now:
- ✅ Check credits before approval
- ✅ Deduct credits after completion
- ✅ Update merchant balance
- ✅ Log all transactions
- ✅ Handle low balance warnings
- ✅ Disable payments at zero
- ✅ Use correct table names

**Payment flow is complete and credit-aware!** 🎉