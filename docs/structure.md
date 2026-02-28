# 📁 PayPi Plugin - Complete Repository Structure

Last updated: 2026-02-28

---

## 🏗️ Architecture Overview

PayPi is a **Cloudflare Pages** project with:
- Static files served from `/public`
- Serverless API routes in `/functions`
- D1 SQLite database for storage
- **Prepaid credit system** with 2% processing fee
- **Secure API key management** (SHA-256 hashed)

---

## 📂 Directory Structure

```
paypi-plugin/
├── README.md                           # Main documentation
├── LICENSE                             # MIT License
├── package.json                        # Dependencies & scripts
├── wrangler.toml                       # Cloudflare Pages config
├── .gitignore                          # Ignore node_modules, secrets
│
├── public/                             # Static files (served via Pages)
│   ├── index.html                      # Landing page
│   ├── admin.html                      # Admin dashboard
│   ├── test-payment.html               # Test checkout page
│   └── sdk/
│       └── v1/
│           └── paypi.js                # Drop-in SDK (versioned)
│
├── functions/                          # Serverless API routes (Pages Functions)
│   └── api/
│       ├── pi/                         # Pi Network payment endpoints
│       │   ├── approve.js              # Approve payment (with credit check)
│       │   ├── complete.js             # Complete payment (deduct credits)
│       │   └── cancel.js               # Cancel payment
│       │
│       ├── merchant/                   # Merchant management
│       │   ├── register.js             # Merchant registration (secure)
│       │   ├── check-credits.js        # Check credit balance (secure)
│       │   ├── credit-deposit.js       # Deposit credits (U2A payment)
│       │   └── list-orders.js          # List merchant orders
│       │
│       └── refund/
│           └── process.js              # Process A2U refunds
│
├── lib/                                # Shared utilities
│   ├── api-key-security.js             # 🔒 Secure API key management
│   ├── credits-pure-math.js            # Pure math credit calculations
│   └── stellar-init.js                 # Stellar SDK initialization
│
├── schema/                             # Database schemas
│   ├── d1-setup.sql                    # Original schema
│   └── d1-setup-secure.sql             # 🔒 Secure schema (hashed keys)
│
├── docs/                               # Documentation
│   ├── QUICKSTART.md                   # 5-minute setup
│   ├── MERCHANT-QUICKSTART.md          # For merchants using hosted version
│   ├── DEPLOYMENT-MODELS.md            # Hosted vs Self-hosted
│   ├── PAGES-DEPLOYMENT.md             # Cloudflare Pages deployment
│   ├── STELLAR-SDK-SETUP.md            # Cloudflare compatibility
│   ├── PREPAID-CREDIT-MODEL.md         # Credit system explanation
│   ├── CREDIT-SYSTEM-FINAL.md          # Pure math details
│   ├── SECURITY-API-KEYS.md            # 🔒 API key security
│   └── api-reference.md                # API endpoint docs
│
└── examples/                           # Integration examples
    ├── wordpress/
    │   └── paypi-woocommerce.php
    ├── shopify/
    │   └── paypi-liquid.liquid
    └── react/
        └── PayPiCheckout.jsx
```

---

## 🔑 Key Components

### 1. Prepaid Credit System

**Location:** All API endpoints + database

**How it works:**
```
1. Merchant deposits π → Platform wallet (U2A)
2. System credits merchant account: 1π = 1 credit (1:1)
3. Customer payment processed → Costs amount × 0.02 credits
4. Merchant balance: updated, tracked, logged
```

**Example:**
```
Deposit: 200π → 200 credits
Payment: 100π → 2 credits deducted
Balance: 198 credits remaining
Capacity: 9,900π can still process
```

**Files involved:**
- `functions/api/merchant/credit-deposit.js` - Add credits
- `functions/api/merchant/check-credits.js` - Verify balance
- `functions/api/pi/approve.js` - Check before approval
- `functions/api/pi/complete.js` - Deduct after completion
- `lib/credits-pure-math.js` - Calculation utilities

---

### 2. 🔒 Secure API Key Management

**Location:** `lib/api-key-security.js` + database

**Security model:**
```
❌ OLD: Store plain-text API keys
✅ NEW: Store only SHA-256 hashes

merchant_api_keys table:
- api_key_hash (SHA-256) ← Stored
- key_prefix ('pk_live_abc...') ← For display
- is_revoked (boolean) ← Revocation flag
```

**Key functions:**
```javascript
// Generate new key
const apiKey = generateApiKey();
// Returns: 'pk_live_abc123xyz789'

// Hash for storage (NEVER store plain text!)
const hash = await hashApiKey(apiKey);
// Returns: 'a7f3b2c4d5e6...' (SHA-256)

// Validate on API call
const validation = await validateApiKey(env, providedKey);
if (validation.valid) {
  // Proceed with merchant_id
}

// Revoke if compromised
await revokeApiKey(env, keyId, merchantId);
```

