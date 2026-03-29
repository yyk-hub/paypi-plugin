export async function onRequest(context) {
  const { request, env } = context;

  // Get token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'No token' 
    }), { status: 401 });
  }

  const token = authHeader.substring(7);
  
  // Decode token
  let decoded;
  try {
    decoded = JSON.parse(atob(token));
  } catch {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid token' 
    }), { status: 401 });
  }

  // Check expiry
  if (decoded.exp < Date.now()) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Token expired' 
    }), { status: 401 });
  }

  // Get merchant
  const merchant = await env.DB.prepare(
    'SELECT * FROM merchants WHERE merchant_id = ?'
  ).bind(decoded.merchant_id).first();

  if (!merchant) {
    return new Response(JSON.stringify({ 
      success: false 
    }), { status: 404 });
  }

  return new Response(JSON.stringify({
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
      last_login: merchant.last_login
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}