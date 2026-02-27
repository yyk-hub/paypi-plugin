# 💳 PayPi Plugin

> **Payment Gateway for Pi Network (Cloudflare Pages Edition)**
> 
> Customer payments are non-custodial. Merchant service credits are prepaid software credits with 2% processing fee. Drop-in SDK for any website.

**DISCLAIMER:** PayPi is an independent payment gateway compatible with Pi Network. PayPi is not affiliated with, endorsed by, or sponsored by Pi Network. "Pi Network" is a trademark of Pi Community Company.

---

## 🌱 Philosophy

PayPi is built by Pioneers for the Pi community.

Our goal is to provide simple, transparent, and open infrastructure that helps merchants accept Pi easily.

**We believe in:**
- 🔒 Non-custodial customer payments
- 📊 Transparent fee math
- 🤝 Open-source collaboration
- 🚫 No hidden custody risks

---

## 👥 Who Should Use PayPi?

### 🏗️ Platform Operators (You)
Deploy PayPi once and provide payment infrastructure for:
- Multiple merchants
- Pi ecosystem apps
- SaaS payment needs

### 🛍️ Merchants (Your Customers)
Perfect for:
- Small merchants
- Pi ecosystem apps
- SaaS products
- Game developers
- E-commerce stores

---

## 🏗️ Developer's Architecture

PayPi runs on **Cloudflare Pages** with:

| Component | Technology |
|-----------|------------|
| Static Files | Cloudflare Pages |
| API Routes | Cloudflare Functions |
| Database | Cloudflare D1 (SQLite) |
| Blockchain | Pi Network SDK + Stellar (fetch-compatible) |

### Stellar SDK (Cloudflare-Compatible Setup)

Refund processing runs inside Cloudflare Workers / Pages Functions.

To ensure compatibility with the Workers runtime, this project uses
a Workers-compatible build of `@stellar/stellar-sdk` and forces axios
to use the Fetch API adapter.

Dependencies are locked to specific versions for stability.
Do not upgrade without testing refund flow.

```
paypi-plugin/
├── public/
│   └── sdk/v1/paypi.js    → Versioned SDK
├── functions/
│   └── api/               → Serverless routes
└── D1: paypi-db
    ├── merchants          → Credit balances
    ├── paypi_orders       → Payment records
    └── credit_transactions → Credit history
```

---

## ✨ Merchant Features

- ✅ **Drop-in Integration** - Add one `<script>` tag
- ✅ **Non-Custodial Payments** - Customer funds go directly to merchant wallet
- ✅ **Prepaid Credit System** - Deposit π for non-refundable software credits
- ✅ **Pure Math (2% Fee)** - 1π deposit = 1 credit, payment costs amount × 0.02
- ✅ **Built-in Refunds** - A2U refund system included
- ✅ **Admin Dashboard** - Track orders, credits, revenue
- ✅ **Decimal Support** - Perfect for fiat-to-Pi conversions
- ✅ **Versioned SDK** - v1 API with backward compatibility
- ✅ **100% Open Source** - MIT License

---

## 🚀 Quick Start

### 🏗️ For Platform Operators (Deploy Once)

#### Step 1: Clone Repository
```bash
git clone https://github.com/yyk-hub/paypi-plugin
cd paypi-plugin
npm install
```

#### Step 2: Push to Your GitHub
```bash
git remote add origin https://github.com/YOUR-USERNAME/paypi-plugin
git push -u origin main
```

#### Step 3: Deploy via Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **Pages** → **Create a project** → **Connect to Git**
3. Select your `paypi-plugin` repository
4. **Build settings:**
   - **Build command:** `npm install`
   - **Output directory:** `public`
   - **Root directory:** (leave empty)
5. Click **Save and Deploy**

**Functions are auto-detected** from `/functions` directory.

#### Step 4: Create D1 Database
```bash
# Create database (use this EXACT name)
wrangler d1 create paypi-db

# Copy database_id from output
# Update wrangler.toml:
# database_id = "PASTE_ID_HERE"

# Initialize schema
wrangler d1 execute paypi-db --file=./schema/d1-setup.sql
```

#### Step 5: Configure Environment Variables

In Cloudflare Dashboard → **Pages** → Your Project → **Settings** → **Environment Variables**:

**Production variables:**
```bash
PI_API_KEY           # Your Pi Network API key from https://develop.pi
APP_WALLET_SECRET    # Your app's Stellar secret key (starts with S)
ADMIN_TOKEN          # Secure password for admin dashboard
PI_NETWORK           # "testnet" or "mainnet"
```

