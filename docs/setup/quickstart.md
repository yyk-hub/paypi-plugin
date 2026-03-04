# 🚀 PayPi Plugin - Quickstart Guide

Get Pi payments running on your website in 5 minutes using the **Prepaid Credit System**.

---

## 🎯 What is PayPi?

PayPi is a non-custodial payment gateway for Pi Network with:
- **Prepaid credit system** - Deposit π, get credits, process payments
- **Pure math (2% fee)** - 1π deposit = 1 credit, payment costs amount × 0.02
- **Direct payments** - Customer funds go straight to your wallet
- **Works with decimals** - Perfect for fiat-to-Pi conversions
- **Cloudflare Pages** - Serverless with global CDN
- **Secure API keys** - SHA-256 hashed, never plain text

---

## 💰 Understanding the Credit System (Pure Math)

### Simple Formula:
```
Deposit:  1π = 1 credit (exact 1:1 ratio)
Payment:  cost = amount × 0.02 (2% fee)
Capacity: credits ÷ 0.02 = π you can process
```

### Example:
```
You deposit: 200π
You get: 200 credits (1:1)
You can process: 200 ÷ 0.02 = 10,000π worth of payments

Customer pays: 100π
Credit cost: 100 × 0.02 = 2 credits
Your balance: 200 - 2 = 198 credits
Remaining capacity: 198 ÷ 0.02 = 9,900π

Fee verification: 200π / 10,000π × 100 = 2% ✅
```

---

## 📋 Prerequisites