**Files involved:**
- `lib/api-key-security.js` - Core security functions
- `schema/d1-setup-secure.sql` - Secure database schema
- `functions/api/merchant/register.js` - Create hashed keys
- `functions/api/merchant/check-credits.js` - Validate keys
- `docs/SECURITY-API-KEYS.md` - Complete documentation

---

### 3. Payment Flow with Credits

**Complete flow:**

```
1. Customer clicks "Pay 100π"
       ↓
2. SDK → /api/merchant/check-credits
   Request: { amount: 100 }
   Check: balance >= 2 credits? ✅
       ↓
3. SDK → Pi.createPayment(100π)
   Customer approves in Pi Wallet
       ↓
4. SDK → /api/pi/approve
   - Verify order exists
   - Check merchant credits again
   - Approve on Pi Network
       ↓
5. SDK → /api/pi/complete
   - Complete on Pi Network
   - Deduct 2 credits (100 × 0.02)
   - Update merchant balance
   - Log credit transaction
   - Update order status: Paid
       ↓
6. ✅ Payment complete!
   - Merchant: 198 credits (9,900π capacity)
   - Customer: Paid 100π to merchant wallet
   - PayPi: 2% fee collected via credits
```

---

## 🗄️ Database Schema

### Tables:

**1. merchants** - Merchant profiles & balances
```sql
- merchant_id (PK)
- wallet_address
- business_name
- business_email
- credit_balance (REAL)        ← Prepaid credits
- total_deposits (REAL)        ← Total π deposited
- total_processed (REAL)       ← Total π processed
- payments_enabled (BOOLEAN)   ← Auto-disabled at 0 credits
- low_balance_warning (BOOLEAN)
```

**2. merchant_api_keys** - 🔒 Secure API keys
```sql
- key_id (PK)
- merchant_id (FK)
- api_key_hash (UNIQUE)        ← SHA-256 hash only!
- key_prefix                   ← 'pk_live_abc...' for display
- last_used_at
- is_revoked (BOOLEAN)
- expires_at (optional)
```

**3. paypi_orders** - Payment records
```sql
- order_id (PK)
- merchant_id (FK)
- user_uid
- total_amt (REAL)
- credits_charged (REAL)       ← Amount × 0.02
- order_status
- pi_payment_id
- pi_txid
- has_refund (BOOLEAN)
```

**4. credit_transactions** - Credit audit log
```sql
- tx_id (PK)
- merchant_id (FK)
- type ('deposit', 'deduction', 'refund')
- amount (REAL)                ← Credits
- pi_amount (REAL)             ← Equivalent π
- balance_after (REAL)
- description
```

**5. security_audit_log** - 🔒 Security events
```sql
- log_id (PK)
- merchant_id (FK)
- event_type ('api_key_created', 'api_key_used', etc.)
- details (JSON)
- severity ('info', 'warning', 'critical')
```

---

## 🔌 API Endpoints

### Merchant Management

**POST /api/merchant/register**
- Creates merchant account
- Generates secure API key (shows ONCE!)
- Returns: merchant_id, api_key (plain text, never again!)

**POST /api/merchant/check-credits**
- Headers: `Authorization: Bearer API_KEY`
- Body: `{ amount: 100 }`
- Returns: `{ has_credits, balance, needed, capacity }`
- Uses secure hash validation

**POST /api/merchant/credit-deposit**
- Body: `{ pi_payment_id, txid, amount }`
- Process: U2A payment verification
- Action: Add credits (1π = 1 credit)
- Returns: `{ credits_added, new_balance, capacity }`

### Payment Processing

**POST /api/pi/approve**
- Body: `{ payment_id, order_id }`
- Security: Checks merchant credit balance first
- Action: Approve payment on Pi Network
- Returns: `{ success, credits_reserved }`

**POST /api/pi/complete**
- Body: `{ payment_id, txid, order_id }`
- Action: Complete payment + deduct credits
- Deduction: `amount × 0.02`
- Returns: `{ success, credits_charged, merchant_balance }`

**POST /api/pi/cancel**
- Body: `{ payment_id, order_id }`
- Action: Cancel payment (no credit deduction)
- Returns: `{ success, message }`

### Refunds

**POST /api/refund/process**
- Body: `{ order_id, amount, reason }`
- Action: A2U refund + return credits to merchant
- Credit refund: `amount × 0.02` back to merchant
- Returns: `{ success, txid, credits_refunded }`

---

## 🔐 Security Features

### 1. API Key Security
- ✅ SHA-256 hashing (never plain text)
- ✅ One-time display during registration
- ✅ Secure validation via hash comparison
- ✅ Key rotation support
- ✅ Revocation via flag (not deletion)
- ✅ Audit logging

