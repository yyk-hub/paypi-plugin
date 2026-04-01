// functions/api/merchant/register.js
/**
 * Secure Merchant Registration (CLEAN ARCHITECTURE)
 * 
 * - Creates merchant profile with password authentication
 * - Generates hashed API key in SEPARATE api_keys table
 * - Hashes password with bcrypt
 * - Smart activation: Portal users (with password) auto-activated
 * - Never stores plain-text keys or passwords
 */
import { createApiKey } from '../../../lib/api-key-security.js';

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return Response.json({
      error: 'Method not allowed. Use POST.'
    }, { status: 405, headers: corsHeaders });
  }

  try {
    const {
      business_name,
      business_email,
      wallet_address,
      password  // Portal login password (optional)
    } = await request.json();

    // Normalize email
    const email = business_email?.toLowerCase().trim();

    // Validate required fields
    if (!business_name || !email || !wallet_address) {
      return Response.json({
        error: 'Missing required fields: business_name, business_email, wallet_address'
      }, { status: 400, headers: corsHeaders });
    }

    // Validate password (if provided - for portal registration)
    if (password && password.length < 8) {
      return Response.json({
        error: 'Password must be at least 8 characters'
      }, { status: 400, headers: corsHeaders });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({
        error: 'Invalid email format'
      }, { status: 400, headers: corsHeaders });
    }

    // Check if email exists
    const existing = await env.DB.prepare(
      'SELECT merchant_id FROM merchants WHERE business_email = ?'
    ).bind(email).first();

    if (existing) {
      return Response.json({
        error: 'Email already registered'
      }, { status: 400, headers: corsHeaders });
    }

    // Generate merchant ID
    const merchantId = `merch_${Date.now()}_${generateSecureKey(8)}`;

    // Hash password if provided (for portal users)
    let password_hash = null;
    if (password) {
      try {
        const bcrypt = await import('bcryptjs');
        const salt = await bcrypt.genSalt(12);
        password_hash = await bcrypt.hash(password, salt);
        
        console.log('✅ Password hashed for merchant:', merchantId);
      } catch (error) {
        console.error('❌ Password hashing error:', error);
        return Response.json({
          error: 'Password hashing failed. Please try again.'
        }, { status: 500, headers: corsHeaders });
      }
    }

    // SMART ACTIVATION LOGIC:
    // Portal users (with password) → auto-activate (payments_enabled = 1)
    // API-only users (no password) → manual approval (payments_enabled = 0)
    const payments_enabled = password ? 1 : 0;

    // Create merchant account
    await env.DB.prepare(`
      INSERT INTO merchants (
        merchant_id,
        wallet_address,
        business_name,
        business_email,
        password_hash,
        credit_balance,
        total_deposits,
        total_processed,
        payments_enabled,
        low_balance_warning,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, 0, unixepoch(), unixepoch())
    `).bind(
      merchantId,
      wallet_address,
      business_name,
      email,
      password_hash,
      payments_enabled  // Smart activation
    ).run();

    // Create secure API key in SEPARATE api_keys table (hashed)
    // This uses your existing createApiKey() function
    const keyResult = await createApiKey(env, merchantId);

    // HYBRID APPROACH: Store key_prefix in merchants table for UI convenience
    // This allows portal to display key without JOIN to api_keys table
    await env.DB.prepare(`
      UPDATE merchants SET api_key = ? WHERE merchant_id = ?
    `).bind(
      keyResult.key_prefix,  // Store PREFIX only, not full key!
      merchantId
    ).run();

    console.log('✅ Merchant registered:', merchantId);
    console.log('✅ API key created (hashed in api_keys table):', keyResult.key_prefix);
    console.log('✅ Key prefix stored in merchants.api_key for UI display');
    if (password_hash) {
      console.log('✅ Portal account created (auto-activated)');
    } else {
      console.log('⚠️ API-only account (requires manual activation)');
    }

    // Build response
    const response = {
      success: true,
      merchant_id: merchantId,
      
      // ⚠️ CRITICAL: Plain-text API key shown ONLY ONCE!
      // After this, only key_prefix is visible
      api_key: keyResult.api_key,
      key_id: keyResult.key_id,
      key_prefix: keyResult.key_prefix,
      
      business_name: business_name,
      business_email: email,
      wallet_address: wallet_address,
      credit_balance: 0,
      payments_enabled: payments_enabled,
      
      // Credit system explanation
      credit_system: {
        formula: '1π deposit = 1 credit',
        fee: '2% per transaction (amount × 0.02 credits)',
        example: 'Deposit 200π → Process 10,000π worth of payments'
      }
    };

    // Different messages based on registration type
    if (password) {
      // Portal registration - auto-activated
      response.message = 'Account created and activated! Please sign in with your email and password.';
      response.portal_login_url = `${request.url.split('/api')[0]}/merchant-portal.html`;
      response.status = 'active';
    } else {
      // API-only registration - manual approval
      response.warning = '⚠️ SAVE YOUR API KEY NOW! It will never be shown again.';
      response.message = 'Account created. Please deposit credits to start processing payments.';
      response.status = 'pending_activation';
      response.next_step = 'deposit_credits';
      response.deposit_url = `${request.url.split('/api')[0]}/merchant/deposit?merchant_id=${merchantId}`;
    }

    return Response.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Registration error:', error);
    
    // Check for duplicate key error
    if (error.message && error.message.includes('UNIQUE constraint')) {
      return Response.json({ 
        error: 'Email already registered' 
      }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }
    
    return Response.json({ 
      error: 'Registration failed. Please try again.' 
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

function generateSecureKey(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
}