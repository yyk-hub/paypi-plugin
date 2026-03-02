// functions/api/merchant/list-orders.js
/**
 * List Orders
 * 
 * - Admin: View all orders across all merchants
 * - Merchant: View their own orders (via API key)
 * - Supports filtering by status, merchant, date range
 */

import { validateApiKey } from '../../../lib/api-key-security.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const merchant_id = url.searchParams.get('merchant_id');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const from_date = url.searchParams.get('from_date'); // Unix timestamp
    const to_date = url.searchParams.get('to_date'); // Unix timestamp

    // Check authentication
    const authHeader = request.headers.get('Authorization');
    let isAdmin = false;
    let authenticatedMerchantId = null;

    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ 
        success: false, 
        error: 'Missing authentication token' 
      }, { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Check if admin token
    if (token === env.ADMIN_TOKEN) {
      isAdmin = true;
    } else {
      // Validate as merchant API key
      const validation = await validateApiKey(env, token);
      
      if (!validation.valid) {
        return Response.json({ 
          error: 'Invalid API key or admin token' 
        }, { 
          status: 401, 
          headers: corsHeaders 
        });
      }
      
      authenticatedMerchantId = validation.merchant_id;
    }

    // Build query based on permissions
    let query;
    let bindings = [];

    // Base SELECT
    const baseSelect = `
      SELECT 
        o.order_id,
        o.merchant_id,
        o.user_uid,
        o.pi_username,
        o.total_amt,
        o.credits_charged,
        o.order_status,
        o.pi_payment_id,
        o.pi_txid,
        o.has_refund,
        o.refunded_at,
        o.created_at,
        o.completed_at,
        m.business_name,
        m.business_email,
        m.credit_balance
      FROM paypi_orders o
      JOIN merchants m ON o.merchant_id = m.merchant_id
    `;

    // Build WHERE clause
    const conditions = [];
    
    // Merchant filter (admin can specify, merchant only sees own)
    if (authenticatedMerchantId) {
      // Merchant user - can only see their own orders
      conditions.push('o.merchant_id = ?');
      bindings.push(authenticatedMerchantId);
    } else if (merchant_id) {
      // Admin filtering by merchant
      conditions.push('o.merchant_id = ?');
      bindings.push(merchant_id);
    }

    // Status filter
    if (status !== 'all') {
      conditions.push('o.order_status = ?');
      bindings.push(status);
    }

    // Date range filter
    if (from_date) {
      conditions.push('o.created_at >= ?');
      bindings.push(parseInt(from_date));
    }
    if (to_date) {
      conditions.push('o.created_at <= ?');
      bindings.push(parseInt(to_date));
    }

    // Combine WHERE clause
    const whereClause = conditions.length > 0 
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Complete query
    query = `
      ${baseSelect}
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;
    bindings.push(limit, offset);

    // Execute query
    const stmt = env.DB.prepare(query);
    const result = await stmt.bind(...bindings).all();
    const orders = result.results || [];

    // Get total count
    const countBindings = bindings.slice(0, -2); // Remove limit & offset
    let countQuery = `
      SELECT COUNT(*) as total
      FROM paypi_orders o
      JOIN merchants m ON o.merchant_id = m.merchant_id
      ${whereClause}
    `;
    
    const countStmt = env.DB.prepare(countQuery);
    const countResult = countBindings.length > 0
      ? await countStmt.bind(...countBindings).first()
      : await countStmt.first();
    const totalCount = countResult?.total || 0;

    // Calculate totals (if admin or specific merchant)
    let totals = null;
    if (isAdmin || authenticatedMerchantId) {
      const totalsBindings = bindings.slice(0, -2); // Remove limit & offset
      const totalsQuery = `
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN order_status = 'Paid' THEN 1 ELSE 0 END) as paid_orders,
          SUM(CASE WHEN order_status = 'Paid' THEN total_amt ELSE 0 END) as total_volume,
          SUM(CASE WHEN order_status = 'Paid' THEN credits_charged ELSE 0 END) as total_credits_used,
          SUM(CASE WHEN has_refund = 1 THEN 1 ELSE 0 END) as refunded_orders
        FROM paypi_orders o
        JOIN merchants m ON o.merchant_id = m.merchant_id
        ${whereClause}
      `;
      
      const totalsStmt = env.DB.prepare(totalsQuery);
      const totalsResult = totalsBindings.length > 0
        ? await totalsStmt.bind(...totalsBindings).first()
        : await totalsStmt.first();
      
      totals = {
        total_orders: totalsResult?.total_orders || 0,
        paid_orders: totalsResult?.paid_orders || 0,
        total_volume: parseFloat(totalsResult?.total_volume || 0) + 'π',
        total_credits_used: parseFloat(totalsResult?.total_credits_used || 0),
        refunded_orders: totalsResult?.refunded_orders || 0,
        revenue_collected: parseFloat(totalsResult?.total_credits_used || 0) + ' credits'
      };
    }

    // Format orders
    const formattedOrders = orders.map(o => ({
      order_id: o.order_id,
      merchant_id: o.merchant_id,
      merchant_name: o.business_name,
      
      // Customer
      user_uid: o.user_uid,
      pi_username: o.pi_username,
      
      // Payment
      amount: parseFloat(o.total_amt) + 'π',
      credits_charged: parseFloat(o.credits_charged),
      
      // Status
      status: o.order_status,
      has_refund: o.has_refund === 1,
      
      // Blockchain
      pi_payment_id: o.pi_payment_id,
      pi_txid: o.pi_txid,
      
      // Timestamps
      created_at: o.created_at,
      completed_at: o.completed_at,
      refunded_at: o.refunded_at,
      
      // Merchant info (admin only)
      ...(isAdmin ? {
        merchant_email: o.business_email,
        merchant_balance: o.credit_balance + ' credits'
      } : {})
    }));

    return Response.json({
      success: true,
      orders: formattedOrders,
      count: formattedOrders.length,
      total: totalCount,
      limit,
      offset,
      filters: {
        status: status,
        merchant_id: merchant_id || (authenticatedMerchantId ? 'own' : null),
        from_date: from_date || null,
        to_date: to_date || null
      },
      totals: totals,
      is_admin: isAdmin
    }, { 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('❌ List orders error:', error);
    
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