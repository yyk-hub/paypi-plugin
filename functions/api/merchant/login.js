// functions/api/merchant/login.js
/**
 * Merchant Portal Login
 * 
 * - Authenticates merchant with email + password
 * - Generates JWT token for session
 * - Updates last_login timestamp
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { business_email, password } = await request.json();
    
    // Normalize email
    const email = business_email?.toLowerCase().trim();
    
    // Validate input
    if (!email || !password) {
      return Response.json({
        success: false,
        error: 'Email and password are required'
      }, { status: 400, headers: corsHeaders });
    }

    // Find merchant by email
    const merchant = await env.DB.prepare(
      'SELECT * FROM merchants WHERE business_email = ?'
    ).bind(email).first();

    if (!merchant) {
      return Response.json({
        success: false,
        error: 'Invalid email or password'
      }, { status: 401, headers: corsHeaders });
    }

    // Check if password is set
    if (!merchant.password_hash) {
      return Response.json({
        success: false,
        error: 'Portal access not enabled for this account. Please contact support.'
      }, { status: 401, headers: corsHeaders });
    }

    // Verify password
    try {
      const bcrypt = await import('bcryptjs');
      const isValid = await bcrypt.compare(password, merchant.password_hash);

      if (!isValid) {
        return Response.json({
          success: false,
          error: 'Invalid email or password'
        }, { status: 401, headers: corsHeaders });
      }
    } catch (error) {
      console.error('❌ Password verification error:', error);
      return Response.json({
        success: false,
        error: 'Authentication failed. Please try again.'
      }, { status: 500, headers: corsHeaders });
    }

    // Check if account is active
    if (!merchant.payments_enabled) {
      return Response.json({
        success: false,
        error: 'Account is not activated. Please contact support.'
      }, { status: 403, headers: corsHeaders });
    }

    // Update last login timestamp
    await env.DB.prepare(
      'UPDATE merchants SET last_login = unixepoch() WHERE merchant_id = ?'
    ).bind(merchant.merchant_id).run();

    // Generate session token (simple version using base64)
    // TODO: Replace with proper JWT library for production
    const tokenPayload = {
      merchant_id: merchant.merchant_id,
      business_email: merchant.business_email,
      iat: Date.now(),
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    const token = btoa(JSON.stringify(tokenPayload));

    console.log('✅ Merchant logged in:', merchant.merchant_id);

    // Return success with token and merchant data
    return Response.json({
      success: true,
      token,
      merchant: {
        merchant_id: merchant.merchant_id,
        business_name: merchant.business_name,
        business_email: merchant.business_email,
        wallet_address: merchant.wallet_address,
        credit_balance: merchant.credit_balance,
        total_deposits: merchant.total_deposits,
        total_processed: merchant.total_processed,
        payments_enabled: merchant.payments_enabled,
        api_key: merchant.api_key,
        webhook_url: merchant.webhook_url,
        created_at: merchant.created_at
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Login error:', error);
    return Response.json({
      success: false,
      error: 'Login failed. Please try again.'
    }, { status: 500, headers: corsHeaders });
  }
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