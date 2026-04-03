// functions/api/merchant/refunds.js
/**
 * List Refunds for Merchant
 * Returns all refunds for the authenticated merchant
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

    // Query refunds for this merchant
    // Join with paypi_orders to get merchant_id
    const refunds = await env.DB.prepare(`
      SELECT r.* 
      FROM refunds r
      INNER JOIN paypi_orders o ON r.order_id = o.order_id
      WHERE o.merchant_id = ?
      ORDER BY r.created_at DESC
      LIMIT 100
    `).bind(decoded.merchant_id).all();

    return Response.json({
      success: true,
      refunds: refunds.results || []
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Refunds endpoint error:', error);
    return Response.json({
      success: false,
      error: 'Failed to retrieve refunds'
    }, { status: 500, headers: corsHeaders });
  }
}