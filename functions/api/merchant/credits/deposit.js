// functions/api/merchant/credits/deposit.js
/**
 * Merchant Credit Deposit
 * 
 * Creates a Pi payment from merchant to platform
 * When completed, credits are added to merchant account
 */

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json({
      success: false,
      error: 'Method not allowed'
    }, { status: 405, headers: corsHeaders });
  }

  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({
        success: false,
        error: 'No authorization token provided'
      }, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.substring(7);

    // Decode token
    let decoded;
    try {
      decoded = JSON.parse(atob(token));
    } catch {
      return Response.json({
        success: false,
        error: 'Invalid token'
      }, { status: 401, headers: corsHeaders });
    }

    // Check token expiration
    if (decoded.exp < Date.now()) {
      return Response.json({
        success: false,
        error: 'Token expired'
      }, { status: 401, headers: corsHeaders });
    }

    const merchant_id = decoded.merchant_id;

    // Get deposit amount
    const { amount } = await request.json();

    if (!amount || isNaN(amount) || amount <= 0) {
      return Response.json({
        success: false,
        error: 'Invalid deposit amount'
      }, { status: 400, headers: corsHeaders });
    }

    // Minimum deposit: 10π
    if (amount < 10) {
      return Response.json({
        success: false,
        error: 'Minimum deposit is 10π'
      }, { status: 400, headers: corsHeaders });
    }

    // Get merchant info
    const merchant = await env.DB.prepare(
      'SELECT * FROM merchants WHERE merchant_id = ?'
    ).bind(merchant_id).first();

    if (!merchant) {
      return Response.json({
        success: false,
        error: 'Merchant not found'
      }, { status: 404, headers: corsHeaders });
    }

    // Generate unique payment ID for this deposit
    const depositId = `deposit_${Date.now()}_${generateSecureKey(8)}`;

    // Create deposit record (pending status)
    await env.DB.prepare(`
      INSERT INTO credit_deposits (
        deposit_id,
        merchant_id,
        amount,
        credits,
        status,
        pi_payment_id,
        created_at
      ) VALUES (?, ?, ?, ?, 'pending', NULL, unixepoch())
    `).bind(
      depositId,
      merchant_id,
      amount,
      amount  // 1π = 1 credit
    ).run();

    console.log('✅ Credit deposit initiated:', depositId, merchant_id, amount);

    // Return payment details for Pi SDK
    return Response.json({
      success: true,
      deposit_id: depositId,
      amount: amount,
      credits: amount,
      
      // Pi Payment configuration
      payment_config: {
        amount: amount,
        memo: `Credit deposit for ${merchant.business_name}`,
        metadata: {
          type: 'credit_deposit',
          deposit_id: depositId,
          merchant_id: merchant_id
        }
      },
      
      // Platform wallet (merchant pays TO this address)
      platform_wallet: env.PLATFORM_WALLET_ADDRESS || 'PLATFORM_WALLET_HERE',
      
      // Callback URL for Pi SDK
      callback_url: `${new URL(request.url).origin}/api/merchant/credits/deposit/complete`
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Credit deposit error:', error);
    return Response.json({
      success: false,
      error: 'Failed to create deposit'
    }, { status: 500, headers: corsHeaders });
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