// functions/api/pi/approve.js
/**
 * Pi Payment Approval Handler with Prepaid Credit Check + Idempotency
 * 
 * Flow:
 * 1. Check idempotency (prevent duplicates)
 * 2. Verify order exists
 * 3. Check merchant has sufficient credits (Pure Math: amount × 0.02)
 * 4. Verify payment with Pi Network
 * 5. Approve payment on Pi Network
 * 6. Save payment_id to order
 * 7. Store idempotency response
 */

import { 
  calculateCreditCost,
  CREDIT_CONSTANTS 
} from '../../../lib/credits-pure-math.js';

import { 
  checkIdempotency, 
  storeIdempotency 
} from '../../../lib/idempotency.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
  };

  try {
    const body = await request.json().catch(() => ({}));
    const { payment_id, order_id } = body;

    // STEP 1: Get idempotency key from header
    const idempotencyKey = request.headers.get('Idempotency-Key');

    console.log('📥 Approve request:', { 
      payment_id, 
      order_id, 
      has_idempotency: !!idempotencyKey 
    });

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

    // STEP 2: Verify order exists and get merchant info
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

    // STEP 3: Check for cached idempotent response
    if (idempotencyKey) {
      const cached = await checkIdempotency(env, idempotencyKey, order.merchant_id);
      if (cached) {
        console.log('✅ Returning cached response from idempotency check');
        return new Response(JSON.stringify(cached), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Idempotency-Cached': 'true'
          },
        });
      }
    }

    // STEP 4: Check merchant credit balance (Pure Math: amount × 0.02)
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

    // STEP 5: Check if there's already a pending payment for this order
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

    // STEP 6: Verify payment with Pi Network
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
      
      const response = { 
        success: true,
        message: 'Payment already approved',
        payment_id,
        order_id,
        credits_reserved: creditsNeeded,
        merchant_balance: merchant.credit_balance
      };

      // Store in idempotency cache even for already-approved
      if (idempotencyKey) {
        await storeIdempotency(env, idempotencyKey, order.merchant_id, 'approve', response);
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // STEP 7: Approve payment on Pi Network
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

    // STEP 8: Save payment_id in database
    console.log('🔄 Saving payment_id to database...');
    const updateResult = await env.DB.prepare(
      'UPDATE paypi_orders SET pi_payment_id = ? WHERE order_id = ? AND pi_payment_id IS NULL'
    ).bind(payment_id, order_id).run();

    console.log('✅ Database updated:', updateResult);

    // STEP 9: Prepare success response
    const response = { 
      success: true, 
      message: 'Payment approved successfully',
      payment_id,
      order_id,
      credits_reserved: creditsNeeded,
      merchant_balance: merchant.credit_balance
    };

    // STEP 10: Store idempotency key for future duplicate requests
    if (idempotencyKey) {
      await storeIdempotency(env, idempotencyKey, order.merchant_id, 'approve', response);
      console.log('✅ Stored idempotency key:', idempotencyKey);
    }

    return new Response(JSON.stringify(response), {
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
      'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    },
  });
}