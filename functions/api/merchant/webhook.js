// functions/api/merchant/webhook.js
/**
 * Webhook Configuration Endpoint
 * GET - Retrieve webhook URL
 * PUT - Update webhook URL
 */

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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

    const merchant_id = decoded.merchant_id;

    // GET - Retrieve webhook URL
    if (request.method === 'GET') {
      const merchant = await env.DB.prepare(
        'SELECT webhook_url FROM merchants WHERE merchant_id = ?'
      ).bind(merchant_id).first();

      if (!merchant) {
        return Response.json({
          success: false,
          error: 'Merchant not found'
        }, { status: 404, headers: corsHeaders });
      }

      return Response.json({
        success: true,
        webhook_url: merchant.webhook_url || ''
      }, { headers: corsHeaders });
    }

    // PUT - Update webhook URL
    if (request.method === 'PUT') {
      const { webhook_url } = await request.json();

      // Validate webhook URL (if provided)
      if (webhook_url && webhook_url.trim()) {
        try {
          const url = new URL(webhook_url);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return Response.json({
              success: false,
              error: 'Webhook URL must use HTTP or HTTPS'
            }, { status: 400, headers: corsHeaders });
          }
        } catch {
          return Response.json({
            success: false,
            error: 'Invalid webhook URL format'
          }, { status: 400, headers: corsHeaders });
        }
      }

      // Update webhook URL
      await env.DB.prepare(
        'UPDATE merchants SET webhook_url = ?, updated_at = unixepoch() WHERE merchant_id = ?'
      ).bind(webhook_url || null, merchant_id).run();

      console.log('✅ Webhook URL updated:', merchant_id, webhook_url || '(removed)');

      return Response.json({
        success: true,
        webhook_url: webhook_url || ''
      }, { headers: corsHeaders });
    }

    // Method not allowed
    return Response.json({
      success: false,
      error: 'Method not allowed'
    }, { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('❌ Webhook endpoint error:', error);
    return Response.json({
      success: false,
      error: 'Failed to process webhook request'
    }, { status: 500, headers: corsHeaders });
  }
}