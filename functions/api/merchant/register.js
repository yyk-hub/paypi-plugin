// functions/api/merchant/register.js
/**
 * Secure Merchant Registration
 * 
 * - Creates merchant profile
 * - Generates hashed API key
 * - Never stores plain-text keys
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
      wallet_address
    } = await request.json();

    // Validate
    if (!business_name || !business_email || !wallet_address) {
      return Response.json({
        error: 'Missing required fields'
      }, { status: 400, headers: corsHeaders });
    }

    // Check if email exists
    const existing = await env.DB.prepare(
      'SELECT merchant_id FROM merchants WHERE business_email = ?'
    ).bind(business_email).first();

    if (existing) {
      return Response.json({
        error: 'Email already registered'
      }, { status: 400, headers: corsHeaders });
    }

    // Generate merchant ID
    const merchantId = `merch_${Date.now()}_${generateSecureKey(8)}`;

    // Create merchant account
    await env.DB.prepare(`
      INSERT INTO merchants (
        merchant_id,
        wallet_address,
        business_name,
        business_email,
        credit_balance,
        total_deposits,
        payments_enabled,
        created_at
      ) VALUES (?, ?, ?, ?, 0, 0, 0, unixepoch())
    `).bind(
      merchantId,
      wallet_address,
      business_name,
      business_email
    ).run();

    // Create secure API key (hashed in database)
    const keyResult = await createApiKey(env, merchantId);

    console.log('✅ Merchant registered:', merchantId);
    console.log('⚠️ API key generated (show ONCE!):', keyResult.key_prefix);

    return Response.json({
      success: true,
      merchant_id: merchantId,
      
      // ⚠️ CRITICAL: This is the ONLY time the plain-text key is shown!
      api_key: keyResult.api_key,
      key_id: keyResult.key_id,
      key_prefix: keyResult.key_prefix,
      
      wallet_address: wallet_address,
      credit_balance: 0,
      
      // Credit system explanation
      credit_system: {
        formula: '1π deposit = 1 credit',
        fee: '2% per transaction (amount × 0.02 credits)',
        example: 'Deposit 200π → Process 10,000π worth of payments'
      },
      
      warning: '⚠️ SAVE YOUR API KEY NOW! It will never be shown again.',
      
      next_step: 'deposit_credits',
      deposit_url: `${request.url.split('/api')[0]}/merchant/deposit?merchant_id=${merchantId}`
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Registration error:', error);
    return Response.json({ 
      error: error.message 
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