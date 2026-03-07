// lib/idempotency.js
/**
 * Idempotency Key Management
 * Prevents duplicate API requests (industry standard pattern)
 * 
 * Pattern used by: Stripe, PayPal, Square
 */

/**
 * Check if request has already been processed
 * Returns cached response if idempotency key exists
 * 
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} idempotencyKey - Unique request identifier
 * @param {string} merchantId - Merchant ID for scoping
 * @returns {Object|null} Cached response or null
 */
export async function checkIdempotency(env, idempotencyKey, merchantId) {
  if (!idempotencyKey) {
    return null;  // No idempotency key provided
  }
  
  try {
    // Look up existing response (not expired)
    const cached = await env.DB.prepare(`
      SELECT response FROM idempotency_keys
      WHERE key = ? AND merchant_id = ? AND expires_at > unixepoch()
    `).bind(idempotencyKey, merchantId).first();
    
    if (cached) {
      console.log('✅ Idempotency: Returning cached response for key:', idempotencyKey);
      return JSON.parse(cached.response);
    }
    
    return null;  // No cached response found
  } catch (error) {
    console.error('⚠️ Idempotency check error:', error);
    return null;  // On error, proceed with request (fail open)
  }
}

/**
 * Store response for future duplicate requests
 * Expires after 24 hours
 * 
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} idempotencyKey - Unique request identifier
 * @param {string} merchantId - Merchant ID for scoping
 * @param {string} endpoint - API endpoint name
 * @param {Object} response - Response to cache
 */
export async function storeIdempotency(env, idempotencyKey, merchantId, endpoint, response) {
  if (!idempotencyKey) {
    return;  // No idempotency key to store
  }
  
  try {
    await env.DB.prepare(`
      INSERT OR REPLACE INTO idempotency_keys (
        key, merchant_id, endpoint, response, created_at, expires_at
      ) VALUES (?, ?, ?, ?, unixepoch(), unixepoch() + 86400)
    `).bind(
      idempotencyKey,
      merchantId,
      endpoint,
      JSON.stringify(response)
    ).run();
    
    console.log('✅ Idempotency: Stored key:', idempotencyKey, 'for endpoint:', endpoint);
  } catch (error) {
    console.error('⚠️ Idempotency store error:', error);
    // Don't fail the request if storage fails
  }
}

/**
 * Generate a unique idempotency key
 * Format: idem_{timestamp}_{random}
 * 
 * @returns {string} Idempotency key
 */
export function generateIdempotencyKey() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `idem_${timestamp}_${random}`;
}