- Pi Network developer account ([sign up](https://develop.pi))
- Cloudflare account (free tier works)
- Your website (any platform)
- GitHub account (for Pages deployment)

---

## 🚀 Step 1: Deploy to Cloudflare Pages

### Option A: GitHub → Pages (Recommended)
```bash
1. Fork/clone repository:
   https://github.com/yyk-hub/paypi-plugin

2. Connect to Cloudflare Pages:
   - Go to Cloudflare Dashboard → Pages
   - Click "Create a project"
   - Connect your GitHub account
   - Select paypi-plugin repository

3. Build settings:
   Framework preset: None
   Build command: npm install
   Build output directory: public
   Root directory: (leave empty)

4. Deploy!
```

### Option B: Wrangler CLI
```bash
# Clone repository
git clone https://github.com/yyk-hub/paypi-plugin
cd paypi-plugin

# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Deploy to Pages
npx wrangler pages deploy public --project-name=paypi
```

**Your Pages URL:** `https://paypi.pages.dev`

---

## 🗄️ Step 2: Create D1 Database

```bash
# Create database
npx wrangler d1 create paypi-db

# Output will show:
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Copy the database_id and update wrangler.toml:
[[d1_databases]]
binding = "DB"
database_name = "paypi-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← Paste here
```

### Initialize Database Schema (Secure)

```bash
# Use the SECURE schema (with hashed API keys)
npx wrangler d1 execute paypi-db --file=./schema/d1-setup-secure.sql
```

**This creates:**
- `merchants` table (profiles, credit balances)
- `merchant_api_keys` table (🔒 hashed keys only!)
- `paypi_orders` table (payment records)
- `credit_transactions` table (credit audit log)
- `security_audit_log` table (security events)

**Note:** Table name is `paypi_orders` (not `ceo_orders`)

---

## 🔐 Step 3: Set Environment Variables

### Via Cloudflare Dashboard:
1. Go to Pages → Settings → Environment variables
2. Add these variables:

```
PI_API_KEY = your_pi_api_key_here
APP_WALLET_SECRET = your_stellar_secret_key_here
ADMIN_TOKEN = your_secure_admin_password_here
```

### Via Wrangler CLI:
```bash
# Set your Pi API key
npx wrangler pages secret put PI_API_KEY
# Enter your key from https://develop.pi

# Set your app wallet secret
npx wrangler pages secret put APP_WALLET_SECRET
# Enter your Stellar secret key (starts with S)

# Set admin dashboard password
npx wrangler pages secret put ADMIN_TOKEN
# Create a secure password (e.g., "MySecure123!")
```

---

## 💳 Step 4: Register as Merchant (Secure API Key)

### Option A: Via API
```bash
curl -X POST https://paypi.pages.dev/api/merchant/register \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "My Store",
    "business_email": "hello@mystore.com",
    "wallet_address": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  }'
```

**Response:**
```json
{
  "success": true,
  "merchant_id": "merch_123",
  "api_key": "pk_live_abc123xyz789",  
  "key_prefix": "pk_live_abc...",
  "credit_balance": 0,
  "credit_system": {
    "formula": "1π deposit = 1 credit",
    "fee": "2% per transaction (amount × 0.02 credits)",
    "example": "Deposit 200π → Process 10,000π worth of payments"
  },
  "warning": "⚠️ SAVE YOUR API KEY NOW! It will never be shown again."
}
```

### Option B: Via Admin Dashboard
1. Go to `https://paypi.pages.dev/admin.html`
2. Click "Register as New Merchant"
3. Fill in details
4. **⚠️ SAVE YOUR API KEY!** (shown ONCE only, never again)

**Security Note:** API keys are SHA-256 hashed in database. Plain text is never stored!

---

## 💰 Step 5: Deposit Credits (Pure Math: 1π = 1 credit)

### Via Admin Dashboard:
1. Go to `https://paypi.pages.dev/admin.html`
2. Login with your ADMIN_TOKEN
3. Click "Refill Credits"
4. Choose amount (e.g., 200π)
5. Pay via Pi Network (U2A payment)
6. Credits added instantly (1:1 ratio)

**After deposit:**
```
Deposited: 200π
Credits: 200 (1:1 ratio)
Capacity: 200 ÷ 0.02 = 10,000π can process
Fee rate: 2%
Status: ✅ Payments enabled
```

---

## 🌐 Step 6: Add to Your Website (Versioned SDK)

### HTML Sites:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Checkout</title>
</head>
<body>
  <h1>Checkout</h1>
  
  <!-- Product info -->
  <p>Premium Plan: 10π</p>
  
  <!-- Add Pi SDK -->
  <script src="https://sdk.minepi.com/pi-sdk.js"></script>
  
  <!-- Add PayPi SDK (VERSIONED!) -->
  <script src="https://paypi.pages.dev/sdk/v1/paypi.js"></script>
  
  <!-- Payment button appears here automatically -->
  <div data-paypi-amount="10" 
       data-paypi-order="ORD-12345"
       data-paypi-description="Premium Plan"
       data-paypi-success="/thank-you">
  </div>
  
</body>
</html>
```

**Note:** SDK is versioned (`/sdk/v1/paypi.js`). Future v2 won't break your integration!

### WordPress/WooCommerce:

```php
// Add to functions.php
add_action('woocommerce_after_checkout_form', function() {
  ?>
  <script src="https://sdk.minepi.com/pi-sdk.js"></script>
  <script src="https://paypi.pages.dev/sdk/v1/paypi.js"></script>
  
  <div data-paypi-amount="<?php echo WC()->cart->total; ?>"
       data-paypi-order="<?php echo uniqid('WC-'); ?>"
       data-paypi-description="Order from <?php bloginfo('name'); ?>">
  </div>
  <?php
});
```

### React:

```jsx
import { useEffect } from 'react';

function Checkout({ amount, orderId }) {
  useEffect(() => {
    // Load Pi SDK
    const piScript = document.createElement('script');
    piScript.src = 'https://sdk.minepi.com/pi-sdk.js';
    document.head.appendChild(piScript);
    
    // Load PayPi SDK (versioned)
    const paypiScript = document.createElement('script');
    paypiScript.src = 'https://paypi.pages.dev/sdk/v1/paypi.js';
    document.head.appendChild(paypiScript);
  }, []);
  
  return (
    <div 
      data-paypi-amount={amount}
      data-paypi-order={orderId}
      data-paypi-description="Premium Plan"
    />
  );
}
```

---

## 🧪 Step 7: Test Payment

1. **Open test page in Pi Browser:**
   ```
   https://paypi.pages.dev/test-payment.html
   ```

2. **Click "Pay with Pi" button**

3. **SDK checks merchant credits (amount × 0.02)**

4. **Complete payment in Pi Wallet**

5. **Check your admin dashboard:**
   - Credits deducted: 100π payment = 2 credits
   - New balance: 198 credits
   - Capacity: 9,900π remaining
   - Order appears in list

---

## ✅ Step 8: Verify Everything Works

### Check Credits:
```bash
# Via dashboard
https://paypi.pages.dev/admin.html

# Via API (using hashed key validation)
curl -X POST https://paypi.pages.dev/api/merchant/check-credits \
  -H "Authorization: Bearer pk_live_abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}'
```

**Expected response:**
```json
{
  "has_credits": true,
  "balance": "198 credits",
  "needed": "2 credits",
  "payment_amount": "100π",
  "capacity": "9900π",
  "fee_rate": "2%"
}
```

### Check Orders:
```bash
# View all orders
https://paypi.pages.dev/admin.html

# Via API
curl -X GET https://paypi.pages.dev/api/merchant/list-orders \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## 💡 Understanding Pure Math Credit Deductions

### Real Examples:

**Example 1: Whole Number**
```
Payment: 100π
Cost: 100 × 0.02 = 2 credits
Balance: 200 - 2 = 198 credits
```

**Example 2: Decimal (from fiat)**
```
Product: $50 USD
Exchange: 1π = $3.50
Amount: 50 ÷ 3.50 = 14.285714π
Cost: 14.285714 × 0.02 = 0.2857142 credits
Balance: 200 - 0.2857142 = 199.7142858 credits
```

**Example 3: Small Amount**
```
Payment: 1π
Cost: 1 × 0.02 = 0.02 credits
Balance: 200 - 0.02 = 199.98 credits
```

**Verification:**
```
200π deposit allows 10,000π processing
10,000π × 2% = 200π fee collected
Math checks out! ✅
```

---

## 🔄 Managing Credits

### Check Balance:
- **Dashboard:** Real-time balance display
- **API:** `GET /api/merchant/list-orders` (shows balance)
- **Per-payment:** `POST /api/merchant/check-credits`

### Low Balance Warnings:
- **< 20 credits:** ⚠️ Yellow warning (< 1,000π capacity)
- **< 10 credits:** 🔴 Red urgent warning (< 500π capacity)
- **0 credits:** 🔒 Payments automatically disabled

### Refill Credits:
1. Click "Refill" in dashboard
2. Choose amount (e.g., 100π)
3. Pay via Pi Network (U2A)
4. Credits added instantly (100π = 100 credits)
5. Capacity increases (100 credits = 5,000π more capacity)

---

## 🎯 What's Next?

### Production Checklist:
- [ ] Test payments working
- [ ] Credits deducting correctly (amount × 0.02)
- [ ] Refunds working (optional, returns credits)
- [ ] Dashboard accessible
- [ ] API keys hashed (never plain text in DB)
- [ ] Switch to mainnet:
  ```bash
  # Update wrangler.toml:
  PI_NETWORK = "mainnet"
  
  # Update secrets with mainnet keys
  npx wrangler pages secret put PI_API_KEY
  npx wrangler pages secret put APP_WALLET_SECRET
  
  # Redeploy
  npx wrangler pages deploy public
  ```

### Customization:
- Style the payment button (see docs/customization.md)
- Set up webhooks
- Add custom success page
- Configure email notifications

### Support:
- Documentation: https://github.com/yyk-hub/paypi-plugin
- Issues: https://github.com/yyk-hub/paypi-plugin/issues

---

## 🐛 Troubleshooting

### "Insufficient credits" error
**Problem:** Not enough credits for payment  
**Calculation:** Need amount × 0.02 credits  
**Solution:** Deposit more π (1π = 1 credit)

### Payment button doesn't appear
**Problem:** SDK not loading  
**Solution:** Check console, verify both scripts load  
**URL:** Should be `/sdk/v1/paypi.js` (versioned!)

### "Pi Browser required" error
**Problem:** Testing in Chrome/Safari  
**Solution:** Open in Pi Browser app

### Credits not deducting
**Problem:** complete.js not running  
**Solution:** Check Pages logs in Cloudflare dashboard

### "Invalid API key" error
**Problem:** Wrong key or not hashed correctly  
**Solution:** API keys are hashed (SHA-256). Use exact key from registration.

---

## 📊 Pure Math Quick Reference

| Deposit | Credits (1:1) | Capacity (÷ 0.02) | Example Payment | Cost (× 0.02) |
|---------|---------------|-------------------|-----------------|---------------|
| 50π | 50 | 2,500π | 25π | 0.5 credits |
| 100π | 100 | 5,000π | 50π | 1 credit |
| 200π | 200 | 10,000π | 100π | 2 credits |
| 500π | 500 | 25,000π | 250π | 5 credits |
| 1,000π | 1,000 | 50,000π | 500π | 10 credits |

**Formula verification:**
- Deposit → Credits: `credits = deposit` (1:1)
- Credits → Capacity: `capacity = credits ÷ 0.02`
- Payment → Cost: `cost = amount × 0.02`
- Fee rate: Always exactly 2%

---

## 🔐 Security Features

### API Key Security:
- ✅ **SHA-256 hashed** in database
- ✅ **Plain text shown once** at registration
- ✅ **Cannot be recovered** if lost
- ✅ **Key rotation** supported
- ✅ **Revocation** via flag (not deletion)
- ✅ **Audit logging** of all key usage

### Database Security:
- ✅ Separate `merchant_api_keys` table
- ✅ `merchants` table has NO api_key field
- ✅ Hash comparison for validation
- ✅ Last used timestamp tracking

---

## 🎉 You're Done!

Your website now accepts Pi payments with:
- ✅ **Non-custodial** (customer → your wallet directly)
- ✅ **Prepaid credits** (predictable costs)
- ✅ **Pure math** (1π = 1 credit, cost = amount × 0.02)
- ✅ **Decimal support** (perfect for fiat prices)
- ✅ **Secure API keys** (SHA-256 hashed)
- ✅ **Versioned SDK** (/v1/ for stability)
- ✅ **Cloudflare Pages** (global CDN)

**Next:** Check out [API Reference](API-REFERENCE.md) for advanced features!

---

## 📚 Additional Resources:

- [STRUCTURE.md](STRUCTURE.md) - Complete file structure
- [PREPAID-CREDIT-MODEL.md](PREPAID-CREDIT-MODEL.md) - Deep dive into credit system
- [SECURITY-API-KEYS.md](SECURITY-API-KEYS.md) - API key security details
- [STELLAR-SDK-SETUP.md](STELLAR-SDK-SETUP.md) - Cloudflare compatibility
- [API-LIST-ORDERS.md](API-LIST-ORDERS.md) - Order management API