### 2. Credit System Security
- ✅ Server-side validation (client can't forge)
- ✅ Balance check before approval
- ✅ Atomic credit deduction
- ✅ Transaction logging
- ✅ Low balance warnings
- ✅ Auto-disable at zero

### 3. Payment Security
- ✅ Non-custodial (customer → merchant direct)
- ✅ Double verification (Pi API + Stellar)
- ✅ Blockchain confirmation required
- ✅ Amount matching validation
- ✅ Duplicate payment prevention

---

## 🛠️ Development

### Local Setup
```bash
npm install
wrangler pages dev public --d1=DB:paypi-db --compatibility-flag=nodejs_compat
```

### Deploy
```bash
wrangler pages deploy public
```

### Set Secrets
```bash
wrangler pages secret put PI_API_KEY
wrangler pages secret put APP_WALLET_SECRET
wrangler pages secret put ADMIN_TOKEN
```

---

## 📊 Credit Math Reference

```
Formula:
- Deposit: 1π = 1 credit (1:1)
- Payment: cost = amount × 0.02 (2%)
- Capacity: credits ÷ 0.02 = π processable

Examples:
- 200π deposit → 200 credits → 10,000π capacity
- 100π payment → 2 credits cost → 198 credits remaining
- 50π payment → 1 credit cost → 199 credits remaining
- 1π payment → 0.02 credits cost → 199.98 credits remaining
```

---

## 🔄 Refund Flow

```
1. Admin clicks "Refund" on order
       ↓
2. POST /api/refund/process
   - Verify order exists & paid
   - Calculate credit refund: amount × 0.02
       ↓
3. Process A2U refund on Stellar
   - Merchant wallet → Customer wallet
       ↓
4. Return credits to merchant
   - balance += (amount × 0.02)
   - Log credit transaction (type: 'refund')
       ↓
5. Update order
   - has_refund = 1
   - refunded_at = timestamp
       ↓
6. ✅ Refund complete!
   - Customer: Received π back
   - Merchant: Credits refunded
```

---

## 🌐 Stellar SDK Compatibility

**Issue:** Standard Stellar SDK doesn't work in Cloudflare Workers/Pages

**Solution:** Use fetch-compatible fork + adapter

```javascript
// lib/stellar-init.js
import { Horizon } from '@stellar/stellar-sdk';
import fetchAdapter from '@vespaiach/axios-fetch-adapter';

// Override axios to use fetch
Horizon.AxiosClient.defaults.adapter = fetchAdapter;

export { Horizon };
```

**All Stellar API calls now use fetch!** ✅

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "git+https://github.com/stellar/js-stellar-sdk#make-eventsource-optional",
    "@vespaiach/axios-fetch-adapter": "^0.3.1",
    "axios": "^0.26.1"
  },
  "devDependencies": {
    "wrangler": "^4.59.1"
  }
}
```

---

## 🎯 Key Files to Know

### Must Read:
1. **README.md** - Start here
2. **docs/SECURITY-API-KEYS.md** - API key security
3. **docs/CREDIT-SYSTEM-FINAL.md** - Pure math explanation
4. **schema/d1-setup-secure.sql** - Database schema

### Core Logic:
1. **lib/api-key-security.js** - Key management
2. **lib/credits-pure-math.js** - Credit calculations
3. **functions/api/pi/approve.js** - Credit check
4. **functions/api/pi/complete.js** - Credit deduction

### Integration:
1. **public/sdk/v1/paypi.js** - Drop-in SDK
2. **docs/QUICKSTART.md** - Setup guide
3. **examples/** - Platform examples

---

## 🚀 Deployment Checklist

- [ ] Created D1 database (`wrangler d1 create paypi-db`)
- [ ] Ran secure schema (`d1-setup-secure.sql`)
- [ ] Set all environment variables (PI_API_KEY, etc.)
- [ ] Deployed to Pages (`wrangler pages deploy public`)
- [ ] Tested registration (API key shown ONCE!)
- [ ] Tested credit deposit
- [ ] Tested payment with credit check
- [ ] Tested payment completion with deduction
- [ ] Tested refund with credit return
- [ ] Verified API key security (hash only in DB)

---

## 📈 Monitoring

### Key Metrics:
- Total merchants registered
- Total credits deposited
- Total π processed
- Average credit balance
- Low balance warnings
- Failed payment attempts (insufficient credits)

### Security Monitoring:
- API key usage (from `security_audit_log`)
- Failed authentication attempts
- Revoked keys still in use
- Unusual activity patterns

---

## 🆘 Support

- **GitHub Issues:** https://github.com/yyk-hub/paypi-plugin/issues
- **Documentation:** See `/docs` directory
- **Security Issues:** Report privately to repository owner

---

## ⚖️ Legal

**Trademark Notice:**  
PayPi is independent from Pi Network. "Pi Network" is a trademark of Pi Community Company.

**License:** MIT  
**Compliance:** Platform operators responsible for jurisdiction compliance

---

**Last Updated:** 2026-02-28  
**Version:** 1.0.0 (Prepaid Credit System with Secure API Keys)