#### Step 6: Bind D1 Database

In Cloudflare Dashboard → **Pages** → **Settings** → **Functions**:
- Click **D1 database bindings** → **Add binding**
- **Variable name:** `DB`
- **D1 database:** `paypi-db`
- Click **Save**

**Your platform is now live!** 🎉

---

### 🛍️ For Merchants (Use the Service)

**No installation needed!** Just add to your website:

#### Step 1: Register as Merchant
Visit the hosted platform and register with:
- Business name
- Email
- **Pi wallet address** (where customer payments go)

Get your **API key** (save it securely).

#### Step 2: Deposit Credits
1. Visit admin dashboard
2. Click "Refill Credits"
3. Deposit π via Pi Network (U2A payment)
4. Credits added instantly (1π = 1 credit)

#### Step 3: Add to Your Website

**HTML Example:**
```html
<!-- Step 1: Add Pi SDK -->
<script src="https://sdk.minepi.com/pi-sdk.js"></script>

<!-- Step 2: Add PayPi SDK (versioned) -->
<script src="https://your-paypi.pages.dev/sdk/v1/paypi.js"></script>

<!-- Step 3: Add payment container -->
<div data-paypi-amount="10" 
     data-paypi-order="ORD-12345"
     data-paypi-description="Premium Plan">
</div>
```

**WordPress/WooCommerce:**
```php
add_action('woocommerce_after_checkout_form', function() {
  ?>
  <script src="https://sdk.minepi.com/pi-sdk.js"></script>
  <script src="https://your-paypi.pages.dev/sdk/v1/paypi.js"></script>
  
  <div data-paypi-amount="<?php echo WC()->cart->total; ?>"
       data-paypi-order="<?php echo uniqid('WC-'); ?>">
  </div>
  <?php
});
```

**Shopify:**
```liquid
<script src="https://sdk.minepi.com/pi-sdk.js"></script>
<script src="https://your-paypi.pages.dev/sdk/v1/paypi.js"></script>

<div data-paypi-amount="{{ checkout.total_price | money_without_currency }}"
     data-paypi-order="{{ checkout.order_number }}">
</div>
```

**React:**
```jsx
function Checkout({ amount, orderId }) {
  useEffect(() => {
    const piScript = document.createElement('script');
    piScript.src = 'https://sdk.minepi.com/pi-sdk.js';
    document.head.appendChild(piScript);
    
    const paypiScript = document.createElement('script');
    paypiScript.src = 'https://your-paypi.pages.dev/sdk/v1/paypi.js';
    document.head.appendChild(paypiScript);
  }, []);
  
  return <div data-paypi-amount={amount} data-paypi-order={orderId} />;
}
```

---

## 💰 Prepaid Credit System

### Pure Math Formula:
```
Deposit: 1π = 1 credit (exact 1:1)
Payment: cost = amount × 0.02 (2% fee)
Capacity: credits ÷ 0.02 = π processable
```

### Example:
```
Merchant deposits: 200π
Credits received: 200
Processing capacity: 10,000π

Customer pays: 100π
Credit cost: 100 × 0.02 = 2 credits
Balance after: 198 credits
Remaining capacity: 9,900π
```

### Works with Decimals:
```
Product: $50 USD
Exchange: 1π = $3.50
Pi amount: 14.285714π

Credit cost: 14.285714 × 0.02 = 0.2857142 credits
Perfect for fiat conversions! ✅
```

---

## 🔒 Security & Compliance

### Non-Custodial Architecture
- ✅ Customer payments → **Direct** to merchant wallet
- ✅ PayPi **never holds** customer funds
- ✅ Merchant controls own wallet keys
- ✅ **All payment validation occurs server-side**
- ✅ **Client SDK cannot approve** payments without backend verification

### Prepaid Credits = SaaS Model
- ✅ Service credits, not money transmission
- ✅ Non-refundable software fees
- ✅ Like AWS credits or Stripe prepaid

### Compliance Note
**Designed as a non-custodial software service model.**  
**Operators are responsible for compliance in their jurisdiction.**

PayPi provides infrastructure code. Platform operators must:
- Understand local regulations
- Obtain necessary licenses if required
- Comply with applicable laws
- Conduct own legal review

---

## 📊 Database Schema

**Database:** `paypi-db` (D1/SQLite)

**Tables:**

