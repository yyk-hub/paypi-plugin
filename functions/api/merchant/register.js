// functions/api/merchant/register.js
/**
 * Merchant Registration with Prepaid Credit Model
 * 
 * Flow:
 * 1. Merchant provides business info + wallet address
 * 2. System generates API key
 * 3. Merchant deposits π for credits
 * 4. Credits added to account
 * 5. Can start accepting payments
 */

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
      initial_deposit  // Optional: Deposit during registration
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

    // Generate IDs
    const merchantId = `merch_${Date.now()}_${generateSecureKey(8)}`;
    const apiKey = `pk_live_${generateSecureKey(32)}`;

    // Create merchant account
    await env.DB.prepare(`
      INSERT INTO merchants (
        merchant_id,
        api_key,
        wallet_address,
        business_name,
        business_email,
        credit_balance,
        total_deposits,
        payments_enabled,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      merchantId,
      apiKey,
      wallet_address,
      business_name,
      business_email,
      0,  // Start with 0 credits
      0,  // No deposits yet
      0   // Payments disabled until deposit
    ).run();

    console.log('✅ Merchant registered:', merchantId);

    return Response.json({
      success: true,
      merchant_id: merchantId,
      api_key: apiKey,
      wallet_address: wallet_address,
      credit_balance: 0,
      message: 'Registration successful! Deposit π to add credits and start accepting payments.',
      credit_system: {
        formula: '1π deposit = 1 credit',
        fee: '2% per transaction (amount × 0.02 credits)',
        example: 'Deposit 200π → Process 10,000π worth of payments'
      },
      next_step: 'deposit_credits',
      deposit_url: `${env.PLATFORM_URL || request.url.split('/api')[0]}/merchant/deposit?merchant_id=${merchantId}`
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