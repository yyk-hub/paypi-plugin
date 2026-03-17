// functions/api/admin/refunds.js
/**
 * Admin Refunds API
 * GET /api/admin/refunds
 */

export async function onRequestGet(context) {
  const { env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        order_id,
        merchant_id,
        user_uid,
        total_amt,
        refunded_at,
        created_at
      FROM paypi_orders
      WHERE has_refund = 1
      ORDER BY refunded_at DESC
    `).all();

    return Response.json({
      refunds: results,
      count: results.length
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Refunds error:', error);
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