```sql
-- Merchants with credit balances
CREATE TABLE merchants (
  merchant_id TEXT PRIMARY KEY,
  api_key TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  credit_balance REAL DEFAULT 0,
  total_deposits REAL DEFAULT 0,
  total_processed REAL DEFAULT 0,
  payments_enabled BOOLEAN DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Payment records
CREATE TABLE paypi_orders (
  order_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  pi_username TEXT,
  total_amt REAL NOT NULL,
  credits_charged REAL NOT NULL,
  order_status TEXT,
  pi_payment_id TEXT,
  pi_txid TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  has_refund BOOLEAN DEFAULT 0,
  refunded_at INTEGER,
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);

-- Credit transaction log
CREATE TABLE credit_transactions (
  tx_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('deposit', 'deduction', 'refund')),
  amount REAL NOT NULL,
  pi_amount REAL,
  balance_after REAL,
  description TEXT,
  pi_txid TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
);
```

---

## ⚠️ Cloudflare Pages Compatibility

### Stellar SDK Requirements

**Standard Stellar SDK does NOT work** in Cloudflare Pages/Workers due to Node.js dependencies.

**Use the fetch-compatible version:**

```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "git+https://github.com/stellar/js-stellar-sdk#make-eventsource-optional"
  }
}
```

**Why:**
- ❌ Pages/Workers: No Node native modules (fs, net, tls)
- ❌ No raw TCP sockets
- ❌ No EventSource polyfills
- ✅ Fetch API only
- ✅ Web-compatible libraries only

**This fork:**
- ✅ Makes EventSource optional
- ✅ Uses fetch instead of Node HTTP
- ✅ Works in Cloudflare runtime
- ✅ Maintained by Stellar team

---

## 🔧 API Reference

### Check Credits
```bash
POST /api/merchant/check-credits
Authorization: Bearer API_KEY
{
  "amount": 100
}

Response:
{
  "has_credits": true,
  "balance": 200,
  "needed": 2,
  "capacity": "10000π"
}
```

### Payment Flow
```bash
# 1. SDK checks credits (client-side)
GET /api/merchant/check-credits

# 2. Pi payment created (client-side via Pi SDK)
Pi.createPayment({ amount: 100 })

# 3. Backend approves (server-side validation)
POST /api/pi/approve
{
  "payment_id": "xxx",
  "order_id": "ORD-123",
  "user_uid": "user_123",
  "amount": 100
}

# 4. Backend completes & deducts credits (server-side)
POST /api/pi/complete
{
  "payment_id": "xxx",
  "txid": "7a7ed...",
  "order_id": "ORD-123"
}
```

**Security:** All payment approval/completion happens server-side. Client cannot forge approvals.

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Run dev server with D1
wrangler pages dev public --d1=DB:paypi-db --compatibility-flag=nodejs_compat

# Access at http://localhost:8788
```

---

## 📚 Documentation

- [Merchant Quickstart](docs/MERCHANT-QUICKSTART.md)
- [Deployment Models](DEPLOYMENT-MODELS.md)
- [Pages Deployment](PAGES-DEPLOYMENT.md)
- [Credit System](docs/CREDIT-SYSTEM-FINAL.md)

---

## ❓ FAQ

**Q: Do merchants need Pi API keys?**  
A: No (hosted model). They just provide wallet address.

**Q: Is this custodial?**  
A: No! Payments go customer → merchant wallet directly.

**Q: What are prepaid credits?**  
A: Non-refundable software service fees. Like AWS/Stripe prepaid.

**Q: Can Stellar SDK run in Cloudflare Pages?**  
A: Yes, but only the fetch-compatible fork (see package.json).

**Q: Why versioned SDK (/sdk/v1/)?**  
A: Allows v2, v3 updates without breaking existing integrations.

**Q: Who's responsible for compliance?**  
A: Platform operators. PayPi is infrastructure code.

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Submit pull request

---

## 📝 License

MIT License - See [LICENSE](LICENSE)

**Compliance responsibility:** Platform operators must ensure compliance in their jurisdiction.

---

## ⚖️ Legal

**Trademark:** PayPi is independent from Pi Network. "Pi Network" is a trademark of Pi Community Company.

**Service Model:** Non-custodial software infrastructure. Prepaid credits are service fees, not customer funds.

**Compliance:** Operators responsible for regulatory compliance in their jurisdiction.

---

## 🌟 Built With

- [Cloudflare Pages](https://pages.cloudflare.com/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Stellar SDK (fetch fork)](https://github.com/stellar/js-stellar-sdk)
- [Pi Network SDK](https://developers.minepi.com/)

---

**Made with ❤️ by Pioneers for the Pi Network community**

**Star ⭐ this repo if it helps you!**