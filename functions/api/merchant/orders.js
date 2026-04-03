// functions/api/merchant/orders.js
/**
 * Portal-friendly wrapper for list-orders
 * Accepts Bearer token authentication
 */

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS
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

    const token = authHeader.substring(7);

    // Decode token to get merchant_id
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

    // Query orders for this merchant
    const orders = await env.DB.prepare(`
      SELECT * FROM paypi_orders 
      WHERE merchant_id = ? 
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(decoded.merchant_id).all();

    return Response.json({
      success: true,
      orders: orders.results || []
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Orders endpoint error:', error);
    return Response.json({
      success: false,
      error: 'Failed to retrieve orders'
    }, { status: 500, headers: corsHeaders });
  }
}