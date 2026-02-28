# 📁 PayPi Plugin - Complete Repository Structure

This document outlines the complete file structure for PayPi Plugin.

---

## 🗂️ Repository Layout

```
paypi-plugin/
│
├── README.md                           # Main documentation
├── LICENSE                             # MIT License
├── INSTALL.md                          # Installation guide
├── CHANGELOG.md                        # Version history
├── package.json                        # Node dependencies
├── wrangler.toml                       # Cloudflare Workers config
│
├── .github/
│   ├── workflows/
│   │   └── deploy.yml                  # Auto-deploy on push
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
│
├── public/                             # Static files
│   ├── index.html                      # Landing page
│   ├── admin.html                      # Admin dashboard
│   ├── test-payment.html               # Test checkout page
│   └── sdk/v1
│       └── paypi.js                    # Drop-in SDK script
│
├── functions/                          # Cloudflare Workers endpoints
│   └── api/
│       ├── pi/
│       │   ├── approve.js              # Approve payment
│       │   ├── complete.js             # Complete payment
│       │   └── refund.js               # Process A2U refund
│       ├── admin/
│       │   ├── list-orders.js          # Get all orders
│       │   ├── get-stats.js            # Revenue statistics
│       │   └── export-csv.js           # Export data
│       └── webhooks/
│           └── notify.js               # Send webhooks to merchant
│
├── schema/                             # Database schemas
│   ├── d1-setup.sql                    # Initial D1 setup
│   └── migrations/
│       ├── 001-add-refunds.sql
│       └── 002-add-ad-tracking.sql
│
├── docs/                               # Documentation
│   ├── quickstart.md                   # 5-minute setup guide
│   ├── api-reference.md                # API documentation
│   ├── webhooks.md                     # Webhook integration
│   ├── customization.md                # Styling & customization
│   ├── pi-ad-network.md                # Ad network integration
│   ├── faq.md                          # Frequently asked questions
│   ├── troubleshooting.md              # Common issues
│   └── examples/
│       ├── woocommerce.md
│       ├── shopify.md
│       ├── react.md
│       └── vanilla-js.md
│
├── examples/                           # Integration examples
│   ├── woocommerce/
│   │   ├── paypi-plugin.php            # WordPress plugin
│   │   └── README.md
│   ├── shopify/
│   │   ├── paypi-app/
│   │   └── README.md
│   ├── react/
│   │   ├── PayPiButton.jsx             # React component
│   │   └── README.md
│   └── vanilla-js/
│       ├── checkout.html               # Plain HTML example
│       └── README.md
│
├── tests/                              # Test suite
│   ├── sdk.test.js                     # SDK unit tests
│   ├── api.test.js                     # API endpoint tests
│   └── integration.test.js             # End-to-end tests
│
└── scripts/                            # Utility scripts
    ├── setup.sh                        # Initial setup script
    ├── deploy.sh                       # Deployment script
    └── generate-docs.sh                # Documentation generator
```

---

## 📄 Core Files

### Root Level

**README.md**
- Main documentation
- Quick start guide
- Features overview
- API reference
- Trademark disclaimer

**LICENSE**
```
MIT License with Additional Terms:
- Comply with Pi Network trademark guidelines
- No implied endorsement by Pi Network
- Include trademark disclaimer in implementations
```

**INSTALL.md**
- Step-by-step installation
- Multiple deployment options
- Configuration guide
- Troubleshooting

**wrangler.toml**
```toml
name = "paypi-plugin"
compatibility_date = "2024-10-14"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "paypi-db"
database_id = "YOUR_D1_DATABASE_ID"

[vars]
PI_NETWORK = "testnet"
```

**package.json**
```json
{
  "name": "paypi-plugin",
  "version": "1.0.0",
  "description": "Payment Gateway for Pi Network",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "jest"
  },
  "dependencies": {
    "@stellar/stellar-sdk": "git+https://github.com/stellar/js-stellar-sdk#make-eventsource-optional"
  },
  "devDependencies": {
    "wrangler": "^4.59.1"
  }
}
```

---

## 🌐 Public Files

### public/index.html
- Marketing landing page
- Features, pricing, how-it-works
- Blue/green color scheme (NOT purple)
- Trademark disclaimer in footer

### public/admin.html
- Admin dashboard
- Order management
- Refund processing
- Revenue analytics
- Requires ADMIN_TOKEN authentication

### public/test-payment.html
- Test checkout page
- For merchant testing
- Pre-configured for testnet
- Debug logging enabled

### public/sdk/paypi.js
- Drop-in SDK script
- Auto-initializes payment buttons
- Handles complete payment flow
- Blue gradient buttons
- Error handling & status display

---

## ⚙️ API Endpoints

### functions/api/pi/approve.js
```javascript
POST /api/pi/approve
{
  "payment_id": "xxx",
  "order_id": "ORD-123",
  "user_uid": "user_123",
  "username": "pioneer",
  "amount": 10
}
```

**Purpose:** Approve Pi payment via Pi Network API

### functions/api/pi/complete.js
```javascript
POST /api/pi/complete
{
  "payment_id": "xxx",
  "txid": "7a7ed20d...",
  "order_id": "ORD-123",
  "ad_watched": false
}
```

**Purpose:** Complete payment, update database, send webhooks

