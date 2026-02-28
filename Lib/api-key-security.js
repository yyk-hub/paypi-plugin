// lib/api-key-security.js
/**
 * Secure API Key Management
 * 
 * - Never stores plain-text keys
 * - Uses SHA-256 hashing
 * - Supports key rotation
 * - Audit logging
 */

/**
 * Generate a secure API key
 * Format: pk_live_[32_random_chars]
 */
export function generateApiKey() {
  const prefix = 'pk_live_';
  const randomPart = generateSecureRandom(32);
  return prefix + randomPart;
}

/**
 * Generate secure random string
 */
function generateSecureRandom(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

/**
 * Hash API key using SHA-256
 * NEVER store the plain-text key!
 */
export async function hashApiKey(apiKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Extract key prefix for display
 * Example: 'pk_live_abc...' → 'pk_live_abc'
 */
export function getKeyPrefix(apiKey) {
  // Show first 12 characters (includes pk_live_)
  return apiKey.substring(0, 12) + '...';
}

/**
 * Verify API key against hash
 */
export async function verifyApiKey(providedKey, storedHash) {
  const providedHash = await hashApiKey(providedKey);
  return providedHash === storedHash;
}

/**
 * Create new API key for merchant
 */
export async function createApiKey(env, merchantId) {
  // Generate new key
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);
  const keyPrefix = getKeyPrefix(apiKey);
  const keyId = `key_${Date.now()}_${generateSecureRandom(8)}`;
  
  // Store hash in database
  await env.DB.prepare(`
    INSERT INTO merchant_api_keys (
      key_id,
      merchant_id,
      api_key_hash,
      key_prefix,
      created_at
    ) VALUES (?, ?, ?, ?, unixepoch())
  `).bind(keyId, merchantId, apiKeyHash, keyPrefix).run();
  
  // Log creation
  await logSecurityEvent(env, merchantId, 'api_key_created', {
    key_id: keyId,
    key_prefix: keyPrefix
  });
  
  // Return plain-text key ONCE (never stored!)
  return {
    key_id: keyId,
    api_key: apiKey,  // ⚠️ Show this to user ONCE, never again!
    key_prefix: keyPrefix
  };
}

/**
 * Validate API key from request
 */
export async function validateApiKey(env, providedKey) {
  if (!providedKey) {
    return { valid: false, error: 'No API key provided' };
  }
  
  // Hash the provided key
  const providedHash = await hashApiKey(providedKey);
  
  // Look up in database
  const result = await env.DB.prepare(`
    SELECT k.*, m.merchant_id, m.payments_enabled
    FROM merchant_api_keys k
    JOIN merchants m ON k.merchant_id = m.merchant_id
    WHERE k.api_key_hash = ? AND k.is_revoked = 0
  `).bind(providedHash).first();
  
  if (!result) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  // Check expiration
  if (result.expires_at && result.expires_at < Date.now() / 1000) {
    return { valid: false, error: 'API key expired' };
  }
  
  // Update last used
  await env.DB.prepare(`
    UPDATE merchant_api_keys
    SET last_used_at = unixepoch()
    WHERE key_id = ?
  `).bind(result.key_id).run();
  
  // Log usage
  await logSecurityEvent(env, result.merchant_id, 'api_key_used', {
    key_id: result.key_id,
    key_prefix: result.key_prefix
  }, 'info');
  
  return {
    valid: true,
    merchant_id: result.merchant_id,
    key_id: result.key_id,
    payments_enabled: result.payments_enabled
  };
}

/**
 * Revoke API key
 */
export async function revokeApiKey(env, keyId, merchantId) {
  await env.DB.prepare(`
    UPDATE merchant_api_keys
    SET is_revoked = 1
    WHERE key_id = ? AND merchant_id = ?
  `).bind(keyId, merchantId).run();
  
  await logSecurityEvent(env, merchantId, 'api_key_revoked', {
    key_id: keyId
  }, 'warning');
}

/**
 * Log security event
 */
async function logSecurityEvent(env, merchantId, eventType, details, severity = 'info') {
  const logId = `log_${Date.now()}_${generateSecureRandom(8)}`;
  
  await env.DB.prepare(`
    INSERT INTO security_audit_log (
      log_id,
      merchant_id,
      event_type,
      details,
      severity,
      created_at
    ) VALUES (?, ?, ?, ?, ?, unixepoch())
  `).bind(
    logId,
    merchantId,
    eventType,
    JSON.stringify(details),
    severity
  ).run();
}

/**
 * Get merchant's API keys (hashed, never plain-text)
 */
export async function getMerchantKeys(env, merchantId) {
  const keys = await env.DB.prepare(`
    SELECT 
      key_id,
      key_prefix,
      last_used_at,
      created_at,
      expires_at,
      is_revoked
    FROM merchant_api_keys
    WHERE merchant_id = ?
    ORDER BY created_at DESC
  `).bind(merchantId).all();
  
  return keys.results || [];
}