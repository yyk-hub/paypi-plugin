// functions/api/admin/orders.js
/**
 * Admin Orders API
 * GET /api/admin/orders?limit=10
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;

    const { results } = await env.DB.prepare(`
      SELECT 
        order_id,
        merchant_id,
        user_uid,
        total_amt,
        has_refund,
        refunded_at,
        created_at
      FROM paypi_orders
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();

    return Response.json({
      orders: results,
      count: results.length
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Orders error:', error);
    return Response.json({
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}