# 💳 PayPi Plugin

> **Payment Gateway for Pi Network**
> 
> Customer payments are non-custodial, Merchant service credits are prepaid software credits, 2% fee. Drop-in SDK for any website.

**DISCLAIMER:** PayPi is an independent payment gateway compatible with Pi Network. PayPi is not affiliated with, endorsed by, or sponsored by Pi Network. "Pi Network" is a trademark of Pi Community Company.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yyk-hub/paypi-plugin)

## 🌱 Philosophy

PayPi is built by Pioneers for the Pi community.
Our goal is to provide simple, transparent, and open infrastructure
that helps merchants accept Pi easily.

We believe in:
- Non-custodial customer payments
- Transparent fee math
- Open-source collaboration
---

## Who Should Use PayPi?

* Small merchants
* Pi ecosystem apps
* SaaS products
* Game developers
---

## ✨ Features

- ✅ **Drop-in Integration** - Add one `<script>` tag
- ✅ **Non-Custodial** - Customer payments go directly to merchant wallet
- ✅ **Prepaid Non-refundable Credit System** - Deposit π, get credits, process payments
- ✅ **Pure Math (2% Fee)** - 1π deposit = 1 credit, payment costs 2% of amount
- ✅ **Built-in Refunds** - A2U refund system included
- ✅ **Admin Dashboard** - Track orders, credits, revenue
- ✅ **Works with Decimals** - Perfect for fiat-to-Pi conversions
- ✅ **100% Open Source** - MIT License

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Deploy to Cloudflare

```bash
git clone https://github.com/yyk-hub/paypi-plugin
cd paypi-plugin
npm install
wrangler deploy
```

### Step 2: Configure Secrets

```bash
wrangler secret put PI_API_KEY
# Enter your Pi Network API key

wrangler secret put APP_WALLET_SECRET
# Enter your app's Stellar secret key

wrangler secret put ADMIN_TOKEN
# Create a secure password
```

### Step 3: Add to Your Website

```html
<!-- Add Pi SDK -->
<script src="https://sdk.minepi.com/pi-sdk.js"></script>

<!-- Add PayPi SDK -->
<script src="https://your-worker.workers.dev/sdk/paypi.js"></script>

<!-- Add payment button -->
<div data-paypi-amount="10" 
     data-paypi-order="ORD-12345"
     data-paypi-description="Premium Plan">
</div>
```

**That's it!** 🎉

---

## 💰 Prepaid Credit System

### How It Works:

```
1. Merchant deposits 200π → Gets 200 credits (1:1)
2. Customer pays 100π → Costs 2 credits (2% fee)
3. Merchant balance: 198 credits remaining
4. Can process: 198 ÷ 0.02 = 9,900π more payments
```

### Pure Math (No Conversions):
- **Deposit:** 1π = 1 credit (exact 1:1)
- **Payment:** Cost = payment_amount × 0.02
- **Fee:** Always exactly 2%
- **Works with any decimal!**

### Example with Fiat Conversion:
```
Product: $50 USD
Exchange: 1π = $3.50
Pi amount: 14.285714π

Credit cost: 14.285714 × 0.02 = 0.2857142 credits
No complicated conversions! ✅
```

---

## 📖 Documentation

### Basic Usage

```html
<div data-paypi-amount="10" 
     data-paypi-order="ORD-123">
</div>
```

### With Success Callback

```html
<div data-paypi-amount="10" 
     data-paypi-order="ORD-123"
     data-paypi-success="handleSuccess">
</div>

<script>
function handleSuccess(result) {
  console.log('Payment successful!', result.txid);
}
</script>
```

---

## 🛠️ Admin Dashboard

Access: `https://your-worker.workers.dev/admin.html`

**Features:**
- View credit balance
- Deposit credits (refill)
- View all orders
- Process refunds
- Export data

---

## 💳 Credit Management

### Check Balance

Your dashboard shows:
```
Credits: 198
Capacity: 9,900π can process
⚠️ Low balance (< 20 credits)
[Refill Credits →]
```

### Deposit More Credits

1. Click "Refill Credits"
2. Choose amount (e.g., 200π)
3. Pay via Pi Network
4. Credits added instantly (1:1)

### Warning Thresholds

- **< 20 credits:** Yellow warning
- **< 10 credits:** Red warning  
- **0 credits:** Payments disabled

