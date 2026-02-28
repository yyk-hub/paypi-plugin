# PayPi - Deployment Models

PayPi supports **two deployment models**. Choose based on your needs:

---

## 🏢 Model 1: Hosted SaaS (Recommended for Most)

**Who:** Merchants who want the simplest setup

**What:** Use the hosted PayPi platform at `https://paypi.pages.dev`

### Merchant Setup:
```
1. Register → Get API key
2. Provide Pi wallet address
3. Deposit credits
4. Add <script> tag
5. Done!
```

### What Merchant Needs:
- ✅ Pi wallet address (where payments go)
- ✅ Business info
- ❌ NO Pi API key needed
- ❌ NO Cloudflare account needed
- ❌ NO deployment needed

### Architecture:
```
┌──────────────────────────────────────────┐
│  PayPi Platform (Centralized)           │
│  - Operated by PayPi team               │
│  - One Pi API key (platform's)          │
│  - Handles all merchants                │
└──────────────────────────────────────────┘
              ↓
    Merchants register & use
              ↓
┌──────────────────────────────────────────┐
│  Merchant's Website                      │
│  - Adds PayPi <script> tag              │
│  - Customer payments → Merchant wallet  │
│  - Platform charges 2% credit fee       │
└──────────────────────────────────────────┘
```

### Fee Structure:
- **2% processing fee**
- Collected via prepaid credits
- No monthly charges

### Best For:
- Small merchants
- Quick setup needed
- Don't want technical complexity
- Trust centralized service

---

## 🔧 Model 2: Self-Hosted (Advanced)

**Who:** Developers/merchants who want full control

**What:** Deploy PayPi to your own Cloudflare account

### What You Need:
1. ✅ Your own Pi Network developer account
2. ✅ Your own Pi API key
3. ✅ Your own Cloudflare account
4. ✅ Technical knowledge (deploy, configure)

### Setup Process:
```bash
# 1. Clone repository
git clone https://github.com/yyk-hub/paypi-plugin
cd paypi-plugin

# 2. Deploy to YOUR Cloudflare
wrangler pages deploy public

# 3. Set YOUR secrets
wrangler pages secret put PI_API_KEY        # YOUR key
wrangler pages secret put APP_WALLET_SECRET # YOUR wallet
wrangler pages secret put ADMIN_TOKEN       # YOUR password

# 4. Configure D1 database
wrangler d1 create paypi_orders
wrangler d1 execute paypi_orders --file=./schema/d1-setup.sql
```

### Architecture:
```
┌──────────────────────────────────────────┐
│  Merchant's Own PayPi Instance          │
│  - Deployed to merchant's Cloudflare    │
│  - Uses merchant's Pi API key           │
│  - Full control & ownership             │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│  Merchant's Website                      │
│  - Uses their own PayPi instance        │
│  - No fees to anyone                    │
│  - Complete independence                │
└──────────────────────────────────────────┘
```

### Fee Structure:
- **No fees!** (you own the platform)
- Only Cloudflare costs (usually free tier)

### Best For:
- Developers
- High-volume merchants
- Want full control
- Don't trust third parties
- Need customization

---

## 📊 Comparison

| Feature | Hosted SaaS | Self-Hosted |
|---------|-------------|-------------|
| **Setup Time** | 5 minutes | 1-2 hours |
| **Technical Skill** | None | Developer |
| **Pi API Key** | Not needed | Required |
| **Cloudflare Account** | Not needed | Required |
| **Processing Fee** | 2% | 0% |
| **Monthly Cost** | $0 | Cloudflare (usually $0) |
| **Control** | Limited | Complete |
| **Customization** | Via settings | Full code access |
| **Maintenance** | Handled for you | Your responsibility |
| **Best For** | 90% of merchants | 10% power users |

---

## 🤔 Which Should You Choose?

### Choose **Hosted SaaS** if you:
- Want to start accepting Pi quickly
- Don't have technical expertise
- Are okay with 2% fee
- Trust a managed service
- **Recommended for most merchants ✅**

### Choose **Self-Hosted** if you:
- Are a developer
- Process high volumes (save on fees)
- Want 100% control
- Can maintain infrastructure
- Need custom modifications

---

## 🎯 Getting Started

### For Hosted SaaS:
👉 Go to [https://paypi.pages.dev](https://paypi.pages.dev)  
👉 Click "Register as Merchant"  
👉 Follow the setup wizard

### For Self-Hosted:
👉 Read [INSTALL.md](INSTALL.md)  
👉 Clone repository  
👉 Deploy to your Cloudflare  
👉 Configure your Pi API keys

---

## 💡 Can I Switch Later?

**Yes!**

**From Hosted → Self-Hosted:**
- Export your order data
- Deploy your own instance
- Update your website's script URL
- No vendor lock-in

**From Self-Hosted → Hosted:**
- Register on hosted platform
- Migrate your data
- Switch script URL
- Stop maintaining your instance

---

## 🔒 Security Note

### Hosted SaaS:
- Platform's Pi API key approves payments
- Customers still pay directly to YOUR wallet
- Platform cannot steal funds (non-custodial)
- Prepaid credits are service fees, not held funds

### Self-Hosted:
- Your Pi API key, your control
- Your Cloudflare, your data
- Complete transparency
- Zero third-party dependencies

---

## ❓ FAQ

**Q: Does hosted SaaS mean custodial?**  
A: No! Customer payments still go directly to merchant wallet. Platform just processes the transactions.

**Q: Can hosted platform steal my funds?**  
A: No! Payments go from customer → your wallet. Platform never holds customer payments. Prepaid credits are service fees, not customer funds.

**Q: Why pay 2% if I can self-host for free?**  
A: Convenience! 2% saves you hours of setup, maintenance, updates, and monitoring.

**Q: What if hosted platform goes down?**  
A: You can always switch to self-hosted since code is open source.

**Q: Can I white-label hosted version?**  
A: Not on the public hosted version. Self-host for white-label.

**Q: Do I need a Pi developer account for hosted?**  
A: No! Platform uses its Pi API key. You just need a Pi wallet address.

**Q: What about transaction limits?**  
A: Hosted platform handles Pi Network limits. Self-hosted, you manage your own limits.

---

## 🎯 Recommendation

**Start with Hosted SaaS:**
- Get live in 5 minutes
- See if Pi payments work for your business
- If you grow large, consider self-hosting later

**95% of merchants are best served by hosted SaaS.**

Only consider self-hosting if you:
- Are a developer
- Process >$50k/month (2% = $1k saved)
- Have specific custom needs