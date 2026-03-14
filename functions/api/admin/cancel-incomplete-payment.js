// functions/api/admin/cancel-incomplete-payment.js
/**
 * Cancel Incomplete Payment
 * 
 * Use this to cancel stuck/incomplete payments that are blocking new refunds
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Admin auth
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || token !== env.ADMIN_TOKEN) {
      return Response.json({
        error: 'Unauthorized'
      }, { status: 401, headers: corsHeaders });
    }

    const { payment_id } = await request.json();

    if (!payment_id) {
      return Response.json({
        error: 'Missing payment_id'
      }, { status: 400, headers: corsHeaders });
    }

    console.log('🗑️ Cancelling incomplete payment:', payment_id);

    // Cancel payment on Pi Platform
    const isTestnet = env.PI_NETWORK === 'testnet';
    const piPlatformUrl = 'https://api.minepi.com';

    const cancelResponse = await fetch(
      `${piPlatformUrl}/v2/payments/${payment_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.PI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!cancelResponse.ok) {
      const errorText = await cancelResponse.text();
      throw new Error(`Failed to cancel payment: ${errorText}`);
    }

    const result = await cancelResponse.json();

    console.log('✅ Payment cancelled:', result);

    return Response.json({
      success: true,
      payment_id,
      message: 'Payment cancelled successfully',
      result
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Cancel error:', error);
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