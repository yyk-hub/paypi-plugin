// functions/api/merchant/profile.js
/**
 * Update Merchant Profile
 * Allows updating business_name, business_email, wallet_address
 */

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow PUT
  if (request.method !== 'PUT') {
    return Response.json({
      success: false,
      error: 'Method not allowed. Use PUT.'
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

    // Get update data
    const { business_name, business_email, wallet_address } = await request.json();

    // Validate inputs
    if (!business_name || !business_email || !wallet_address) {
      return Response.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400, headers: corsHeaders });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(business_email)) {
      return Response.json({
        success: false,
        error: 'Invalid email format'
      }, { status: 400, headers: corsHeaders });
    }

    // Check if email is already used by another merchant
    const existing = await env.DB.prepare(
      'SELECT merchant_id FROM merchants WHERE business_email = ? AND merchant_id != ?'
    ).bind(business_email, merchant_id).first();

    if (existing) {
      return Response.json({
        success: false,
        error: 'Email already registered to another account'
      }, { status: 400, headers: corsHeaders });
    }

    // Update merchant profile
    await env.DB.prepare(`
      UPDATE merchants 
      SET business_name = ?,
          business_email = ?,
          wallet_address = ?,
          updated_at = unixepoch()
      WHERE merchant_id = ?
    `).bind(
      business_name,
      business_email,
      wallet_address,
      merchant_id
    ).run();

    console.log('✅ Profile updated:', merchant_id);

    // Get updated merchant data
    const merchant = await env.DB.prepare(
      'SELECT * FROM merchants WHERE merchant_id = ?'
    ).bind(merchant_id).first();

    return Response.json({
      success: true,
      merchant: {
        merchant_id: merchant.merchant_id,
        business_name: merchant.business_name,
        business_email: merchant.business_email,
        wallet_address: merchant.wallet_address,
        credit_balance: merchant.credit_balance,
        total_deposits: merchant.total_deposits,
        total_processed: merchant.total_processed,
        payments_enabled: merchant.payments_enabled,
        webhook_url: merchant.webhook_url,
        api_key: merchant.api_key,
        created_at: merchant.created_at,
        updated_at: merchant.updated_at
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Profile update error:', error);
    return Response.json({
      success: false,
      error: 'Failed to update profile'
    }, { status: 500, headers: corsHeaders });
  }
}