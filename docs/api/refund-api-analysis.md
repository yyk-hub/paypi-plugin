# 🔄 Refund API Files - Analysis & Updates

## 📋 File Review Summary

### ✅ Files We HAVE (Core)

**1. process.js** - ✅ Already Created
- Process A2U refunds
- Return credits to merchant
- Update order status
- Log credit transaction

---

### ✅ Files We NEED (Admin Panel)

**2. list.js** - ✅ Created for PayPi
- List all refunds with pagination
- Filter by status, merchant
- Show credit return info
- Admin authentication required

**3. status.js** - ✅ Created for PayPi
- Get detailed refund status
- Show credit transaction details
- Merchant balance info
- Optional auth (can be public)

---

### ❌ Files We DON'T NEED

**4. cleanup.js** - ❌ Not Applicable
- **Purpose:** Clean up stuck A2U payments on Pi Platform
- **Why skip:** PayPi uses direct customer→merchant payments, not platform-managed A2U
- **PayPi model:** Customer pays merchant directly, no incomplete server payments

**5. create.js** - ❌ Not Needed (Initially)
- **Purpose:** Create refund from admin panel
- **Why skip:** `process.js` handles refund initiation
- **Future:** Could add if we want separate create→approve workflow

---

## 🎯 Final Refund API Structure

```
functions/api/refund/
├── process.js      ✅ Process refund + return credits
├── list.js         ✅ List all refunds (admin)
└── status.js       ✅ Get refund details (public/admin)
```

**3 files total** - Clean and simple!

---

## 📊 API Endpoint Comparison

### Old (Previous Project)
```
POST   /api/refund/create   → Create refund request
POST   /api/refund/process  → Process A2U payment
GET    /api/refund/list     → List refunds
GET    /api/refund/status   → Get refund status
POST   /api/refund/cleanup  → Clean stuck payments
```

### New (PayPi)
```
POST   /api/refund/process  → Process refund + return credits
GET    /api/refund/list     → List refunds
GET    /api/refund/status   → Get refund status
```

**Simpler!** Combined create→process into one step.

---

## 🔄 Refund Flow (PayPi)

```
┌─────────────────────────────────────────────┐
│  Admin clicks "Refund" on order             │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  POST /api/refund/process                   │
│  - Verify order exists & paid               │
│  - Calculate credit return: amount × 0.02   │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  Process A2U Refund (Stellar)               │
│  - Merchant wallet → Customer wallet        │
│  - Wait for blockchain confirmation         │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  Return Credits to Merchant                 │
│  - balance += (amount × 0.02)               │
│  - Log to credit_transactions               │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│  Update Order                               │
│  - has_refund = 1                           │
│  - refunded_at = timestamp                  │
└─────────────────┬───────────────────────────┘
                  ↓
                 ✅ Done!
```

**One API call does everything!**

---

## 📡 Updated API Documentation

### 1. Process Refund

```bash
POST /api/refund/process
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "order_id": "ORD-123",
  "amount": 100,
  "reason": "Customer requested refund"
}

Response:
{
  "success": true,
  "txid": "7a7ed20d...",
  "credits_refunded": 2.0,
  "merchant_balance": 202
}
```

### 2. List Refunds

```bash
GET /api/refund/list?status=completed&limit=50&offset=0
Authorization: Bearer ADMIN_TOKEN

Response:
{
  "success": true,
  "refunds": [
    {
      "order_id": "ORD-123",
      "merchant_name": "My Store",
      "amount_pi": 100,
      "credits_returned": 2,
      "refunded_at": 1234567890
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### 3. Get Refund Status

```bash
GET /api/refund/status?order_id=ORD-123

