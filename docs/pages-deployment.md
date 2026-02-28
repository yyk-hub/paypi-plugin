# 🚀 PayPi Plugin - Deployment Guide (Cloudflare Pages)

This is a **Cloudflare Pages** project, not a Worker project.

---

## 📂 Project Structure

```
paypi-plugin/
├── public/              # Static files (HTML, CSS, JS)
│   ├── index.html      # Landing page
│   ├── admin.html      # Admin dashboard
│   ├── test-payment.html
│   └── sdk/
│       └── paypi.js    # Drop-in SDK
│
├── functions/          # API routes (serverless functions)
│   └── api/
│       ├── pi/         # Payment endpoints
│       ├── merchant/   # Merchant management
│       └── refund/     # Refund processing
│
├── package.json        # Pages project config
└── wrangler.toml       # Pages deployment config
```

**Key Difference:**
- ❌ NO `src/index.js` (that's for Workers)
- ✅ YES `/public` + `/functions` (Pages architecture)

---

## 🔧 Deployment Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Create D1 Database
```bash
# Create database
wrangler d1 create paypi_orders

# You'll get output like:
# database_id = "xxxx-xxxx-xxxx-xxxx"

# Copy the database_id and update wrangler.toml
```

Update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "paypi_orders"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"
```

### 3. Initialize Database Schema
```bash
wrangler d1 execute paypi_orders --file=./schema/d1-setup.sql
```

### 4. Set Secrets (Environment Variables)
```bash
# Method 1: Via CLI (recommended)
wrangler pages secret put PI_API_KEY
wrangler pages secret put APP_WALLET_SECRET
wrangler pages secret put ADMIN_TOKEN

# Method 2: Via Dashboard
# Go to Cloudflare Dashboard → Pages → Your project → Settings → Environment variables
```

### 5. Deploy to Pages
```bash
# First deployment (creates the Pages project)
wrangler pages deploy public

# You'll get a URL like:
# https://paypi-plugin.pages.dev

# OR with custom project name:
wrangler pages deploy public --project-name=paypi-plugin
```

### 6. Bind D1 Database to Pages Project
```bash
# Via Dashboard:
# Cloudflare Dashboard → Pages → paypi-plugin → Settings → Functions
# → D1 database bindings → Add binding
# Variable name: DB
# D1 database: paypi_orders

# OR add to wrangler.toml (already done)
```

---

## 🧪 Local Development

### Run locally with D1:
```bash
# Start dev server
npm run dev

# Or with wrangler directly:
wrangler pages dev public --d1=DB:paypi_orders --compatibility-flag=nodejs_compat
```

**Access:**
- Frontend: http://localhost:8788
- API: http://localhost:8788/api/*
- Admin: http://localhost:8788/admin.html

---

## 🔄 Update Deployment

```bash
# After making changes
npm run deploy

# Or
wrangler pages deploy public
```

---

## 📊 Key Differences: Pages vs Workers

| Feature | Pages (PayPi) | Workers |
|---------|---------------|---------|
| Entry point | `/public` + `/functions` | `src/index.js` |
| Static files | ✅ In `/public` | ❌ Need separate hosting |
| API routes | `/functions/api/*` | All in one file |
| Deploy command | `wrangler pages deploy` | `wrangler deploy` |
| Config | `wrangler.toml` (minimal) | `wrangler.toml` (detailed) |

---

## 🗂️ How Functions Work in Pages

### File-based routing:
```
functions/api/pi/approve.js
    ↓
Available at: /api/pi/approve

functions/api/merchant/register.js
    ↓
Available at: /api/merchant/register
```

### Function format:
```javascript
// functions/api/example.js
export async function onRequestPost(context) {
  const { request, env } = context;
  // env.DB - D1 database binding
  // env.PI_API_KEY - Secret
  return Response.json({ success: true });
}

export async function onRequestGet(context) {
  // Handle GET requests
}

export async function onRequestOptions() {
  // Handle CORS preflight
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    }
  });
}
```

---

## 🔐 Environment Variables in Pages

### Set via CLI:
```bash
# Production
wrangler pages secret put PI_API_KEY

# Preview (for testing)
wrangler pages secret put PI_API_KEY --env preview
```

### Set via Dashboard:
1. Cloudflare Dashboard
2. Pages → paypi-plugin
3. Settings → Environment variables
4. Add variable:
   - **Production:** Used for main deployment
   - **Preview:** Used for branch deployments

### Variables needed:
- `PI_API_KEY` - Your Pi Network API key
- `APP_WALLET_SECRET` - Stellar secret key
- `ADMIN_TOKEN` - Dashboard password
- `PI_NETWORK` - "testnet" or "mainnet" (can be in wrangler.toml)

---

## 📝 Updated package.json

```json
{
  "name": "paypi-plugin",
  "version": "1.0.0",
  "description": "Payment Gateway for Pi Network - Non-custodial, prepaid credit system, 2% fee",
  "type": "module",
  "scripts": {
    "dev": "wrangler pages dev public --compatibility-flag=nodejs_compat",
    "deploy": "wrangler pages deploy public",
    "tail": "wrangler pages deployment tail",
    "test": "node lib/credits-pure-math.js"
  },
  "keywords": [
    "pi-network",
    "payment-gateway",
    "cloudflare-pages"
  ],
  "license": "MIT",
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

## 📝 Updated wrangler.toml

```toml
name = "paypi-plugin"
compatibility_date = "2024-10-14"
compatibility_flags = ["nodejs_compat"]

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "paypi_orders"
database_id = ""  # Add your database ID here

# Environment variables (non-secret)
[vars]
PI_NETWORK = "testnet"

# Secrets set via: wrangler pages secret put SECRET_NAME
# - PI_API_KEY
# - APP_WALLET_SECRET  
# - ADMIN_TOKEN
```

---

## 🐛 Troubleshooting

### "Module not found" error
**Problem:** Functions can't find modules  
**Solution:** Make sure `compatibility_flags = ["nodejs_compat"]` is in wrangler.toml

### D1 database not accessible
**Problem:** Functions can't access DB  
**Solution:** 
1. Check binding name is "DB" in wrangler.toml
2. Verify database_id is correct
3. Redeploy: `wrangler pages deploy public`

### Secrets not working
**Problem:** env.PI_API_KEY is undefined  
**Solution:** Set secrets for Pages (not Workers):
```bash
wrangler pages secret put PI_API_KEY
```

### Local dev not working
**Problem:** D1 database not available locally  
**Solution:** 
```bash
wrangler pages dev public --d1=DB:paypi_orders
```

---

## ✅ Deployment Checklist

- [ ] Created D1 database
- [ ] Updated wrangler.toml with database_id
- [ ] Initialized database schema
- [ ] Set all secrets (PI_API_KEY, APP_WALLET_SECRET, ADMIN_TOKEN)
- [ ] Deployed: `wrangler pages deploy public`
- [ ] Tested: Visit https://your-project.pages.dev
- [ ] API works: Test /api/merchant/register
- [ ] Admin works: Visit /admin.html

---

## 🎯 Summary

**This is a Pages project:**
- Static files in `/public`
- API routes in `/functions`
- Deploy with `wrangler pages deploy public`
- Secrets via `wrangler pages secret put`

**NOT a Worker project:**
- No `src/index.js` needed
- No `wrangler deploy`
- Different secret management

---

**Ready to deploy!** 🚀