// functions/api/refund/process.js
/**
 * Process Refund (CEO Pattern - DEBUG VERSION)
 * 
 * Added extensive logging to diagnose "invalid encoded string" issue
 */

import { Keypair, TransactionBuilder, Operation, Asset, Horizon, Memo } from '@stellar/stellar-sdk';
import fetchAdapter from '@vespaiach/axios-fetch-adapter';

// ✅ CRITICAL: Override axios to use fetch (required for Cloudflare Workers)
Horizon.AxiosClient.defaults.adapter = fetchAdapter;

import { calculateCreditCost } from '../../../lib/credits-pure-math.js';
import { 
  checkIdempotency, 
  storeIdempotency 
} from '../../../lib/idempotency.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
  };

  try {
    const { order_id, amount, reason } = await request.json();
    const idempotencyKey = request.headers.get('Idempotency-Key');

    console.log('🔄 Processing refund (CEO pattern DEBUG):', { 
      order_id, 
      amount, 
      reason 
    });

    // Get order details
    const order = await env.DB.prepare(
      'SELECT * FROM paypi_orders WHERE order_id = ?'
    ).bind(order_id).first();

    if (!order) {
      return Response.json({
        error: 'Order not found'
      }, { status: 404, headers: corsHeaders });
    }

    console.log('📦 Order:', { user_uid: order.user_uid, has_refund: order.has_refund });

    // Check if already refunded
    if (order.has_refund) {
      return Response.json({
        success: true,
        message: 'Order already refunded'
      }, { headers: corsHeaders });
    }

    const isTestnet = env.PI_NETWORK === 'testnet';
    const piPlatformUrl = 'https://api.minepi.com';

    // STEP 1: Create U2A Payment
    console.log('📥 Step 1: Creating U2A payment...');

    const paymentBody = {
      payment: {
        amount: parseFloat(amount),
        memo: reason || `Refund for order ${order_id}`,
        metadata: {
          order_id: order_id,
          type: 'refund'
        },
        uid: order.user_uid
      }
    };

    console.log('📤 Request:', JSON.stringify(paymentBody, null, 2));

    const createResponse = await fetch(`${piPlatformUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${env.PI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentBody)
    });

    console.log('📬 Response status:', createResponse.status);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ Create failed:', errorText);
      throw new Error(`Failed to create payment: ${errorText}`);
    }

    const paymentData = await createResponse.json();
    
    // CRITICAL: Log full response
    console.log('💳 PAYMENT RESPONSE:', JSON.stringify(paymentData, null, 2));
    
    const paymentIdentifier = paymentData.identifier;
    const recipientAddress = paymentData.to_address;

    console.log('🔑 identifier:', paymentIdentifier);
    console.log('🔑 to_address:', recipientAddress);
    console.log('🔑 to_address type:', typeof recipientAddress);
    console.log('🔑 to_address length:', recipientAddress?.length);

    if (!recipientAddress) {
      throw new Error('No to_address in response!');
    }

    console.log('✅ Payment created successfully');

    // Return success (skip Stellar transaction for debugging)
    return Response.json({
      success: true,
      debug_mode: true,
      payment_identifier: paymentIdentifier,
      to_address: recipientAddress,
      message: 'Debug mode - Payment created but not completed'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ ERROR:', error);
    console.error('❌ Stack:', error.stack);
    
    return Response.json({
      error: error.message,
      stack: error.stack
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
    },
  });
}