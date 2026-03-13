// functions/api/refund/process.js
/**
 * Process Refund (CEO Pattern - U2A + A2U Hybrid)
 * 
 * Flow (completes in ~5 seconds):
 * 1. Create U2A payment on Pi Network (user gets notification)
 * 2. Build Stellar transaction (A2U - platform sends π)
 * 3. Sign and submit to Stellar network
 * 4. Complete payment on Pi Platform
 * 5. Update database and return credits
 * 
 * This uses the CEO pattern: Create U2A payment, then immediately
 * complete it with A2U Stellar transaction. User gets notified but
 * platform controls the refund execution.
 */

// CRITICAL: Import the initialized Horizon (with fetch adapter)
import { Horizon } from '../../../lib/stellar-init.js';
import { Keypair, TransactionBuilder, Operation, Asset, Networks, Memo } from '@stellar/stellar-sdk';
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

    // Get idempotency key from header
    const idempotencyKey = request.headers.get('Idempotency-Key');

    console.log('🔄 Processing refund (CEO pattern):', { 
      order_id, 
      amount, 
      reason, 
      has_idempotency: !!idempotencyKey 
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

    // Check for cached idempotent response
    if (idempotencyKey) {
      const cached = await checkIdempotency(env, idempotencyKey, order.merchant_id);
      if (cached) {
        console.log('✅ Returning cached response from idempotency check');
        return Response.json(cached, { 
          headers: { 
            ...corsHeaders,
            'X-Idempotency-Cached': 'true'
          } 
        });
      }
    }

    // Check if already refunded
    if (order.has_refund) {
      const response = {
        success: true,
        message: 'Order already refunded',
        order_id,
        amount
      };

      if (idempotencyKey) {
        await storeIdempotency(env, idempotencyKey, order.merchant_id, 'refund', response);
      }

      return Response.json(response, { headers: corsHeaders });
    }

    const isTestnet = env.PI_NETWORK === 'testnet';
    const piApiUrl = isTestnet 
      ? 'https://api.testnet.minepi.com'
      : 'https://api.minepi.com';

    // STEP 1: Create U2A Payment on Pi Network
    console.log('📥 Step 1: Creating U2A payment on Pi Network...');

    const paymentBody = {
      payment: {
        amount: parseFloat(amount),
        memo: reason || `Refund for order ${order_id}`,
        metadata: {
          order_id: order_id,
          type: 'refund',
          original_amount: order.total_amt
        },
        uid: order.user_uid  // User who will receive the refund
      }
    };

    const createResponse = await fetch(`${piApiUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${env.PI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentBody)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create refund payment: ${errorText}`);
    }

    const paymentData = await createResponse.json();
    const paymentIdentifier = paymentData.identifier;
    const recipientAddress = paymentData.to_address;  // ← Pi provides this!

    console.log('✅ U2A payment created:', paymentIdentifier);
    console.log('✅ Recipient address:', recipientAddress);

    // STEP 2: Setup Stellar/Pi Blockchain Connection
    console.log('🔗 Step 2: Setting up Stellar connection...');

    const horizonUrl = isTestnet
      ? 'https://api.testnet.minepi.com'
      : 'https://api.mainnet.minepi.com';
    
    const networkPassphrase = isTestnet ? 'Pi Testnet' : 'Pi Network';

    const server = new Horizon.Server(horizonUrl);
    const sourceKeypair = Keypair.fromSecret(env.APP_WALLET_SECRET);
    const sourcePublicKey = sourceKeypair.publicKey();

    console.log('🔗 Loading account:', sourcePublicKey);

    // STEP 3: Load Account and Build Transaction
    const account = await server.loadAccount(sourcePublicKey);
    const baseFee = await server.fetchBaseFee();

    console.log('💳 Step 3: Building Stellar transaction...');

    const transaction = new TransactionBuilder(account, {
      fee: baseFee.toString(),
      networkPassphrase: networkPassphrase
    })
      .addOperation(Operation.payment({
        destination: recipientAddress,  // ← Use address from Pi!
        asset: Asset.native(),
        amount: amount.toString()
      }))
      .addMemo(Memo.text(paymentIdentifier))
      .setTimeout(180)
      .build();

    // STEP 4: Sign Transaction
    transaction.sign(sourceKeypair);
    console.log('✅ Transaction signed locally');

    // STEP 5: Submit to Stellar Network
    console.log('📤 Step 4: Submitting to Stellar network...');
    
    const submitResult = await server.submitTransaction(transaction);
    const txid = submitResult.hash;
    
    console.log('✅ Transaction submitted:', txid);

    // STEP 6: Complete Payment on Pi Platform
    console.log('✔️ Step 5: Completing payment on Pi Platform...');

    const completeResponse = await fetch(
      `${piApiUrl}/v2/payments/${paymentIdentifier}/complete`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.PI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ txid })
      }
    );

    if (!completeResponse.ok) {
      console.warn('⚠️ Complete API warning:', await completeResponse.text());
    } else {
      console.log('✅ Payment completed on Pi Platform');
    }

    // STEP 7: Update Database
    console.log('💾 Step 6: Updating database...');

    await env.DB.prepare(`
      UPDATE paypi_orders
      SET 
        has_refund = 1, 
        refunded_at = unixepoch(),
        refund_payment_id = ?,
        refund_txid = ?
      WHERE order_id = ?
    `).bind(paymentIdentifier, txid, order_id).run();

    // STEP 8: Return Credits to Merchant
    const creditsToRefund = calculateCreditCost(amount);
    
    await env.DB.prepare(`
      UPDATE merchants
      SET credit_balance = credit_balance + ?
      WHERE merchant_id = ?
    `).bind(creditsToRefund, order.merchant_id).run();

    // Log credit refund
    await env.DB.prepare(`
      INSERT INTO credit_transactions (
        tx_id, merchant_id, type, amount, pi_amount,
        balance_after, description, created_at
      )
      SELECT 
        ?, ?, 'refund', ?, ?,
        credit_balance, ?, unixepoch()
      FROM merchants
      WHERE merchant_id = ?
    `).bind(
      `REFUND_${Date.now()}`,
      order.merchant_id,
      creditsToRefund,
      amount,
      `Refund completed for ${order_id}`,
      order.merchant_id
    ).run();

    console.log('✅ Credits returned to merchant:', creditsToRefund);
    console.log('🎉 Refund completed successfully!');

    // STEP 9: Prepare Response
    const response = {
      success: true,
      order_id: order_id,
      payment_identifier: paymentIdentifier,
      txid: txid,
      amount: amount,
      credits_refunded: creditsToRefund,
      recipient_address: recipientAddress,
      message: 'Refund completed successfully!'
    };

    // Store idempotency
    if (idempotencyKey) {
      await storeIdempotency(env, idempotencyKey, order.merchant_id, 'refund', response);
      console.log('✅ Stored idempotency key');
    }

    return Response.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Refund error:', error);
    return Response.json({
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
    },
  });
}