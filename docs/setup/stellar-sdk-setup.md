# 🌟 Stellar SDK Setup for Cloudflare Workers/Pages

## ⚠️ CRITICAL: Why Standard Setup Doesn't Work

Cloudflare Workers/Pages have **no Node.js runtime**. They only support:
- ✅ Web APIs (fetch, Response, Request, etc.)
- ❌ NO Node modules (fs, http, net, crypto, etc.)
- ❌ NO EventSource
- ❌ NO axios (uses Node http module)

**Standard Stellar SDK breaks** because it uses:
- `eventsource` for streaming
- `axios` for HTTP (which uses Node http module)

---

## ✅ Solution: Use Special Branch + Adapter

Official Stellar team provides `make-eventsource-optional` branch that:
1. Makes EventSource optional
2. Allows custom axios adapter
3. Works with fetch (which IS available in CF Workers)

---

## 📦 Required Dependencies

```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "git+https://github.com/stellar/js-stellar-sdk#make-eventsource-optional",
    "@vespaiach/axios-fetch-adapter": "^0.3.1",
    "axios": "^0.26.1"
  },
  "overrides": {
    "@stellar/stellar-sdk": {
      "axios": "$axios"
    }
  }
}
```

### Why Each Dependency:

**1. `@stellar/stellar-sdk` (special branch)**
- Uses the `make-eventsource-optional` branch
- EventSource is now optional (not required)
- Allows axios adapter override

**2. `@vespaiach/axios-fetch-adapter`**
- Bridges axios to fetch API
- Axios calls internally use fetch
- Fetch IS available in CF Workers

**3. `axios@^0.26.1`**
- Specific version required by adapter
- Newer axios versions don't work with adapter
- Must be <= 1.0.0

**4. `overrides` block**
- Forces Stellar SDK to use YOUR axios version
- Prevents version conflicts
- Ensures compatibility

---

## 🔧 Required Initialization Code

### Step 1: Create Stellar Init File

**File:** `lib/stellar-init.js`

```javascript
import { Horizon } from '@stellar/stellar-sdk';
import fetchAdapter from '@vespaiach/axios-fetch-adapter';

// CRITICAL: Override axios adapter to use fetch
Horizon.AxiosClient.defaults.adapter = fetchAdapter;

console.log('✅ Stellar SDK initialized for Cloudflare');

export { Horizon };
```

### Step 2: Import in Your Functions

**DO THIS:**
```javascript
// ✅ CORRECT - Import from stellar-init.js
import { Horizon } from '../../../lib/stellar-init.js';
import { Keypair, TransactionBuilder, Operation } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://api.testnet.minepi.com');
// Now uses fetch! ✅
```

**DON'T DO THIS:**
```javascript
// ❌ WRONG - Direct import breaks in CF Workers
import { Horizon } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://api.testnet.minepi.com');
// Will fail with axios errors! ❌
```

---

## 📝 Complete Example

**File:** `functions/api/test-stellar.js`

```javascript
// STEP 1: Import initialized Horizon
import { Horizon } from '../../../lib/stellar-init.js';

// STEP 2: Import other Stellar components normally
import { 
  Keypair, 
  TransactionBuilder, 
  Operation, 
  Asset,
  Networks,
  Memo
} from '@stellar/stellar-sdk';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Initialize server (uses fetch adapter now!)
    const server = new Horizon.Server('https://api.testnet.minepi.com');
    
    // Load account (HTTP call uses fetch!)
    const account = await server.loadAccount('GXXXXXXX...');
    
    // Create transaction
    const transaction = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(
        Operation.payment({
          destination: 'GYYYYYYY...',
          asset: Asset.native(),
          amount: '10'
        })
      )
      .setTimeout(30)
      .build();
    
    // Sign
    const keypair = Keypair.fromSecret(env.SECRET_KEY);
    transaction.sign(keypair);
    
    // Submit (HTTP call uses fetch!)
    const result = await server.submitTransaction(transaction);
    
    return Response.json({
      success: true,
      hash: result.hash
    });
    
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
}
```

---

## 🧪 Testing

### Local Development
```bash
npm install
wrangler pages dev public --compatibility-flag=nodejs_compat
```

### Test Stellar Integration
```bash
curl http://localhost:8788/api/test-stellar
```

**Expected:** Should work without axios errors

---

## ⚠️ Common Errors & Solutions

### Error 1: "Cannot find module 'eventsource'"
**Cause:** Using standard Stellar SDK branch  
**Fix:** Use `make-eventsource-optional` branch

### Error 2: "adapter is not a function"
**Cause:** Forgot to initialize fetch adapter  
**Fix:** Import from `lib/stellar-init.js`

### Error 3: "axios version conflict"
**Cause:** Wrong axios version  
**Fix:** Use `axios@^0.26.1` specifically

### Error 4: "Network request failed"
**Cause:** Adapter not set before first HTTP call  
**Fix:** Import `Horizon` from init file FIRST

---

## 📊 How It Works

```
Your Code
    ↓
Import { Horizon } from lib/stellar-init.js
    ↓
Horizon.AxiosClient.defaults.adapter = fetchAdapter
    ↓
Stellar SDK makes HTTP call via axios
    ↓
axios uses fetch adapter (instead of Node http)
    ↓
fetch API (available in CF Workers) ✅
    ↓
Success!
```

---

## ✅ Verification Checklist

Before deploying:

- [ ] Using `make-eventsource-optional` branch
- [ ] `axios@^0.26.1` in dependencies
- [ ] `axios-fetch-adapter` installed
- [ ] `overrides` block in package.json
- [ ] Created `lib/stellar-init.js`
- [ ] Import `Horizon` from init file
- [ ] Tested locally with `wrangler pages dev`
- [ ] No axios or EventSource errors

---

## 🎯 Summary

**For Cloudflare Workers/Pages + Stellar SDK:**

1. ✅ Use special branch: `make-eventsource-optional`
2. ✅ Install axios + fetch adapter
3. ✅ Override axios adapter in init file
4. ✅ Import Horizon from init file
5. ✅ All HTTP calls now use fetch

**Without this setup:** Stellar SDK will crash in CF Workers  
**With this setup:** Everything works perfectly ✅

---

## 📚 References

- [Stellar SDK Cloudflare Guide](https://github.com/stellar/js-stellar-sdk/tree/make-eventsource-optional)
- [axios-fetch-adapter](https://github.com/vespaiach/axios-fetch-adapter)
- [Cloudflare Workers Runtime](https://developers.cloudflare.com/workers/runtime-apis/)

---

**This setup is REQUIRED for PayPi to work!** 🚀