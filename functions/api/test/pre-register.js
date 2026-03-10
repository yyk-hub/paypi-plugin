// functions/api/test/pre-register.js
// Pre-register test orders for PayPi payment testing

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json().catch(() => ({}));
    const { order_id, user_uid, username, amount } = body;

    // Validate required fields
    if (!order_id || !user_uid || !amount) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: order_id, user_uid, amount'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📝 Pre-registering order:', {
      order_id,
      user_uid,
      username,
      amount
    });

    // Check if order already exists
    const existing = await env.DB.prepare(
      'SELECT order_id FROM paypi_orders WHERE order_id = ?'
    ).bind(order_id).first();

    if (existing) {
      console.log('⚠ Order already exists:', order_id);

      return new Response(JSON.stringify({
        success: true,
        message: 'Order already exists',
        order_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // IMPORTANT:
    // Use a test merchant ID that exists in merchants table
    const merchantId = 'test_merchant';

    // Insert order
    await env.DB.prepare(`
      INSERT INTO paypi_orders (
        order_id,
        merchant_id,
        user_uid,
        pi_username,
        total_amt,
        pi_amount,
        credits_charged,
        order_status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', unixepoch())
    `).bind(
      order_id,
      merchantId,
      user_uid,
      username || 'unknown',
      amount,
      amount,
      0
    ).run();

    console.log('✅ Order registered:', order_id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Order registered successfully',
      order_id,
      merchant_id: merchantId,
      user_uid,
      amount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('❌ Pre-register error:', err);

    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Internal error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
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