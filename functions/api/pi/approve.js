// functions/api/pi/approve.js
/**
 * Pi Payment Approval Handler with Prepaid Credit Check
 * 
 * Flow:
 * 1. Check if merchant has sufficient credits (Pure Math: amount × 0.02)
 * 2. Verify order exists
 * 3. Verify payment with Pi Network
 * 4. Approve payment on Pi Network
 * 5. Save payment_id to order
 */

import { 
  calculateCreditCost,
  CREDIT_CONSTANTS 
} from '../../../lib/credits-pure-math.js';
import { checkIdempotency, storeIdempotency } from '../../../lib/idempotency.js';

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

    console.log('📥 Approve request:', { payment_id, order_id });

    if (!payment_id || !order_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing payment_id or order_id' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const PI_API_KEY = env.PI_API_KEY;
    if (!PI_API_KEY) {
      throw new Error('PI_API_KEY not configured');
    }

    // STEP 1: Verify order exists and get merchant info
    console.log('🔍 Checking order in database...');
    const order = await env.DB.prepare(
      'SELECT * FROM paypi_orders WHERE order_id = ?'
    ).bind(order_id).first();

    if (!order) {
      console.error('❌ Order not found:', order_id);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Order found:', order);

    // STEP 2: Check merchant credit balance (Pure Math: amount × 0.02)
    console.log('💳 Checking merchant credits...');
    const merchant = await env.DB.prepare(
      'SELECT credit_balance, payments_enabled FROM merchants WHERE merchant_id = ?'
    ).bind(order.merchant_id).first();

    if (!merchant) {
      console.error('❌ Merchant not found:', order.merchant_id);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Merchant not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate credits needed using pure math function
    const creditsNeeded = calculateCreditCost(order.total_amt);
    
    console.log('💰 Credit check:', {
      merchant_id: order.merchant_id,
      balance: merchant.credit_balance,
      needed: creditsNeeded,
      payment_amount: order.total_amt
    });

    // Check if merchant has sufficient credits
    if (!merchant.payments_enabled) {
      console.error('❌ Merchant payments disabled');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Merchant payments disabled. Please deposit credits.',
        merchant_id: order.merchant_id,
        balance: merchant.credit_balance,
        needed: creditsNeeded
      }), {
        status: 402, // Payment Required
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (merchant.credit_balance < creditsNeeded) {
      console.error('❌ Insufficient credits:', {
        balance: merchant.credit_balance,
        needed: creditsNeeded,
        shortage: creditsNeeded - merchant.credit_balance
      });
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Merchant has insufficient credits',
        merchant_id: order.merchant_id,
        balance: merchant.credit_balance + ' credits',
        needed: creditsNeeded + ' credits',
        shortage: (creditsNeeded - merchant.credit_balance) + ' credits'
      }), {
        status: 402, // Payment Required
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Merchant has sufficient credits');

    // STEP 3: Check if there's already a pending payment for this order
    if (order.pi_payment_id && order.pi_payment_id !== payment_id) {
      console.log('⚠️ Different payment_id already exists for this order');
      
      // Check status of existing payment
      const existingPaymentCheck = await fetch(
        `https://api.minepi.com/v2/payments/${order.pi_payment_id}`,
        {
          headers: { 'Authorization': `Key ${PI_API_KEY}` }
        }
      );

      if (existingPaymentCheck.ok) {
        const existingPaymentData = await existingPaymentCheck.json();
        
        // If existing payment is still pending, reject new payment
        if (!existingPaymentData.status?.developer_completed && 
            !existingPaymentData.status?.cancelled) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Payment already in progress. Please complete the pending payment.',
            existing_payment_id: order.pi_payment_id
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // STEP 4: Verify payment with Pi Network
    console.log('🔍 Verifying payment with Pi...');
    const verifyResponse = await fetch(
      `https://api.minepi.com/v2/payments/${payment_id}`,
      {
        headers: { 'Authorization': `Key ${PI_API_KEY}` }
      }
    );

    if (!verifyResponse.ok) {
      throw new Error(`Pi verification failed: ${verifyResponse.status}`);
    }

    const paymentData = await verifyResponse.json();
    console.log('✅ Payment data:', paymentData);

    // Verify payment amount matches order
    if (paymentData.amount !== order.total_amt) {
      console.error('❌ Payment amount mismatch:', {
        expected: order.total_amt,
        received: paymentData.amount
      });
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payment amount does not match order',
        expected: order.total_amt,
        received: paymentData.amount
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already approved
    if (paymentData.status?.developer_approved) {
      console.log('ℹ️ Payment already approved');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Payment already approved',
        payment_id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 5: Approve payment on Pi Network
    console.log('🔄 Approving payment on Pi...');
    const approveResponse = await fetch(
      `https://api.minepi.com/v2/payments/${payment_id}/approve`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${PI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    if (!approveResponse.ok) {
      const errorText = await approveResponse.text();
      console.error('❌ Pi approve failed:', errorText);
      throw new Error(`Pi approve failed: ${approveResponse.status} - ${errorText}`);
    }

    const approveData = await approveResponse.json();
    console.log('✅ Payment approved on Pi:', approveData);

    // STEP 6: Save payment_id in database
    console.log('🔄 Saving payment_id to database...');
    const updateResult = await env.DB.prepare(
      'UPDATE paypi_orders SET pi_payment_id = ? WHERE order_id = ?'
    ).bind(payment_id, order_id).run();

    console.log('✅ Database updated:', updateResult);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Payment approved successfully',
      payment_id,
      order_id,
      credits_reserved: creditsNeeded,
      merchant_balance: merchant.credit_balance
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('❌ Pi approve error:', err);
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