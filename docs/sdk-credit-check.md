# PayPi SDK - Credit Check Integration

## 🔧 Changes Made to paypi.js

### ✅ Added Credit Check Before Payment

**Location:** `processPayment()` function

**New Flow:**
```
1. Button clicked
2. Initialize Pi SDK
3. ✨ CHECK MERCHANT CREDITS (NEW!)
4. Authenticate user
5. Create Pi payment
6. Process callbacks
```

---

## 📊 Credit Check Implementation

### Step 1: Check Credits via API

```javascript
// Before authenticating user, check if merchant has credits
const creditCheck = await fetch(`${CONFIG.apiBaseUrl}/api/merchant/check-credits`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: amount  // Payment amount in π
  })
});

const creditStatus = await creditCheck.json();
```

### Step 2: Verify Sufficient Credits

```javascript
if (!creditStatus.has_credits) {
  throw new Error('Merchant has insufficient credits. Please contact merchant to refill.');
}

// Optional: Warn if low balance
if (creditStatus.warning) {
  log('⚠️ Merchant has low credit balance');
}
```

### Step 3: Show Status to User

```javascript
// Visual feedback
button.querySelector('.paypi-text').textContent = 'Checking credits...';
showStatus(statusDiv, 'Verifying merchant balance...', 'loading');
```

---

## 🎯 Credit Check Response Format

From `/api/merchant/check-credits`:

```json
{
  "has_credits": true,
  "balance": 198,
  "needed": 2,
  "capacity": "9900π",
  "warning": false
}
```

**Fields:**
- `has_credits` - Boolean, can payment proceed?
- `balance` - Current credit balance
- `needed` - Credits needed for this payment (amount × 0.02)
- `capacity` - How much π can still be processed
- `warning` - Low balance warning (< 20 credits)

---

## 🚨 Error Messages

### Insufficient Credits
```
User sees: "⚠️ Merchant needs to refill credits. Please contact merchant."
```

**What happens:**
- Payment NOT created
- User NOT charged
- Button re-enabled
- Clear error message shown

### Low Balance Warning
```
Console: "⚠️ Merchant has low credit balance"
```

**What happens:**
- Payment CONTINUES
- Just a warning logged
- Merchant should refill soon

---

## 🔍 Debug Mode

Enable debug to see credit check details:

```html
<script src="https://your-paypi.pages.dev/sdk/v1/paypi.js" 
        data-debug="true">
</script>
```

**Console output:**
```javascript
[PayPi] Credit check: {
  needed: "2 credits",
  balance: "198 credits", 
  capacity: "9900π"
}
```

---

## 📋 Updated Payment Flow

### Complete Flow with Credit Check:

```
User clicks "Pay 10π"
         ↓
[PayPi SDK]
         ↓
Button: "Initializing..."
         ↓
Pi SDK loaded? ✅
         ↓
Button: "Checking credits..." ← NEW!
Status: "Verifying merchant balance..." ← NEW!
         ↓
API: /api/merchant/check-credits
     Request: { amount: 10 }
     Response: { has_credits: true, needed: 0.2 }
         ↓
Sufficient credits? ✅ ← NEW CHECK!
         ↓
Button: "Authenticating..."
         ↓
Pi.authenticate()
         ↓
User authenticated ✅
         ↓
Button: "Creating payment..."
         ↓
Pi.createPayment()
         ↓
[Rest of existing flow...]
```

---

## 🎨 Visual States

### 1. Checking Credits
```
Button: [π] Checking credits... (spinning icon)
Status: "Verifying merchant balance..."
```

### 2. Insufficient Credits (Error)
```
Button: [π] Pay 10π (re-enabled)
Status: "⚠️ Merchant needs to refill credits. Please contact merchant."
       (red background)
```

### 3. Credits OK (Continue)
```
Button: [π] Authenticating...
Status: "Processing payment..."
```

---

## 🔧 Benefits

### For Merchants:
- ✅ Payments blocked if no credits
- ✅ Avoids failed transactions
- ✅ Clear warning to refill

### For Customers:
- ✅ Fast feedback (no waiting)
- ✅ Clear error messages
- ✅ Not charged if merchant has no credits

### For PayPi:
- ✅ No orphaned payments
- ✅ Clean error handling
- ✅ Better user experience

---

## 🚀 Deployment

**No API changes needed** - the `/api/merchant/check-credits` endpoint already exists!

Just update the SDK file:
1. Replace `public/sdk/v1/paypi.js` with updated version
2. Deploy: `wrangler pages deploy public`
3. Test in Pi Browser

---

## 🧪 Testing

### Test 1: Normal Payment (Sufficient Credits)
```
Merchant balance: 200 credits
Payment: 10π
Expected: ✅ Payment proceeds normally
```

### Test 2: Insufficient Credits
```
Merchant balance: 0.1 credits
Payment: 10π (needs 0.2 credits)
Expected: ❌ Error shown, payment not created
```

### Test 3: Low Balance Warning
```
Merchant balance: 15 credits
Payment: 10π
Expected: ⚠️ Warning logged, payment proceeds
```

---

## 📊 Performance Impact

**Credit check adds:**
- ~200-300ms (one API call)
- Happens BEFORE Pi authentication
- Much faster than letting payment fail later

**Total flow time:**
- Before: ~3-5 seconds
- After: ~3.5-5.5 seconds
- **+0.5s** for better UX and error prevention

---

## 🔄 Backward Compatibility

**100% compatible** with existing implementations:

- Old SDK: Works without credit check (legacy)
- New SDK: Works with credit check (recommended)
- API: Handles both versions
- No breaking changes

---

## ✅ Summary

**What changed:**
1. Added credit check API call before authentication
2. Better error messages for credit issues
3. Visual feedback during credit check
4. Debug logging for credit status

**What stayed the same:**
- All other payment flow
- API endpoints
- Database schema
- Merchant integration code

**Result:**
Better UX, fewer failed payments, clear error messages! 🎉