export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false }), { status: 405 });
  }

  const { business_email, password } = await request.json();

  // Find merchant
  const merchant = await env.DB.prepare(
    'SELECT * FROM merchants WHERE business_email = ?'
  ).bind(business_email).first();

  if (!merchant || !merchant.password_hash) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid credentials' 
    }), { status: 401 });
  }

  // Verify password (install bcryptjs: npm install bcryptjs)
  const bcrypt = await import('bcryptjs');
  const isValid = await bcrypt.compare(password, merchant.password_hash);

  if (!isValid) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid credentials' 
    }), { status: 401 });
  }

  // Update last login
  await env.DB.prepare(
    'UPDATE merchants SET last_login = ? WHERE merchant_id = ?'
  ).bind(Math.floor(Date.now() / 1000), merchant.merchant_id).run();

  // Simple token (improve with JWT later)
  const token = btoa(JSON.stringify({
    merchant_id: merchant.merchant_id,
    email: merchant.business_email,
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
  }));

  return new Response(JSON.stringify({
    success: true,
    token,
    merchant: {
      merchant_id: merchant.merchant_id,
      business_name: merchant.business_name,
      business_email: merchant.business_email,
      wallet_address: merchant.wallet_address,
      credit_balance: merchant.credit_balance,
      api_key: merchant.api_key
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}