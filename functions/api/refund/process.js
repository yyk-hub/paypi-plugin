// functions/api/refund/process.js
/**
 * Process Refund with Partial Refund Support
 * 
 * Supports:
 * - Full refunds
 * - Partial refunds (multiple per order)
 * - Tracks all refunds in refunds table
 * - Updates total_refunded on orders
 */

import { Keypair, TransactionBuilder, Operation, Asset, Horizon, Memo } from '@stellar/stellar-sdk';
import fetchAdapter from '@vespaiach/axios-fetch-adapter';

Horizon.AxiosClient.defaults.adapter = fetchAdapter;

import { calculateCreditCost } from '../../../lib/credits-pure-math.js';
import { checkIdempotency, storeIdempotency } from '../../../lib/idempotency.js';

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

    console.log('🔄 Processing refund:', { order_id, amount, reason });

    // Get order details
    const order = await env.DB.prepare(`
      SELECT * FROM paypi_orders WHERE order_id = ?
    `).bind(order_id).first();

    if (!order) {
      return Response.json({
        error: 'Order not found'
      }, { status: 404, headers: corsHeaders });
    }

    console.log('📦 Order:', {
      order_id: order.order_id,
      total_amt: order.total_amt,
      total_refunded: order.total_refunded || 0,
      remaining: order.total_amt - (order.total_refunded || 0)
    });

    // Check idempotency cache
    if (idempotencyKey) {
      const cached = await checkIdempotency(env, idempotencyKey, order.merchant_id);
      if (cached) {
        console.log('✅ Returning cached response');
        return Response.json(cached, {
          headers: { ...corsHeaders, 'X-Idempotency-Cached': 'true' }
        });
      }
    }

    // Calculate remaining refundable amount
    const totalRefunded = order.total_refunded || 0;
    const remainingAmount = order.total_amt - totalRefunded;

    console.log('💰 Refund amounts:', {
      total_order: order.total_amt,
      already_refunded: totalRefunded,
      remaining: remainingAmount,
      requested: amount
    });

    // Validate refund amount
    if (amount <= 0) {
      return Response.json({
        error: 'Refund amount must be positive'
      }, { status: 400, headers: corsHeaders });
    }

    if (amount > remainingAmount) {
      return Response.json({
        error: `Cannot refund ${amount}π. Only ${remainingAmount.toFixed(7)}π remaining (original: ${order.total_amt}π, already refunded: ${totalRefunded.toFixed(7)}π)`
      }, { status: 400, headers: corsHeaders });
    }

    const isTestnet = env.PI_NETWORK === 'testnet';
    const piPlatformUrl = 'https://api.minepi.com';
    const stellarHorizonUrl = isTestnet
      ? 'https://api.testnet.minepi.com'
      : 'https://api.mainnet.minepi.com';

    let paymentIdentifier;
    let recipientAddress;

    // STEP 0: Check for incomplete payments
    console.log('🔍 Checking for incomplete payments...');

    try {
      const incompleteRes = await fetch(
        `${piPlatformUrl}/v2/payments/incomplete_server_payments`,
        { headers: { 'Authorization': `Key ${env.PI_API_KEY}` } }
      );

      if (incompleteRes.ok) {
        const incompleteData = await incompleteRes.json();
        let incompletePayments = Array.isArray(incompleteData)
          ? incompleteData
          : (incompleteData.incomplete_payments || incompleteData.payments || []);

        const existingPayment = incompletePayments.find(
          p => p.user_uid === order.user_uid && !p.status?.cancelled
        );

        if (existingPayment) {
          console.log('🔄 Found incomplete payment - will complete it!');
          paymentIdentifier = existingPayment.identifier;
          recipientAddress = existingPayment.to_address;
          console.log('✅ Reusing incomplete payment');
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not check incomplete:', err.message);
    }

    // Generate refund ID
    const refundId = `REF_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // STEP 1: Create new payment ONLY if no incomplete payment found
    if (!paymentIdentifier) {
      console.log('📥 Creating new U2A payment...');

      const paymentBody = {
        payment: {
          amount: parseFloat(amount),
          memo: reason || `Refund for order ${order_id}`,
          metadata: {
            order_id: order_id,
            refund_id: refundId,
            type: 'refund',
            original_amount: order.total_amt,
            refund_type: amount >= order.total_amt ? 'full' : 'partial'
          },
          uid: order.user_uid
        }
      };

      const createResponse = await fetch(`${piPlatformUrl}/v2/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${env.PI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentBody)
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create payment: ${errorText}`);
      }

      const paymentData = await createResponse.json();
      paymentIdentifier = paymentData.identifier;
      recipientAddress = paymentData.to_address;

      console.log('✅ New payment created:', paymentIdentifier);
    }

    console.log('📍 Payment ID:', paymentIdentifier);
    console.log('📍 Recipient:', recipientAddress);

    // STEP 2: Create refund record
    console.log('💾 Creating refund record...');

    await env.DB.prepare(`
      INSERT INTO refunds (
        refund_id, order_id, user_uid, merchant_id,
        payment_identifier, recipient_address,
        amount, original_amount,
        memo, reason,
        refund_status, created_at, initiated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', unixepoch(), unixepoch())
    `).bind(
      refundId,
      order_id,
      order.user_uid,
      order.merchant_id,
      paymentIdentifier,
      recipientAddress,
      amount,
      order.total_amt,
      reason || `Refund for ${order_id}`,
      reason,
    ).run();

    console.log('✅ Refund record created:', refundId);

    // STEP 3: Setup Stellar Connection
    console.log('🔗 Setting up Stellar connection...');

    const networkPassphrase = isTestnet ? 'Pi Testnet' : 'Pi Network';
    const server = new Horizon.Server(stellarHorizonUrl);
    const sourceKeypair = Keypair.fromSecret(env.APP_WALLET_SECRET);

    // STEP 4: Build and Submit Transaction
    console.log('💳 Building Stellar transaction...');

    const account = await server.loadAccount(sourceKeypair.publicKey());
    const baseFee = await server.fetchBaseFee();

    const transaction = new TransactionBuilder(account, {
      fee: baseFee.toString(),
      networkPassphrase: networkPassphrase
    })
      .addOperation(Operation.payment({
        destination: recipientAddress,
        asset: Asset.native(),
        amount: amount.toString()
      }))
      .addMemo(Memo.text(paymentIdentifier))
      .setTimeout(180)
      .build();

    transaction.sign(sourceKeypair);
    console.log('✅ Transaction signed');

    console.log('📤 Submitting to Stellar...');
    const submitResult = await server.submitTransaction(transaction);
    const txid = submitResult.hash;

    console.log('✅ Transaction submitted:', txid);

    // STEP 5: Complete Payment on Pi Platform
    console.log('✔️ Completing payment on Pi...');

    const completeResponse = await fetch(
      `${piPlatformUrl}/v2/payments/${paymentIdentifier}/complete`,
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
      const completeError = await completeResponse.text();
      console.warn('⚠️ Complete warning:', completeError);
    } else {
      console.log('✅ Payment completed on Pi');
    }

    // STEP 6: Update refund record as completed
    console.log('💾 Updating refund record...');

    await env.DB.prepare(`
      UPDATE refunds
      SET 
        txid = ?,
        refund_status = 'completed',
        completed_at = unixepoch()
      WHERE refund_id = ?
    `).bind(txid, refundId).run();

    // STEP 7: Update order total_refunded
    const newTotalRefunded = totalRefunded + parseFloat(amount);

    await env.DB.prepare(`
      UPDATE paypi_orders
      SET 
        total_refunded = ?,
        has_refund = 1,
        refunded_at = COALESCE(refunded_at, unixepoch())
      WHERE order_id = ?
    `).bind(newTotalRefunded, order_id).run();

    console.log('✅ Order updated - total refunded:', newTotalRefunded);

    // STEP 8: Return Credits
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
      SELECT ?, ?, 'refund', ?, ?, credit_balance, ?, unixepoch()
      FROM merchants WHERE merchant_id = ?
    `).bind(
      refundId,
      order.merchant_id,
      creditsToRefund,
      amount,
      `${amount >= order.total_amt ? 'Full' : 'Partial'} refund for ${order_id} (${amount}π of ${order.total_amt}π)`,
      order.merchant_id
    ).run();

    console.log('✅ Credits returned:', creditsToRefund);
    console.log('🎉 Refund completed successfully!');

    const response = {
      success: true,
      refund_id: refundId,
      order_id: order_id,
      payment_identifier: paymentIdentifier,
      txid: txid,
      amount: amount,
      refund_type: amount >= order.total_amt ? 'full' : 'partial',
      total_refunded: newTotalRefunded,
      remaining_refundable: order.total_amt - newTotalRefunded,
      credits_refunded: creditsToRefund,
      recipient_address: recipientAddress,
      message: `${amount >= order.total_amt ? 'Full' : 'Partial'} refund completed successfully!`
    };

    if (idempotencyKey) {
      await storeIdempotency(env, idempotencyKey, order.merchant_id, 'refund', response);
    }

    return Response.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Refund error:', error);
    console.error('Stack:', error.stack);

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