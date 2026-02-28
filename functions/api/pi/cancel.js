// functions/api/pi/cancel.js
/**
 * Cancel pending payment in database
 * 
 * Note: This only cancels in our system, not on Pi Network
 * Credits are not deducted for cancelled payments
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json().catch(() => ({}));
    const { payment_id, order_id } = body;

    console.log('📥 Cancel request:', { payment_id, order_id });

    if (!payment_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing payment_id (identifier)' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find order by payment_id
    let order;
    
    if (order_id) {
      // Try to find by both order_id and payment_id
      order = await env.DB.prepare(
        'SELECT * FROM paypi_orders WHERE order_id = ? AND pi_payment_id = ?'
      ).bind(order_id, payment_id).first();
    }
    
    if (!order) {
      // Try to find by payment_id only
      order = await env.DB.prepare(
        'SELECT * FROM paypi_orders WHERE pi_payment_id = ?'
      ).bind(payment_id).first();
    }

    if (!order) {
      console.log('⚠️ No order found with this payment_id:', payment_id);
      
      // Still return success - payment might not be in our system yet
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Payment cancelled (no associated order found)',
        payment_id,
        note: 'Order may not exist yet or payment was already cancelled'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Order found:', {
      order_id: order.order_id,
      merchant_id: order.merchant_id,
      amount: order.total_amt,
      status: order.order_status,
      payment_id: order.pi_payment_id
    });

    // Check if already cancelled
    if (order.order_status === 'Cancelled') {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Payment already cancelled',
        order_id: order.order_id,
        payment_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already paid
    if (order.order_status === 'Paid') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Cannot cancel: Payment already completed',
        order_id: order.order_id
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update order status to Cancelled
    const updateResult = await env.DB.prepare(`
      UPDATE paypi_orders
      SET 
        order_status = 'Cancelled',
        pi_payment_id = NULL,
        pi_txid = NULL
      WHERE order_id = ?
    `).bind(order.order_id).run();

    console.log('✅ Order cancelled:', {
      order_id: order.order_id,
      changes: updateResult.meta?.changes,
      note: 'No credits were deducted (payment not completed)'
    });

    if (updateResult.meta?.changes === 0) {
      throw new Error('Failed to update order - no rows changed');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Payment cancelled successfully',
      order_id: order.order_id,
      payment_id,
      note: 'No credits were charged for this cancelled payment'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('❌ Cancel error:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message || 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}