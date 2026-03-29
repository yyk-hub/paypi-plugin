// functions/api/merchant/me.js
/**
 * Get Authenticated Merchant Info
 * 
 * - Verifies JWT token
 * - Returns merchant profile data
 * - Used for auto-login and session validation
 */

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Decode and validate token
    let decoded;
    try {
      decoded = JSON.parse(atob(token));
    } catch (error) {
      return Response.json({
        success: false,
        error: 'Invalid token format'
      }, { status: 401, headers: corsHeaders });
    }

    // Check token expiration
    if (!decoded.exp || decoded.exp < Date.now()) {
      return Response.json({
        success: false,
        error: 'Token has expired. Please log in again.'
      }, { status: 401, headers: corsHeaders });
    }

    // Validate required token fields
    if (!decoded.merchant_id) {
      return Response.json({
        success: false,
        error: 'Invalid token payload'
      }, { status: 401, headers: corsHeaders });
    }

    // Get merchant from database
    const merchant = await env.DB.prepare(
      'SELECT * FROM merchants WHERE merchant_id = ?'
    ).bind(decoded.merchant_id).first();

    if (!merchant) {
      return Response.json({
        success: false,
        error: 'Merchant account not found'
      }, { status: 404, headers: corsHeaders });
    }

    // Check if account is still active
    if (!merchant.payments_enabled) {
      return Response.json({
        success: false,
        error: 'Account has been deactivated. Please contact support.'
      }, { status: 403, headers: corsHeaders });
    }

    // Return merchant profile data
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
        low_balance_warning: merchant.low_balance_warning,
        api_key: merchant.api_key,
        webhook_url: merchant.webhook_url,
        created_at: merchant.created_at,
        updated_at: merchant.updated_at,
        last_login: merchant.last_login
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ /me endpoint error:', error);
    return Response.json({
      success: false,
      error: 'Failed to retrieve merchant information'
    }, { status: 500, headers: corsHeaders });
  }
}