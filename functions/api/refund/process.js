// functions/api/refund/process.js
/**
 * DIAGNOSTIC VERSION - Find exact line causing "invalid encoded string"
 */

import { Keypair, TransactionBuilder, Operation, Asset, Horizon, Memo } from '@stellar/stellar-sdk';
import fetchAdapter from '@vespaiach/axios-fetch-adapter';

Horizon.AxiosClient.defaults.adapter = fetchAdapter;

import { calculateCreditCost } from '../../../lib/credits-pure-math.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
  };

  try {
    const { order_id, amount, reason } = await request.json();

    console.log('🔄 DIAGNOSTIC MODE - Finding error location');
    console.log('Order:', order_id, 'Amount:', amount);

    // Get order
    const order = await env.DB.prepare(
      'SELECT * FROM paypi_orders WHERE order_id = ?'
    ).bind(order_id).first();

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404, headers: corsHeaders });
    }

    if (order.has_refund) {
      return Response.json({ success: true, message: 'Already refunded' }, { headers: corsHeaders });
    }

    const isTestnet = env.PI_NETWORK === 'testnet';
    const piPlatformUrl = 'https://api.minepi.com';
    const stellarHorizonUrl = isTestnet
      ? 'https://api.testnet.minepi.com'
      : 'https://api.mainnet.minepi.com';

    // Create payment
    console.log('📥 Creating payment...');

    const paymentBody = {
      payment: {
        amount: parseFloat(amount),
        memo: reason || `Refund for ${order_id}`,
        metadata: { order_id, type: 'refund' },
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
      throw new Error(`Create failed: ${errorText}`);
    }

    const paymentData = await createResponse.json();
    const paymentIdentifier = paymentData.identifier;
    const recipientAddress = paymentData.to_address;

    console.log('✅ Payment created');
    console.log('   ID:', paymentIdentifier);
    console.log('   To:', recipientAddress);

    // TEST 1: Validate recipient address
    console.log('🧪 TEST 1: Validating recipient address...');
    console.log('   Type:', typeof recipientAddress);
    console.log('   Length:', recipientAddress?.length);
    console.log('   First char:', recipientAddress?.[0]);
    
    if (!recipientAddress || typeof recipientAddress !== 'string') {
      throw new Error('Invalid recipient address from Pi API');
    }
    console.log('✅ Recipient address valid');

    // TEST 2: Validate APP_WALLET_SECRET
    console.log('🧪 TEST 2: Validating APP_WALLET_SECRET...');
    console.log('   Has secret:', !!env.APP_WALLET_SECRET);
    console.log('   Secret type:', typeof env.APP_WALLET_SECRET);
    console.log('   Secret length:', env.APP_WALLET_SECRET?.length);
    console.log('   First char:', env.APP_WALLET_SECRET?.[0]);
    
    if (!env.APP_WALLET_SECRET || typeof env.APP_WALLET_SECRET !== 'string') {
      throw new Error('APP_WALLET_SECRET is missing or invalid');
    }
    
    if (!env.APP_WALLET_SECRET.startsWith('S')) {
      throw new Error(`APP_WALLET_SECRET must start with 'S', got: ${env.APP_WALLET_SECRET[0]}`);
    }
    console.log('✅ APP_WALLET_SECRET format looks valid');

    // TEST 3: Create Keypair
    console.log('🧪 TEST 3: Creating Keypair from secret...');
    
    let sourceKeypair;
    try {
      sourceKeypair = Keypair.fromSecret(env.APP_WALLET_SECRET);
      console.log('✅ Keypair created successfully');
      console.log('   Public key:', sourceKeypair.publicKey());
    } catch (keypairError) {
      console.error('❌ Keypair creation failed!');
      throw new Error(`Failed to create Keypair: ${keypairError.message}. Your APP_WALLET_SECRET may be invalid.`);
    }

    // TEST 4: Create Horizon Server
    console.log('🧪 TEST 4: Creating Horizon server...');
    
    let server;
    try {
      server = new Horizon.Server(stellarHorizonUrl);
      console.log('✅ Horizon server created');
    } catch (serverError) {
      throw new Error(`Failed to create Horizon server: ${serverError.message}`);
    }

    // TEST 5: Load account
    console.log('🧪 TEST 5: Loading account from Horizon...');
    
    let account;
    try {
      account = await server.loadAccount(sourceKeypair.publicKey());
      console.log('✅ Account loaded');
    } catch (loadError) {
      throw new Error(`Failed to load account: ${loadError.message}`);
    }

    // TEST 6: Get base fee
    console.log('🧪 TEST 6: Getting base fee...');
    
    let baseFee;
    try {
      baseFee = await server.fetchBaseFee();
      console.log('✅ Base fee:', baseFee);
    } catch (feeError) {
      throw new Error(`Failed to get base fee: ${feeError.message}`);
    }

    // TEST 7: Build transaction
    console.log('🧪 TEST 7: Building transaction...');
    console.log('   Destination:', recipientAddress);
    console.log('   Amount:', amount.toString());
    console.log('   Memo:', paymentIdentifier);
    
    let transaction;
    try {
      transaction = new TransactionBuilder(account, {
        fee: baseFee.toString(),
        networkPassphrase: isTestnet ? 'Pi Testnet' : 'Pi Network'
      })
        .addOperation(Operation.payment({
          destination: recipientAddress,
          asset: Asset.native(),
          amount: amount.toString()
        }))
        .addMemo(Memo.text(paymentIdentifier))
        .setTimeout(180)
        .build();
      
      console.log('✅ Transaction built successfully');
    } catch (buildError) {
      console.error('❌ Transaction build failed!');
      console.error('   Error:', buildError.message);
      console.error('   Stack:', buildError.stack);
      throw new Error(`Transaction build failed: ${buildError.message}`);
    }

    // TEST 8: Sign transaction
    console.log('🧪 TEST 8: Signing transaction...');
    
    try {
      transaction.sign(sourceKeypair);
      console.log('✅ Transaction signed');
    } catch (signError) {
      throw new Error(`Signing failed: ${signError.message}`);
    }

    // All tests passed!
    console.log('🎉 ALL TESTS PASSED - Proceeding with submission...');

    // Submit transaction
    const submitResult = await server.submitTransaction(transaction);
    const txid = submitResult.hash;
    
    console.log('✅ Transaction submitted:', txid);

    // Complete payment
    await fetch(`${piPlatformUrl}/v2/payments/${paymentIdentifier}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${env.PI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ txid })
    });

    // Update database
    await env.DB.prepare(`
      UPDATE paypi_orders SET has_refund = 1, refunded_at = unixepoch()
      WHERE order_id = ?
    `).bind(order_id).run();

    const creditsToRefund = calculateCreditCost(amount);
    
    await env.DB.prepare(`
      UPDATE merchants SET credit_balance = credit_balance + ?
      WHERE merchant_id = ?
    `).bind(creditsToRefund, order.merchant_id).run();

    console.log('🎉 Refund completed successfully!');

    return Response.json({
      success: true,
      payment_identifier: paymentIdentifier,
      txid: txid,
      credits_refunded: creditsToRefund,
      message: 'Refund completed successfully!'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ ERROR AT:', error.message);
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