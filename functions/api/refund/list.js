// functions/api/refund/list.js
/**
 * List Refunds for Admin Dashboard
 * 
 * - Shows all refunds with pagination
 * - Includes credit return information
 * - Admin authentication required
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Admin auth check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ 
        success: false, 
        error: 'Missing admin token' 
      }, { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const adminToken = authHeader.replace('Bearer ', '');
    if (adminToken !== env.ADMIN_TOKEN) {
      return Response.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { 
        status: 403, 
        headers: corsHeaders 
      });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const merchant_id = url.searchParams.get('merchant_id'); // Optional filter

    // Build query with proper binding
    let query;
    let bindings = [];
    let countQuery;
    let countBindings = [];

    if (status !== 'all' && merchant_id) {
      // Both filters
      query = `
        SELECT 
          o.order_id,
          o.merchant_id,
          o.user_uid,
          o.total_amt,
          o.credits_charged,
          o.order_status,
          o.has_refund,
          o.refunded_at,
          o.pi_txid,
          m.business_name,
          m.credit_balance
        FROM paypi_orders o
        JOIN merchants m ON o.merchant_id = m.merchant_id
        WHERE o.has_refund = 1 
          AND o.order_status = ?
          AND o.merchant_id = ?
        ORDER BY o.refunded_at DESC
        LIMIT ? OFFSET ?
      `;
      bindings = [status, merchant_id, limit, offset];
      
      countQuery = `
        SELECT COUNT(*) as total 
        FROM paypi_orders 
        WHERE has_refund = 1 
          AND order_status = ? 
          AND merchant_id = ?
      `;
      countBindings = [status, merchant_id];
      
    } else if (status !== 'all') {
      // Status filter only
      query = `
        SELECT 
          o.order_id,
          o.merchant_id,
          o.user_uid,
          o.total_amt,
          o.credits_charged,
          o.order_status,
          o.has_refund,
          o.refunded_at,
          o.pi_txid,
          m.business_name,
          m.credit_balance
        FROM paypi_orders o
        JOIN merchants m ON o.merchant_id = m.merchant_id
        WHERE o.has_refund = 1 AND o.order_status = ?
        ORDER BY o.refunded_at DESC
        LIMIT ? OFFSET ?
      `;
      bindings = [status, limit, offset];
      
      countQuery = `
        SELECT COUNT(*) as total 
        FROM paypi_orders 
        WHERE has_refund = 1 AND order_status = ?
      `;
      countBindings = [status];
      
    } else if (merchant_id) {
      // Merchant filter only
      query = `
        SELECT 
          o.order_id,
          o.merchant_id,
          o.user_uid,
          o.total_amt,
          o.credits_charged,
          o.order_status,
          o.has_refund,
          o.refunded_at,
          o.pi_txid,
          m.business_name,
          m.credit_balance
        FROM paypi_orders o
        JOIN merchants m ON o.merchant_id = m.merchant_id
        WHERE o.has_refund = 1 AND o.merchant_id = ?
        ORDER BY o.refunded_at DESC
        LIMIT ? OFFSET ?
      `;
      bindings = [merchant_id, limit, offset];
      
      countQuery = `
        SELECT COUNT(*) as total 
        FROM paypi_orders 
        WHERE has_refund = 1 AND merchant_id = ?
      `;
      countBindings = [merchant_id];
      
    } else {
      // No filters
      query = `
        SELECT 
          o.order_id,
          o.merchant_id,
          o.user_uid,
          o.total_amt,
          o.credits_charged,
          o.order_status,
          o.has_refund,
          o.refunded_at,
          o.pi_txid,
          m.business_name,
          m.credit_balance
        FROM paypi_orders o
        JOIN merchants m ON o.merchant_id = m.merchant_id
        WHERE o.has_refund = 1
        ORDER BY o.refunded_at DESC
        LIMIT ? OFFSET ?
      `;
      bindings = [limit, offset];
      
      countQuery = `
        SELECT COUNT(*) as total 
        FROM paypi_orders 
        WHERE has_refund = 1
      `;
      countBindings = [];
    }

    // Execute query
    const stmt = env.DB.prepare(query);
    const result = await stmt.bind(...bindings).all();
    const refunds = result.results || [];

    // Get total count
    const countStmt = env.DB.prepare(countQuery);
    const countResult = countBindings.length > 0 
      ? await countStmt.bind(...countBindings).first()
      : await countStmt.first();
    const totalCount = countResult?.total || 0;

    // Format refunds
    const formattedRefunds = refunds.map(r => ({
      order_id: r.order_id,
      merchant_id: r.merchant_id,
      merchant_name: r.business_name,
      user_uid: r.user_uid,
      
      // Payment amounts
      amount_pi: parseFloat(r.total_amt),
      credits_charged: parseFloat(r.credits_charged),
      credits_returned: parseFloat(r.credits_charged), // Same amount returned
      
      // Status
      order_status: r.order_status,
      has_refund: r.has_refund === 1,
      
      // Timestamps
      refunded_at: r.refunded_at,
      
      // Blockchain
      pi_txid: r.pi_txid,
      
      // Merchant balance (current)
      merchant_balance: r.credit_balance
    }));

    return Response.json({
      success: true,
      refunds: formattedRefunds,
      count: formattedRefunds.length,
      total: totalCount,
      limit,
      offset,
      filter: status,
      merchant_filter: merchant_id || null
    }, { 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('❌ List refunds error:', error);
    
    return Response.json({
      success: false,
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