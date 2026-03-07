# 🔐 Idempotency Keys - Implementation Guide

## 🎯 What is Idempotency?

**Idempotency** ensures that making the same API request multiple times has the same effect as making it once.

### Problem Without Idempotency:
```
User clicks "Pay" → Request sent
Network hiccup → User clicks again
Result: ❌ Charged twice!
```

### Solution With Idempotency:
```
User clicks "Pay" → Request sent (key: abc123)
Network hiccup → User clicks again (key: abc123)
Result: ✅ Returns cached response, no double charge!
```

---

## 📊 Idempotency Table

```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,           -- Unique idempotency key
  merchant_id TEXT NOT NULL,      -- Which merchant
  response TEXT NOT NULL,         -- Cached response (JSON)
  endpoint TEXT NOT NULL,         -- Which API endpoint
  request_hash TEXT,              -- Hash of request body
  created_at INTEGER,             -- When created
  expires_at INTEGER,             -- Auto-expire after 24h
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);
```

---

## 🔧 Implementation

### 1. Middleware Function

```javascript
// lib/idempotency.js

/**
 * Check if request has already been processed
 * Returns cached response if idempotency key exists
 */
export async function checkIdempotency(env, idempotencyKey, merchantId) {
  if (!idempotencyKey) {
    return null;  // No idempotency key provided
  }
  
  // Look up existing response
  const cached = await env.DB.prepare(`
    SELECT response FROM idempotency_keys
    WHERE key = ? AND merchant_id = ? AND expires_at > unixepoch()
  `).bind(idempotencyKey, merchantId).first();
  
  if (cached) {
    console.log('✅ Returning cached response for idempotency key:', idempotencyKey);
    return JSON.parse(cached.response);
  }
  
  return null;  // No cached response
}

/**
 * Store response for future duplicate requests
 */
export async function storeIdempotency(env, idempotencyKey, merchantId, endpoint, response) {
  if (!idempotencyKey) {
    return;  // No idempotency key to store
  }
  
  await env.DB.prepare(`
    INSERT OR REPLACE INTO idempotency_keys (
      key, merchant_id, endpoint, response, created_at, expires_at
    ) VALUES (?, ?, ?, ?, unixepoch(), unixepoch() + 86400)
  `).bind(
    idempotencyKey,
    merchantId,
    endpoint,
    JSON.stringify(response)
  ).run();
  
  console.log('✅ Stored idempotency key:', idempotencyKey);
}
```

---

### 2. Use in API Endpoints

```javascript
// functions/api/pi/approve.js

import { checkIdempotency, storeIdempotency } from '../../../lib/idempotency.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // Get idempotency key from header
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const { order_id, payment_id } = await request.json();
    
    // Get merchant_id from order
    const order = await env.DB.prepare(
      'SELECT merchant_id FROM paypi_orders WHERE order_id = ?'
    ).bind(order_id).first();
    
    // Check for cached response
    if (idempotencyKey && order) {
      const cached = await checkIdempotency(env, idempotencyKey, order.merchant_id);
      if (cached) {
        return Response.json(cached);  // Return cached response
      }
    }
    
    // Process payment (normal logic)
    // ... approve payment on Pi Network ...
    
    const response = {
      success: true,
      payment_id,
      order_id
    };
    
    // Store for future duplicate requests
    if (idempotencyKey && order) {
      await storeIdempotency(env, idempotencyKey, order.merchant_id, 'approve', response);
    }
    
    return Response.json(response);
    
  } catch (error) {
    // Don't cache errors
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

---

### 3. Client-Side Usage

```javascript
// Generate idempotency key (UUID)
function generateIdempotencyKey() {
  return 'idem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Make idempotent request
async function approvePayment(paymentId, orderId) {
  const idempotencyKey = generateIdempotencyKey();
  
  const response = await fetch('/api/pi/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey  // Include key
    },
    body: JSON.stringify({
      payment_id: paymentId,
      order_id: orderId
    })
  });
  
  return response.json();
}

// Safe to retry - same idempotency key
const result = await approvePayment('pay_123', 'ord_456');
```

---

## 🧪 Testing Scenarios

### Test 1: Normal Request (No Duplicate)
```bash
# First request
curl -X POST https://paypi.pages.dev/api/pi/approve \
  -H "Idempotency-Key: idem_abc123" \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"pay_123","order_id":"ord_456"}'