---

## 🔄 Refunds (A2U)

Built-in refund system:

1. Go to admin dashboard
2. Find the order
3. Click "Refund"
4. Pi sent back to customer
5. **Credits refunded to your account!**

**Refund = Get credits back** (2% of refund amount)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   MERCHANT DEPOSITS (U2A)           │
│   200π → PayPi Platform Wallet      │
│   Credits: 200 (1:1)                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   CUSTOMER CHECKOUT                 │
│   PayPi checks: Credits >= 2?       │
│   Customer pays 100π                │
│   → DIRECTLY to Merchant Wallet ✅  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   CREDIT DEDUCTION                  │
│   100π × 0.02 = 2 credits           │
│   Balance: 200 - 2 = 198            │
└─────────────────────────────────────┘
```

**Key:** Customers pay merchants directly. PayPi only manages service credits.

---

## 🔒 Security

### Non-Custodial
- Customer payments go directly to merchant wallet
- PayPi never holds customer funds
- Merchants control their own wallets

### Prepaid Credits = SaaS Subscription
- Like AWS credits or Stripe prepaid
- Not money transmission
- No custody of payments
- Service fee, not payment processing

### Legal Compliance
- No money transmitter license needed
- Service credits model
- Clear in all documentation

---

## 📊 Database Schema

```sql
CREATE TABLE merchants (
  merchant_id TEXT PRIMARY KEY,
  credit_balance REAL DEFAULT 0,  -- Pure π value
  total_deposits REAL DEFAULT 0,
  total_processed REAL DEFAULT 0,
  payments_enabled BOOLEAN DEFAULT 0
);

CREATE TABLE ceo_orders (
  order_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  total_amt REAL NOT NULL,
  credits_charged REAL NOT NULL,  -- amount × 0.02
  pi_txid TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
```

---

## 🔧 API Reference

### Check Credits
```javascript
GET /api/merchant/check-credits
Headers: { "Authorization": "Bearer API_KEY" }
Body: { "amount": 100 }

Response: {
  "has_credits": true,
  "balance": 200,
  "needed": 2,
  "capacity": 10000
}
```

### Deposit Credits
```javascript
POST /api/merchant/credit-deposit
Body: {
  "pi_payment_id": "xxx",
  "txid": "yyy",
  "amount": 200
}

Response: {
  "success": true,
  "credits_added": 200,
  "new_balance": 400
}
```

---

## 🌍 Platform Examples

### React
```jsx
function Checkout() {
  return (
    <div data-paypi-amount="10" 
         data-paypi-order="ORD-123" />
  );
}
```

### WordPress/WooCommerce
```php
add_action('woocommerce_after_checkout_form', function() {
  $total = WC()->cart->total;
  echo "<div data-paypi-amount='$total'></div>";
});
```

---

## ❓ FAQ

**Q: Why prepaid credits?**  
A: Simpler legally (no money transmitter license), predictable costs for merchants.

**Q: What's the fee?**  
A: 2% - calculated as payment_amount × 0.02 credits.

**Q: Can I get refunds?**  
A: Yes! Built-in A2U system. You also get credits back (2% of refund amount).

**Q: Works with decimals?**  
A: Yes! Perfect for fiat-to-Pi conversions (e.g., $50 ÷ $3.50 = 14.285714π).

**Q: Is this custodial?**  
A: No! Customer payments go directly to your wallet. PayPi only manages service credits.

---

## 🤝 Contributing

Contributions welcome!

1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

---

## 📝 License

MIT License

**Additional Terms:**
- Comply with Pi Network trademark guidelines
- Include trademark disclaimer
- Do not imply endorsement by Pi Network

---

## 🆘 Support

- **Documentation:** https://github.com/yyk-hub/paypi-plugin#readme
- **Issues:** https://github.com/yyk-hub/paypi-plugin/issues
- **Discord:** https://discord.gg/paypi
- **Email:** yyk.1borneo@gmail.com

---

## ⚖️ Legal

**Trademark Notice:**  
PayPi is an independent payment gateway compatible with Pi Network. Not affiliated with, endorsed by, or sponsored by Pi Network. "Pi Network" is a trademark of Pi Community Company.

**License:**  
MIT License - Use commercially, modify, distribute.

---

**Made with ❤️ for the Pi Network community**

## 🌟 Star this repo if it helps your business!