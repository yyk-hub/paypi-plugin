// functions/api/admin/stats/[type].js
/**
 * Admin Stats API
 * GET /api/admin/stats/orders
 * GET /api/admin/stats/volume
 * GET /api/admin/stats/merchants
 * GET /api/admin/stats/refunds
 */

export async function onRequestGet(context) {
  const { request, env, params } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const type = params.type;

    let result;

    switch (type) {
      case 'orders':
        result = await env.DB.prepare(`
          SELECT COUNT(*) as total FROM paypi_orders
        `).first();
        break;

      case 'volume':
        result = await env.DB.prepare(`
          SELECT COALESCE(SUM(total_amt), 0) as total FROM paypi_orders
        `).first();
        break;

      case 'merchants':
        result = await env.DB.prepare(`
          SELECT COUNT(*) as total FROM merchants
        `).first();
        break;

      case 'refunds':
        result = await env.DB.prepare(`
          SELECT COUNT(*) as total FROM paypi_orders WHERE has_refund = 1
        `).first();
        break;

      default:
        return Response.json({ error: 'Invalid stat type' }, { status: 400, headers: corsHeaders });
    }

    return Response.json(result, { headers: corsHeaders });

  } catch (error) {
    console.error('Stats error:', error);
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