### functions/api/pi/refund.js
```javascript
POST /api/pi/refund
{
  "order_id": "ORD-123",
  "amount": 10,
  "reason": "Customer requested"
}
```

**Purpose:** Process A2U refund via Stellar

### functions/api/admin/list-orders.js
```javascript
GET /api/admin/list-orders
Headers: { "Authorization": "Bearer ADMIN_TOKEN" }
```

**Purpose:** Fetch all orders for dashboard

---

## 🗄️ Database Schema

### schema/d1-setup.sql

```sql
CREATE TABLE paypi_orders (
  order_id TEXT PRIMARY KEY,
  user_uid TEXT NOT NULL,
  pi_username TEXT,
  total_amt REAL NOT NULL,
  pi_amount REAL NOT NULL,
  order_status TEXT,
  pi_payment_id TEXT,
  pi_txid TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  has_refund BOOLEAN DEFAULT 0,
  refunded_at INTEGER,
  ad_watched BOOLEAN DEFAULT 0
);

CREATE INDEX idx_orders_status ON paypi_orders(order_status);
CREATE INDEX idx_orders_user ON paypi_orders(user_uid);
CREATE INDEX idx_orders_created ON paypi_orders(created_at);
```

---

## 📚 Documentation Files

### docs/quickstart.md
- 5-minute setup guide
- Copy-paste commands
- Common issues

### docs/api-reference.md
- All API endpoints
- Request/response examples
- Error codes

### docs/webhooks.md
- Webhook setup
- Signature verification
- Event types
- Testing webhooks

### docs/customization.md
- Button styling
- Custom themes
- CSS overrides
- JavaScript API

### docs/pi-ad-network.md
- Ad network integration
- Application process
- Revenue sharing
- Compliance

### docs/faq.md
- Common questions
- Troubleshooting
- Best practices

---

## 🔌 Integration Examples

### examples/woocommerce/
- WordPress plugin
- PHP integration
- Hooks & filters
- Admin settings

### examples/shopify/
- Shopify app
- Liquid templates
- Checkout integration
- Order sync

### examples/react/
- React component
- Hooks usage
- TypeScript types
- Redux integration

### examples/vanilla-js/
- Plain HTML/JS
- No framework
- Progressive enhancement
- Works anywhere

---

## 🧪 Testing

### tests/sdk.test.js
- SDK initialization
- Button creation
- Payment flow
- Error handling

### tests/api.test.js
- API endpoints
- Authentication
- Database operations
- Webhook delivery

### tests/integration.test.js
- End-to-end flows
- Payment completion
- Refund processing
- Dashboard operations

---

## 🚀 Deployment

### scripts/setup.sh
```bash
#!/bin/bash
# Initial setup script
echo "Setting up PayPi Plugin..."
npm install
wrangler d1 create paypi_db
wrangler deploy
```

### scripts/deploy.sh
```bash
#!/bin/bash
# Deploy to production
git pull origin main
npm install
wrangler deploy --env production
```

### .github/workflows/deploy.yml
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Cloudflare
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

---

## 📦 Release Process

1. Update `CHANGELOG.md`
2. Bump version in `package.json`
3. Tag release: `git tag v1.0.0`
4. Push: `git push origin v1.0.0`
5. GitHub Actions auto-deploys
6. Update documentation
7. Announce on Discord/Twitter

---

## 🔒 Security

### Secrets Management
- `PI_API_KEY` - Set via `wrangler secret put`
- `APP_WALLET_SECRET` - Never committed to Git
- `ADMIN_TOKEN` - Random secure string
- `WEBHOOK_SECRET` - For signing webhooks

### Environment Variables
- `PI_NETWORK` - "testnet" or "mainnet"
- `DEBUG_MODE` - Enable debug logging
- `WEBHOOK_URL` - Optional webhook endpoint

---

## 📊 Monitoring

### Cloudflare Logs
```bash
wrangler tail
```

### Database Queries
```bash
wrangler d1 execute paypi_db --command="SELECT * FROM paypi_orders LIMIT 10"
```

### Analytics
- Track in admin dashboard
- Export to CSV
- Cloudflare Analytics integration

---

## 🎯 Development Workflow

1. **Fork repository**
2. **Create feature branch:** `git checkout -b feature/my-feature`
3. **Make changes**
4. **Test locally:** `wrangler dev`
5. **Commit:** `git commit -m "Add feature"`
6. **Push:** `git push origin feature/my-feature`
7. **Create Pull Request**

---

## 📞 Support Channels

- **GitHub Issues:** Bug reports & feature requests
- **Discord:** Real-time community support
- **Email:** support@paypi.dev
- **Documentation:** docs.paypi.dev

---

## ⚖️ Legal

**Trademark Notice:**  
PayPi is an independent payment gateway compatible with Pi Network. Not affiliated with Pi Network. "Pi Network" is a trademark of Pi Community Company.

**License:**  
MIT License with additional terms for Pi Network trademark compliance.

---

## 🎉 Ready to Deploy!

This structure provides:
- ✅ Complete codebase organization
- ✅ Clear documentation
- ✅ Easy deployment
- ✅ Extensible architecture
- ✅ Community-friendly

**Next:** Follow [INSTALL.md](INSTALL.md) to deploy your instance!