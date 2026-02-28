// functions/api/pi/complete.js
/**
 * Pi Payment Completion Handler with Credit Deduction
 * 
 * Flow:
 * 1. Verify payment with Pi Network
 * 2. Complete payment on Pi Network
 * 3. Deduct credits from merchant (Pure Math: amount × 0.02)
 * 4. Update order status to Paid
 * 5. Log credit transaction
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
    const { payment_id, txid, order_id } = body;

    console.log('📥 Complete request:', { payment_id, txid, order_id });

    if (!payment_id || !txid) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing payment_id or txid' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const PI_API_KEY = env.PI_API_KEY;
    const APP_WALLET_SECRET = env.APP_WALLET_SECRET;

    if (!PI_API_KEY || !APP_WALLET_SECRET) {
      console.error('❌ Missing env vars:', { 
        has_api_key: !!PI_API_KEY, 
        has_wallet_secret: !!APP_WALLET_SECRET 
      });
      throw new Error('PI_API_KEY or APP_WALLET_SECRET not configured');
    }

    // STEP 1: Find order
    let order = null;
    
    if (order_id) {
      console.log('🔍 Looking for order:', order_id);
      order = await env.DB.prepare(
        'SELECT * FROM paypi_orders WHERE order_id = ?'
      ).bind(order_id).first();
    }
    
    if (!order) {
      console.log('🔍 Order not found by order_id, searching by payment_id...');
      order = await env.DB.prepare(
        'SELECT * FROM paypi_orders WHERE pi_payment_id = ?'
      ).bind(payment_id).first();
    }

    if (!order) {
      console.error('❌ No order found for payment_id:', payment_id);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Order found:', {
      order_id: order.order_id,
      merchant_id: order.merchant_id,
      amount: order.total_amt,
      status: order.order_status
    });
      
    if (order.order_status === 'Paid') {
      console.log('ℹ️ Order already marked as Paid');
      return new Response(JSON.stringify({
        success: true,
        message: 'Payment already completed',
        order_id: order.order_id,
        payment_id,
        txid,
        user_uid: order.user_uid || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 2: Verify payment with Pi Network
    console.log('🔍 Verifying payment with Pi Network...');
    
    const verifyResponse = await fetch(
      `https://api.minepi.com/v2/payments/${payment_id}`,
      {
        headers: { 'Authorization': `Key ${PI_API_KEY}` }
      }
    );

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('❌ Pi verification failed:', errorText);
      throw new Error(`Pi verification failed: ${verifyResponse.status} - ${errorText}`);
    }

    const paymentData = await verifyResponse.json();
    
    // Extract user_uid (try multiple locations)
    let userUid = null;
    let uidSource = 'not_found';
    
    if (paymentData.user?.uid) {
      userUid = paymentData.user.uid;
      uidSource = 'user.uid';
    } else if (paymentData.user_uid) {
      userUid = paymentData.user_uid;
      uidSource = 'user_uid';
    } else if (paymentData.uid) {
      userUid = paymentData.uid;
      uidSource = 'uid';
    } else if (paymentData.from_address) {
      userUid = paymentData.from_address;
      uidSource = 'from_address';
    } else if (paymentData.metadata?.user_uid) {
      userUid = paymentData.metadata.user_uid;
      uidSource = 'metadata.user_uid';
    }
    
    console.log('✅ Payment verified:', {
      identifier: paymentData.identifier,
      amount: paymentData.amount,
      has_user_uid: !!userUid,
      uid_source: uidSource
    });
    
    if (userUid) {
      console.log('✅ User UID extracted:', userUid, `(from: ${uidSource})`);
    } else {
      console.warn('⚠️ No user UID found in payment data');
    }

    // STEP 3: Complete payment on Pi Network (if not already done)
    if (!paymentData.status?.developer_completed) {
      console.log('🔄 Completing payment on Pi Network...');
      
      const completeResponse = await fetch(
        `https://api.minepi.com/v2/payments/${payment_id}/complete`,
        {
          method: 'POST',
          headers: { 
            'Authorization': `Key ${PI_API_KEY}`, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({ 
            txid: txid
          }),
        }
      );

      if (!completeResponse.ok) {
        const errorText = await completeResponse.text();
        console.error('❌ Pi complete failed:', {
          status: completeResponse.status,
          error: errorText
        });
        throw new Error(`Pi complete failed: ${completeResponse.status} - ${errorText}`);
      }

      console.log('✅ Payment completed on Pi Network');
    } else {
      console.log('ℹ️ Payment already completed on Pi Network');
    }

    // STEP 4: Deduct credits from merchant (Pure Math: amount × 0.02)
    const creditCost = order.total_amt * 0.02;
    
    console.log('💳 Deducting credits:', {
      merchant_id: order.merchant_id,
      payment_amount: order.total_amt,
      credit_cost: creditCost
    });

    // Get current merchant balance
    const merchant = await env.DB.prepare(
      'SELECT credit_balance FROM merchants WHERE merchant_id = ?'
    ).bind(order.merchant_id).first();

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    const newBalance = merchant.credit_balance - creditCost;

    // Update merchant credit balance
    await env.DB.prepare(`
      UPDATE merchants
      SET 
        credit_balance = ?,
        total_processed = total_processed + ?,
        low_balance_warning = CASE WHEN ? < 20 THEN 1 ELSE 0 END,
        payments_enabled = CASE WHEN ? <= 0 THEN 0 ELSE 1 END
      WHERE merchant_id = ?
    `).bind(
      newBalance,
      order.total_amt,
      newBalance,
      newBalance,
      order.merchant_id
    ).run();

    console.log('✅ Credits deducted:', {
      old_balance: merchant.credit_balance,
      cost: creditCost,
      new_balance: newBalance,
      low_balance_warning: newBalance < 20,
      payments_disabled: newBalance <= 0
    });

    // Log credit transaction
    await env.DB.prepare(`
      INSERT INTO credit_transactions (
        tx_id,
        merchant_id,
        type,
        amount,
        pi_amount,
        balance_after,
        description,
        created_at
      ) VALUES (?, ?, 'deduction', ?, ?, ?, ?, unixepoch())
    `).bind(
      `TXN_${Date.now()}`,
      order.merchant_id,
      creditCost,
      order.total_amt,
      newBalance,
      `Payment ${order.order_id}`
    ).run();

    // STEP 5: Update order in database
    console.log('🔄 Updating order in database...');
    
    let updateResult;
    
    if (userUid) {
      updateResult = await env.DB.prepare(`
        UPDATE paypi_orders
        SET 
          order_status = 'Paid',
          pi_payment_id = ?,
          pi_txid = ?,
          user_uid = ?,
          credits_charged = ?
        WHERE order_id = ?
      `).bind(payment_id, txid, userUid, creditCost, order.order_id).run();
      
      console.log('✅ Updated order with user_uid:', userUid);
    } else {
      updateResult = await env.DB.prepare(`
        UPDATE paypi_orders
        SET 
          order_status = 'Paid',
          pi_payment_id = ?,
          pi_txid = ?,
          credits_charged = ?
        WHERE order_id = ?
      `).bind(payment_id, txid, creditCost, order.order_id).run();
      
      console.log('⚠️ Updated order WITHOUT user_uid');
    }

    console.log('✅ Database update:', {
      success: updateResult.success,
      changes: updateResult.meta?.changes
    });

    // Fetch updated order
    const updatedOrder = await env.DB.prepare(
      'SELECT * FROM paypi_orders WHERE order_id = ?'
    ).bind(order.order_id).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Payment completed successfully',
      order_id: updatedOrder.order_id,
      payment_id,
      txid,
      order_status: updatedOrder.order_status,
      user_uid: updatedOrder.user_uid || null,
      credits_charged: creditCost,
      merchant_balance: newBalance,
      capacity_remaining: (newBalance / 0.02) + 'π'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message || 'Unknown error',
      details: err.stack
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