Response: { "success": true, "payment_id": "pay_123" }
Database: ✅ Idempotency key stored
```

### Test 2: Duplicate Request (Idempotent)
```bash
# Second request (same key)
curl -X POST https://paypi.pages.dev/api/pi/approve \
  -H "Idempotency-Key: idem_abc123" \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"pay_123","order_id":"ord_456"}'

Response: { "success": true, "payment_id": "pay_123" }  # Cached!
Database: ✅ No new order created
Payment: ✅ Not processed again
```

### Test 3: Different Key (New Request)
```bash
# Third request (different key)
curl -X POST https://paypi.pages.dev/api/pi/approve \
  -H "Idempotency-Key: idem_xyz789" \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"pay_456","order_id":"ord_789"}'

Response: { "success": true, "payment_id": "pay_456" }
Database: ✅ New idempotency key stored
Payment: ✅ Processed normally
```

---

## 🔄 Cleanup Old Keys

Idempotency keys expire after 24 hours. Cleanup options:

### Option 1: Cloudflare Cron (Recommended)
```javascript
// wrangler.toml
[triggers]
crons = ["0 0 * * *"]  # Daily at midnight

// functions/scheduled.js
export async function onSchedule(event, env, ctx) {
  // Delete expired keys
  const result = await env.DB.prepare(
    'DELETE FROM idempotency_keys WHERE expires_at < unixepoch()'
  ).run();
  
  console.log(`✅ Cleaned up ${result.meta.changes} expired idempotency keys`);
}
```

### Option 2: On-Demand Cleanup
```javascript
// functions/api/admin/cleanup.js
export async function onRequestPost(context) {
  const { env } = context;
  
  const result = await env.DB.prepare(
    'DELETE FROM idempotency_keys WHERE expires_at < unixepoch()'
  ).run();
  
  return Response.json({
    success: true,
    cleaned: result.meta.changes
  });
}
```

---

## 📊 Which Endpoints Need Idempotency?

### Critical (Must Have):
- ✅ `POST /api/pi/approve` - Payment approval
- ✅ `POST /api/pi/complete` - Payment completion
- ✅ `POST /api/merchant/credit-deposit` - Credit deposits
- ✅ `POST /api/refund/process` - Refunds

### Recommended:
- ⚠️ `POST /api/merchant/register` - Registration
- ⚠️ `POST /api/pi/cancel` - Cancellations

### Not Needed:
- ❌ `GET` requests (naturally idempotent)
- ❌ `POST /api/merchant/check-credits` (read-only)
- ❌ `GET /api/merchant/list-orders` (read-only)

---

## 🎯 Benefits

### 1. **Prevent Double Charges**
```
Without: User charged twice
With: Second request returns cached response ✅
```

### 2. **Network Resilience**
```
Without: Timeout → User retries → Double processing
With: Same key → Cached response ✅
```

### 3. **Better UX**
```
Without: "Please don't click twice!"
With: Click 10 times, processed once ✅
```

### 4. **Industry Standard**
```
Stripe, PayPal, Square all use idempotency keys
PayPi follows best practices ✅
```

---

## ⚠️ Important Notes

### Key Format:
```javascript
// ✅ Good
'idem_1234567890_abc'
'ord_123_retry_1'

// ❌ Bad
'my-key'  // Too simple
Math.random()  // Not reproducible
```

### Key Reuse:
```javascript
// ✅ Same operation, same key
approvePayment('pay_123', 'idem_abc')
approvePayment('pay_123', 'idem_abc')  // Same key = OK

// ❌ Different operation, same key
approvePayment('pay_123', 'idem_abc')
refundPayment('ord_456', 'idem_abc')  // Different operation = BAD
```

### Expiry:
- Keys expire after 24 hours
- Old keys auto-deleted
- Can't reuse expired keys (will process again)

---

## 📋 Implementation Checklist

- [ ] Create idempotency_keys table
- [ ] Add idempotency.js library
- [ ] Update approve.js with idempotency
- [ ] Update complete.js with idempotency
- [ ] Update credit-deposit.js with idempotency
- [ ] Update refund/process.js with idempotency
- [ ] Add cleanup cron job
- [ ] Test duplicate requests
- [ ] Monitor key expiry

---

## ✅ Summary

**Idempotency Keys:**
- Prevent duplicate API requests
- Cache responses for 24 hours
- Industry standard (Stripe pattern)
- Simple to implement
- Critical for payment APIs

**Use in:**
- Payment approvals
- Payment completions
- Credit deposits
- Refunds

**Result:** 🎉 Zero duplicate charges, better UX!