Response:
{
  "success": true,
  "refund": {
    "order_id": "ORD-123",
    "amount_pi": 100,
    "credits_returned": 2,
    "merchant_current_balance": 202,
    "refunded_at": 1234567890,
    "credit_refund": {
      "tx_id": "TXN_123",
      "balance_after_refund": 202
    }
  }
}
```

---

## 🗄️ Database Changes

### PayPi Simplified Schema

**No `refunds` table needed!** Track in `paypi_orders`:

```sql
CREATE TABLE paypi_orders (
  order_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  total_amt REAL NOT NULL,
  credits_charged REAL NOT NULL,
  
  -- Refund tracking
  has_refund BOOLEAN DEFAULT 0,     ← Simple flag
  refunded_at INTEGER,               ← Timestamp
  
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);
```

**Credit return logged in:**
```sql
CREATE TABLE credit_transactions (
  tx_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('deposit', 'deduction', 'refund')),
  amount REAL NOT NULL,
  pi_amount REAL,
  balance_after REAL NOT NULL,
  description TEXT,
  created_at INTEGER
);
```

---

## 🆚 Key Differences from Previous Project

| Aspect | Previous Project | PayPi |
|--------|------------------|-------|
| **Refund Table** | Separate `refunds` table | Flag in `paypi_orders` |
| **Payment Model** | Platform A2U payments | Direct merchant A2U |
| **Credit Return** | N/A | Automatic via `credit_transactions` |
| **Cleanup** | Needed for stuck payments | Not needed |
| **Create Step** | Separate create→process | Combined in one call |
| **Complexity** | 5 files, separate table | 3 files, simpler |

---

## ✅ Benefits of PayPi Approach

### Simpler Architecture
- ✅ No separate refunds table
- ✅ Fewer API endpoints
- ✅ One-step refund process
- ✅ Automatic credit return

### Better Tracking
- ✅ Credits logged in `credit_transactions`
- ✅ Order history shows refund flag
- ✅ Merchant balance always accurate

### No Cleanup Needed
- ✅ No stuck payments (merchant handles A2U)
- ✅ No incomplete server payments
- ✅ Direct blockchain transactions

---

## 🧪 Testing Examples

### Test 1: Process Refund
```bash
# Original order
Order: ORD-123
Amount: 100π
Credits charged: 2
Merchant balance: 200 credits

# Process refund
POST /api/refund/process
Body: { order_id: "ORD-123", amount: 100 }

# Expected result
✅ Refund processed
✅ Credits returned: 2
✅ Merchant balance: 202 credits
✅ Order marked: has_refund = 1
```

### Test 2: List Refunds
```bash
GET /api/refund/list?status=all

# Returns
[
  {
    order_id: "ORD-123",
    amount_pi: 100,
    credits_returned: 2,
    refunded_at: 1234567890
  },
  ...
]
```

### Test 3: Check Status
```bash
GET /api/refund/status?order_id=ORD-123

# Returns
{
  order_id: "ORD-123",
  amount_pi: 100,
  credits_returned: 2,
  merchant_current_balance: 202,
  credit_refund: {
    tx_id: "TXN_123",
    balance_after_refund: 202
  }
}
```

---

## 📋 Admin Dashboard Integration

```html
<!-- List Refunds -->
<div id="refunds-list">
  <h3>Recent Refunds</h3>
  <table>
    <tr>
      <th>Order ID</th>
      <th>Merchant</th>
      <th>Amount</th>
      <th>Credits Returned</th>
      <th>Date</th>
    </tr>
    <!-- Populated via GET /api/refund/list -->
  </table>
</div>

<!-- Refund Button on Order -->
<button onclick="processRefund('ORD-123')">
  Refund Order
</button>

<script>
async function processRefund(orderId) {
  const response = await fetch('/api/refund/process', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order_id: orderId,
      amount: 100,
      reason: 'Customer request'
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    alert(`Refund processed! Credits returned: ${result.credits_refunded}`);
  }
}
</script>
```

---

## ✅ Summary

**Files Created:**
1. ✅ `process.js` - Process refund + return credits
2. ✅ `list.js` - List refunds for admin
3. ✅ `status.js` - Get refund details

**Files Skipped:**
1. ❌ `cleanup.js` - Not needed (no stuck payments)
2. ❌ `create.js` - Not needed (combined with process)

**Result:**
- Simpler API (3 files instead of 5)
- One-step refund process
- Automatic credit return
- No cleanup required

**Admin panel is ready with refund management!** 🎉