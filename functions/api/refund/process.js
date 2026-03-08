// functions/api/refund/process.js
/**
 * Process A2U Refund + Idempotency
 * 
 * IMPORTANT: Imports Stellar SDK with Cloudflare-compatible initialization
 * 
 * Flow:
 * 1. Check idempotency (prevent duplicate refunds)
 * 2. Verify order exists and not already refunded
 * 3. Initialize Stellar server
 * 4. Create refund transaction (A2U)
 * 5. Submit to Stellar network
 * 6. Update database (set has_refund = 1)
 * 7. Return credits to merchant
 * 8. Log credit refund
 * 9. Store idempotency response
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

    // STEP 1: Get idempotency key from header
    const idempotencyKey = request.headers.get('Idempotency-Key');

    console.log('🔄 Processing refund:', { 
      order_id, 
      amount, 
      reason, 
      has_idempotency: !!idempotencyKey 
    });

    // STEP 2: Get order details
    const order = await env.DB.prepare(
      'SELECT * FROM paypi_orders WHERE order_id = ?'
    ).bind(order_id).first();

    if (!order) {
      return Response.json({
        error: 'Order not found'
      }, { status: 404, headers: corsHeaders });
    }

    // STEP 3: Check for cached idempotent response
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

    // STEP 4: Check if already refunded
    if (order.has_refund) {
      const response = {
        success: true,
        message: 'Order already refunded',
        order_id,
        amount,
        txid: null  // Don't have original txid
      };

      // Store in idempotency cache
      if (idempotencyKey) {
        await storeIdempotency(env, idempotencyKey, order.merchant_id, 'refund', response);
      }

      return Response.json(response, { headers: corsHeaders });
    }

    // STEP 5: Initialize Stellar server (uses fetch adapter now!)
    const isTestnet = env.PI_NETWORK === 'testnet';
    const networkUrl = isTestnet 
      ? 'https://api.testnet.minepi.com'
      : 'https://api.mainnet.minepi.com';
    
    const server = new Horizon.Server(networkUrl);
    const networkPassphrase = isTestnet ? Networks.TESTNET : Networks.PUBLIC;

    // STEP 6: Load source account (merchant's app wallet)
    const sourceKeypair = Keypair.fromSecret(env.APP_WALLET_SECRET);
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

    console.log('✅ Source account loaded:', sourceKeypair.publicKey());

    // STEP 7: Create refund transaction
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: networkPassphrase
    })
      .addOperation(
        Operation.payment({
          destination: order.user_uid,  // Customer's wallet
          asset: Asset.native(),
          amount: amount.toString()
        })
      )
      .addMemo(Memo.text(`Refund: ${order_id}`))
      .setTimeout(30)
      .build();

    // STEP 8: Sign transaction
    transaction.sign(sourceKeypair);

    // STEP 9: Submit to Stellar network (uses fetch!)
    const result = await server.submitTransaction(transaction);

    console.log('✅ Refund submitted:', result.hash);

    // STEP 10: Update database
    await env.DB.prepare(`
      UPDATE paypi_orders
      SET has_refund = 1, refunded_at = unixepoch()
      WHERE order_id = ?
    `).bind(order_id).run();

    // STEP 11: Refund credits to merchant using pure math function
    // When refunding payment, merchant gets credits back
    const creditsToRefund = calculateCreditCost(amount);
    
    await env.DB.prepare(`
      UPDATE merchants
      SET credit_balance = credit_balance + ?
      WHERE merchant_id = ?
    `).bind(creditsToRefund, order.merchant_id).run();

    // STEP 12: Log credit refund
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
      `Refund for ${order_id}`,
      order.merchant_id
    ).run();

    console.log('✅ Refund complete:', {
      order_id,
      txid: result.hash,
      credits_refunded: creditsToRefund
    });

    // STEP 13: Prepare success response
    const response = {
      success: true,
      txid: result.hash,
      amount: amount,
      credits_refunded: creditsToRefund,
      message: 'Refund processed successfully'
    };

    // STEP 14: Store idempotency key for future duplicate requests
    if (idempotencyKey) {
      await storeIdempotency(env, idempotencyKey, order.merchant_id, 'refund', response);
      console.log('✅ Stored idempotency key:', idempotencyKey);
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