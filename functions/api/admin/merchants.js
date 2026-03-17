// functions/api/admin/merchants.js
/**
 * Admin Merchants API
 * GET /api/admin/merchants
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
        merchant_id,
        business_name,
        credit_balance,
        created_at
      FROM merchants
      ORDER BY created_at DESC
    `).all();

    return Response.json({
      merchants: results,
      count: results.length
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Merchants error:', error);
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