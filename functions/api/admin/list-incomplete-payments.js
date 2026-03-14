// functions/api/admin/list-incomplete-payments.js
/**
 * List Incomplete Payments
 * 
 * Get all incomplete payments that need to be completed or cancelled
 */

export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    console.log('📋 Fetching incomplete payments...');

    // Get incomplete payments from Pi Platform
    const isTestnet = env.PI_NETWORK === 'testnet';
    const piPlatformUrl = 'https://api.minepi.com';

    const listResponse = await fetch(
      `${piPlatformUrl}/v2/payments/incomplete_server_payments`,
      {
        headers: {
          'Authorization': `Key ${env.PI_API_KEY}`
        }
      }
    );

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      throw new Error(`Failed to fetch incomplete payments: ${errorText}`);
    }

    const payments = await listResponse.json();

    console.log(`✅ Found ${payments.length || 0} incomplete payments`);

    return Response.json({
      success: true,
      count: payments.length || 0,
      payments: payments,
      message: 'Incomplete payments retrieved successfully'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ List error:', error);
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}