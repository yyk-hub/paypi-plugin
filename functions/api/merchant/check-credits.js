// functions/api/merchant/check-credits.js
/**
 * Check if merchant has sufficient credits for payment
 * Pure Math Credit System: 1π = 1 credit, payment costs amount × 0.02
 */

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

    const apiKey = authHeader.replace('Bearer ', '');
    const { amount } = await request.json();

    // Get merchant by API key
    const merchant = await env.DB.prepare(
      'SELECT merchant_id, credit_balance, payments_enabled FROM merchants WHERE api_key = ?'
    ).bind(apiKey).first();

    if (!merchant) {
      return Response.json({ 
        error: 'Invalid API key' 
      }, { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Calculate credits needed (Pure Math: 2% fee)
    // Payment cost = amount × 0.02
    // Example: 100π payment = 100 × 0.02 = 2 credits
    const creditsNeeded = amount * 0.02;

    // Check if payments are enabled
    if (!merchant.payments_enabled) {
      return Response.json({
        has_credits: false,
        balance: merchant.credit_balance + ' credits',
        needed: creditsNeeded + ' credits',
        payment_amount: amount + 'π',
        capacity: (merchant.credit_balance / 0.02) + 'π',
        warning: 'Payments disabled. Please deposit credits.',
        refill_required: true
      }, { headers: corsHeaders });
    }

    // Check balance
    const hasEnough = merchant.credit_balance >= creditsNeeded;
    const lowBalance = merchant.credit_balance < 20;  // < 20 credits = < 1000π capacity

    return Response.json({
      has_credits: hasEnough,
      balance: merchant.credit_balance + ' credits',
      needed: creditsNeeded + ' credits',
      payment_amount: amount + 'π',
      capacity: (merchant.credit_balance / 0.02) + 'π',
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