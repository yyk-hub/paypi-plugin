// functions/api/merchant/register.js
/**
 * Secure Merchant Registration
 * 
 * - Creates merchant profile with password authentication
 * - Generates hashed API key
 * - Hashes password with bcrypt
 * - Never stores plain-text keys or passwords
 */
import { createApiKey } from '../../../lib/api-key-security.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const {
      business_name,
      business_email,
      wallet_address,
      password  // NEW: Password for portal login
    } = await request.json();
    
    // Normalize email
    const email =
    business_email?.toLowerCase().trim();

    // Validate required fields
    if (!business_name || !email || !wallet_address) {
      return Response.json({
        error: 'Missing required fields: business_name, business_email, wallet_address'
      }, { status: 400, headers: corsHeaders });
    }

    // Validate password (if provided - for portal registration)
    if (password) {
      if (password.length < 8) {
        return Response.json({
          error: 'Password must be at least 8 characters'
        }, { status: 400, headers: corsHeaders });
      }
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
        // Dynamic import of bcryptjs
        const bcrypt = await import('bcryptjs');
        
        // Generate salt and hash password (cost factor 12)
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

    // Create merchant account with password support
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
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, unixepoch(), unixepoch())
    `).bind(
      merchantId,
      wallet_address,
      business_name,
      email,
      password_hash  // Will be null if password not provided
    ).run();

    // Create secure API key (hashed in database)
    const keyResult = await createApiKey(env, merchantId);

    console.log('✅ Merchant registered:', merchantId);
    console.log('⚠️ API key generated (show ONCE!):', keyResult.key_prefix);
    if (password_hash) {
      console.log('✅ Portal account created with password');
    }

    // Return different response based on registration type
    const response = {
      success: true,
      merchant_id: merchantId,
      
      // ⚠️ CRITICAL: This is the ONLY time the plain-text key is shown!
      api_key: keyResult.api_key,
      key_id: keyResult.key_id,
      key_prefix: keyResult.key_prefix,
      
      wallet_address: wallet_address,
      business_name: business_name,
      business_email: business_email,
      credit_balance: 0,
      
      // Credit system explanation
      credit_system: {
        formula: '1π deposit = 1 credit',
        fee: '2% per transaction (amount × 0.02 credits)',
        example: 'Deposit 200π → Process 10,000π worth of payments'
      }
    };

    // Add different messages based on registration type
    if (password) {
      // Portal registration
      response.message = 'Account created successfully! Please sign in with your email and password.';
      response.portal_login_url = `${request.url.split('/api')[0]}/merchant-portal.html`;
    } else {
      // API-only registration
      response.warning = '⚠️ SAVE YOUR API KEY NOW! It will never be shown again.';
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}