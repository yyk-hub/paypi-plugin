// functions/api/admin/refunds.js
/**
 * Admin Refunds API - With Partial Refund Support
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
        r.refund_id,
        r.order_id,
        r.merchant_id,
        r.user_uid,
        r.amount,
        r.original_amount,
        r.txid,
        r.reason,
        r.refund_status,
        r.created_at,
        r.completed_at,
        o.total_amt,
        o.total_refunded
      FROM refunds r
      INNER JOIN paypi_orders o ON r.order_id = o.order_id
      WHERE r.refund_status = 'completed'
      ORDER BY r.completed_at DESC
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