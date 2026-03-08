// functions/api/merchant/credit-deposit.js
/**
 * Merchant Credit Deposit (U2A Payment) + Idempotency
 * 
 * Merchant sends π to PayPi platform wallet
 * System adds credits to merchant's account
 * 
 * Pure Math:
 * 1π deposited = 1 credit = 50π processing capacity (at 2% fee)
 * 200π deposited = 200 credits = 10,000π capacity
 * 
 * Flow:
 * 1. Check idempotency (prevent duplicate deposits)
 * 2. Verify payment on Pi Network
 * 3. Approve & complete payment
 * 4. Calculate credits (1:1 ratio)
 * 5. Update merchant balance
 * 6. Log credit transaction
 * 7. Store idempotency response
 */

import { 
  calculateCreditsFromDeposit,
  calculateCapacity 
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
  };

  try {
    const { pi_payment_id, txid, merchant_id, amount } = await request.json();

    // STEP 1: Get idempotency key from header
    const idempotencyKey = request.headers.get('Idempotency-Key');

    console.log('💰 Credit deposit:', { 
      pi_payment_id, 
      txid, 
      merchant_id, 
      amount, 
      has_idempotency: !!idempotencyKey 
    });

    // STEP 2: Check for cached idempotent response
    if (idempotencyKey) {
      const cached = await checkIdempotency(env, idempotencyKey, merchant_id);
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

    // STEP 3: Verify payment on Pi Network
    const piRes = await fetch(
      `https://api.${env.PI_NETWORK === 'testnet' ? 'testnet.' : ''}minepi.com/v2/payments/${pi_payment_id}`, 
      {
        headers: { 
          'Authorization': `Key ${env.PI_API_KEY}` 
        }
      }
    );

    if (!piRes.ok) {
      throw new Error('Failed to verify payment with Pi Network');
    }

    const payment = await piRes.json();

    // Verify payment details
    if (payment.amount !== amount) {
      throw new Error('Payment amount mismatch');
    }

    if (payment.status.developer_completed) {
      // Already processed - return success without re-processing
      const response = {
        success: true,
        message: 'Deposit already processed',
        deposit_amount: amount + 'π',
        credits_added: 0,
        txid: txid
      };

      // Store in idempotency cache
      if (idempotencyKey) {
        await storeIdempotency(env, idempotencyKey, merchant_id, 'credit-deposit', response);
      }

      return Response.json(response, { headers: corsHeaders });
    }

    // STEP 4: Approve payment (accept the deposit)
    await fetch(
      `https://api.${env.PI_NETWORK === 'testnet' ? 'testnet.' : ''}minepi.com/v2/payments/${pi_payment_id}/approve`, 
      {
        method: 'POST',
        headers: { 
          'Authorization': `Key ${env.PI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // STEP 5: Complete payment
    await fetch(
      `https://api.${env.PI_NETWORK === 'testnet' ? 'testnet.' : ''}minepi.com/v2/payments/${pi_payment_id}/complete`, 
      {
        method: 'POST',
        headers: { 
          'Authorization': `Key ${env.PI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ txid })
      }
    );

    // STEP 6: Calculate credits using pure math function
    const creditsToAdd = calculateCreditsFromDeposit(amount);

    // STEP 7: Update merchant balance
    const merchant = await env.DB.prepare(`
      UPDATE merchants 
      SET 
        credit_balance = credit_balance + ?,
        total_deposits = total_deposits + ?,
        low_balance_warning = 0,
        payments_enabled = 1
      WHERE merchant_id = ?
      RETURNING credit_balance, total_deposits
    `).bind(creditsToAdd, amount, merchant_id).first();

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // STEP 8: Log credit transaction
    await env.DB.prepare(`
      INSERT INTO credit_transactions (
        tx_id,
        merchant_id,
        type,
        amount,
        pi_amount,
        balance_after,
        description,
        pi_txid,
        created_at
      ) VALUES (?, ?, 'deposit', ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      `DEPOSIT_${Date.now()}`,
      merchant_id,
      creditsToAdd,
      amount,
      merchant.credit_balance,
      `Credit deposit via ${pi_payment_id}`,
      txid
    ).run();

    console.log('✅ Credits added:', {
      merchant_id,
      credits_added: creditsToAdd,
      new_balance: merchant.credit_balance
    });

    // STEP 9: Prepare success response
    const response = {
      success: true,
      message: 'Credits added successfully!',
      deposit_amount: amount + 'π',
      credits_added: creditsToAdd,
      new_balance: merchant.credit_balance + ' credits',
      capacity: calculateCapacity(merchant.credit_balance) + 'π can process',
      fee_rate: '2%',
      txid: txid
    };

    // STEP 10: Store idempotency key for future duplicate requests
    if (idempotencyKey) {
      await storeIdempotency(env, idempotencyKey, merchant_id, 'credit-deposit', response);
      console.log('✅ Stored idempotency key:', idempotencyKey);
    }

    return Response.json(response, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Credit deposit error:', error);
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