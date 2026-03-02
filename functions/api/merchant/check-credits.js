// functions/api/merchant/check-credits.js
/**
 * Check if merchant has sufficient credits for payment
 * Uses secure API key validation (hashed comparison)
 */

import { validateApiKey } from '../../../lib/api-key-security.js';
import { 
  calculateCreditCost, 
  calculateCapacity,
  CREDIT_CONSTANTS 
} from '../../../lib/credits-pure-math.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Get API key from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ 
        error: 'Missing API key' 
      }, { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const providedKey = authHeader.replace('Bearer ', '');
    const { amount } = await request.json();

    // Validate API key (secure hash comparison)
    const validation = await validateApiKey(env, providedKey);
    
    if (!validation.valid) {
      return Response.json({ 
        error: validation.error 
      }, { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const merchantId = validation.merchant_id;

    // Get merchant credit balance
    const merchant = await env.DB.prepare(
      'SELECT credit_balance, payments_enabled FROM merchants WHERE merchant_id = ?'
    ).bind(merchantId).first();

    if (!merchant) {
      return Response.json({ 
        error: 'Merchant not found' 
      }, { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Calculate credits needed using pure math function
    const creditsNeeded = calculateCreditCost(amount);

    // Check if payments are enabled
    if (!merchant.payments_enabled) {
      return Response.json({
        has_credits: false,
        balance: merchant.credit_balance + ' credits',
        needed: creditsNeeded + ' credits',
        payment_amount: amount + 'π',
        capacity: calculateCapacity(merchant.credit_balance) + 'π',
        warning: 'Payments disabled. Please deposit credits.',
        refill_required: true
      }, { headers: corsHeaders });
    }

    // Check balance
    const hasEnough = merchant.credit_balance >= creditsNeeded;
    const lowBalance = merchant.credit_balance < CREDIT_CONSTANTS.LOW_BALANCE_WARNING;

    return Response.json({
      has_credits: hasEnough,
      balance: merchant.credit_balance + ' credits',
      needed: creditsNeeded + ' credits',
      payment_amount: amount + 'π',
      capacity: calculateCapacity(merchant.credit_balance) + 'π',
      fee_rate: '2%',
      warning: lowBalance ? 'Low balance. Consider refilling soon.' : null,
      refill_required: !hasEnough
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Check credits error:', error);
    return Response.json({ 
      error: error.message 
    }, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}