# 🛍️ PayPi - Merchant Quickstart

Accept Pi payments on your website in 5 minutes. No coding required!

---

## 🎯 What You Need

- Your website (WordPress, Shopify, custom, etc.)
- Pi Network wallet
- 5 minutes

---

## 🚀 Step 1: Register as Merchant

### Option A: Via Website (Easiest)
1. Go to https://paypi.pages.dev
2. Click "Register as Merchant"
3. Fill in your details:
   - Business name
   - Email
   - Pi wallet address
4. Get your API key (save this!)

### Option B: Via API
```bash
curl -X POST https://paypi.pages.dev/api/merchant/register \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "My Store",
    "business_email": "hello@mystore.com",
    "wallet_address": "GXXXXXXXXXX"
  }'
```

**Save your API key!** You'll need it.

---

## 💰 Step 2: Deposit Credits

1. Go to https://paypi.pages.dev/admin.html
2. Login with your API key
3. Click "Refill Credits"
4. Choose amount (e.g., 200π)
5. Pay via Pi Browser
6. Credits added instantly!

**Example:**
- Deposit: 200π
- You get: 200 credits
- Can process: 10,000π worth of payments (2% fee)

---

## 🌐 Step 3: Add to Your Website

### For Any Website (HTML):

```html
<!-- Add to your checkout page -->

<!-- Step 1: Add Pi SDK -->
<script src="https://sdk.minepi.com/pi-sdk.js"></script>

<!-- Step 2: Add PayPi SDK -->
<script src="https://paypi.pages.dev/sdk/paypi.js"></script>

<!-- Step 3: Add payment button -->
<div data-paypi-amount="10" 
     data-paypi-order="ORD-12345"
     data-paypi-description="Product name">
</div>

<!-- That's it! Button appears automatically -->
```

### For WordPress/WooCommerce:

```php
// Add to your theme's functions.php

add_action('woocommerce_after_checkout_form', function() {
  ?>
  <script src="https://sdk.minepi.com/pi-sdk.js"></script>
  <script src="https://paypi.pages.dev/sdk/paypi.js"></script>
  
  <div data-paypi-amount="<?php echo WC()->cart->total; ?>"
       data-paypi-order="<?php echo uniqid('WC-'); ?>">
  </div>
  <?php
});
```

### For Shopify:

1. Go to: Themes → Edit code
2. Open: `checkout.liquid`
3. Add before `</body>`:

```liquid
<script src="https://sdk.minepi.com/pi-sdk.js"></script>
<script src="https://paypi.pages.dev/sdk/paypi.js"></script>

<div data-paypi-amount="{{ checkout.total_price | money_without_currency }}"
     data-paypi-order="{{ checkout.order_number }}">
</div>
```

---

## ✅ Step 4: Test Payment

1. **Open your checkout page in Pi Browser**
2. Add item to cart
3. Click "Pay with Pi" button
4. Complete payment
5. Check your admin dashboard!

---

## 📊 Managing Your Credits

### Check Balance:
- Dashboard: https://paypi.pages.dev/admin.html
- Shows: Current credits, capacity, orders

### Low Balance Warning:
- **< 20 credits:** Yellow warning
- **< 10 credits:** Red urgent
- **0 credits:** Payments disabled

### Refill Anytime:
- Click "Refill Credits"
- Choose amount
- Pay via Pi Browser
- Instant top-up!

---

## 🔄 Processing Refunds

1. Go to admin dashboard
2. Find the order
3. Click "Refund"
4. Pi sent back to customer
5. You get credits back (2% of refund)

---

## 💰 Pricing

**Pure Math - Simple 2% Fee:**
- 1π deposit = 1 credit
- 1π payment = 0.02 credits
- Example: 200π deposit = 10,000π capacity

**No Hidden Fees:**
- No monthly fee
- No setup fee
- Just 2% per transaction

---

## 🎨 Customization

### Change Button Text:
```html
<div data-paypi-amount="10"
     data-paypi-button-text="Buy Now with Pi">
</div>
```

### Custom Success Page:
```html
<div data-paypi-amount="10"
     data-paypi-success="/thank-you">
</div>
```

### Success Callback:
```html
<div data-paypi-amount="10"
     data-paypi-success="handleSuccess">
</div>

<script>
function handleSuccess(result) {
  alert('Payment successful! ' + result.txid);
  // Redirect, show message, etc.
}
</script>
```

---

## 🐛 Troubleshooting

### Payment button doesn't appear
**Problem:** Scripts not loading  
**Solution:** Check browser console, verify URLs are correct

### "Insufficient credits" error
**Problem:** You don't have enough credits  
**Solution:** Refill credits in admin dashboard

### "Pi Browser required" error
**Problem:** Customer not using Pi Browser  
**Solution:** Customer must open page in Pi Browser app

---

## 📞 Support

- **Dashboard:** https://paypi.pages.dev/admin.html
- **Documentation:** https://docs.paypi.dev
- **Email:** support@paypi.dev
- **Issues:** https://github.com/yyk-hub/paypi-plugin/issues

---

## ❓ FAQ

**Q: Do I need to install anything?**  
A: No! Just add a `<script>` tag to your website.

**Q: Do I need a Cloudflare account?**  
A: No! We handle everything. You just use our service.

**Q: Where do payments go?**  
A: Directly to YOUR Pi wallet. We never hold your funds.

**Q: What happens if I run out of credits?**  
A: Payments will be blocked until you refill. Get a warning before this happens.

**Q: Can I test before going live?**  
A: Yes! We have a test environment. Contact support.

---

## 🎉 You're Done!

Your website now accepts Pi payments!

**Next steps:**
- Customize button appearance
- Set up webhooks (optional)
- Share your store!

---

**Need help?** Contact support@paypi.dev