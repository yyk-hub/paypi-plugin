// functions/api/refund/status.js
/**
 * Get Refund Status
 * 
 * - Get detailed refund information
 * - Shows credit return details
 * - Optional auth (can be public for customer tracking)
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const url = new URL(request.url);
    const order_id = url.searchParams.get('order_id');

    if (!order_id) {
      return Response.json({
        success: false,
        error: 'Missing order_id parameter'
      }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Get order with merchant details
    const order = await env.DB.prepare(`
      SELECT 
        o.*,
        m.business_name,
        m.business_email,
        m.credit_balance
      FROM paypi_orders o
      JOIN merchants m ON o.merchant_id = m.merchant_id
      WHERE o.order_id = ?
    `).bind(order_id).first();

    if (!order) {
      return Response.json({
        success: false,
        error: 'Order not found'
      }, { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Check if refunded
    if (!order.has_refund) {
      return Response.json({
        success: false,
        error: 'Order has not been refunded'
      }, { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Get credit transaction for this refund
    const creditTx = await env.DB.prepare(`
      SELECT *
      FROM credit_transactions
      WHERE merchant_id = ? 
        AND type = 'refund'
        AND description LIKE ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(order.merchant_id, `%${order_id}%`).first();

    // Format response
    return Response.json({
      success: true,
      refund: {
        // Order info
        order_id: order.order_id,
        merchant_id: order.merchant_id,
        merchant_name: order.business_name,
        user_uid: order.user_uid,
        
        // Amounts
        amount_pi: parseFloat(order.total_amt),
        credits_originally_charged: parseFloat(order.credits_charged),
        credits_returned: parseFloat(order.credits_charged), // Same amount
        
        // Status
        order_status: order.order_status,
        has_refund: order.has_refund === 1,
        
        // Blockchain
        original_txid: order.pi_txid,
        
        // Timestamps
        original_payment_at: order.completed_at,
        refunded_at: order.refunded_at,
        
        // Merchant balance (current)
        merchant_current_balance: order.credit_balance,
        merchant_current_capacity: (order.credit_balance / 0.02) + 'π',
        
        // Credit transaction details
        credit_refund: creditTx ? {
          tx_id: creditTx.tx_id,
          credits_returned: parseFloat(creditTx.amount),
          pi_amount: parseFloat(creditTx.pi_amount),
          balance_after_refund: parseFloat(creditTx.balance_after),
          description: creditTx.description,
          processed_at: creditTx.created_at
        } : null
      }
    }, { 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('❌ Get refund status error:', error);
    
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