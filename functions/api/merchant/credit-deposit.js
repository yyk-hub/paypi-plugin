// functions/api/merchant/credit-deposit.js
/**
 * Merchant Credit Deposit (U2A Payment)
 * 
 * Merchant sends π to PayPi platform wallet
 * System adds credits to merchant's account
 * 
 * Calculation:
 * 1π deposited = 100 credits = 50π worth of processing (at 2% fee)
 * 200π deposited = 20,000 credits = 10,000π worth of processing
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const { pi_payment_id, txid, merchant_id, amount } = await request.json();

    console.log('💰 Credit deposit:', { pi_payment_id, txid, merchant_id, amount });

    // Verify payment on Pi Network
    const piRes = await fetch(`https://api.${env.PI_NETWORK === 'testnet' ? 'testnet.' : ''}minepi.com/v2/payments/${pi_payment_id}`, {
      headers: { 
        'Authorization': `Key ${env.PI_API_KEY}` 
      }
    });

    if (!piRes.ok) {
      throw new Error('Failed to verify payment with Pi Network');
    }

    const payment = await piRes.json();

    // Verify payment details
    if (payment.amount !== amount) {
      throw new Error('Payment amount mismatch');
    }

    if (payment.status.developer_completed) {
      // Already processed
      return Response.json({
        success: true,
        message: 'Deposit already processed',
        credits_added: 0
      }, { headers: corsHeaders });
    }

    // Approve payment (accept the deposit)
    await fetch(`https://api.${env.PI_NETWORK === 'testnet' ? 'testnet.' : ''}minepi.com/v2/payments/${pi_payment_id}/approve`, {
      method: 'POST',
      headers: { 
        'Authorization': `Key ${env.PI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Complete payment
    await fetch(`https://api.${env.PI_NETWORK === 'testnet' ? 'testnet.' : ''}minepi.com/v2/payments/${pi_payment_id}/complete`, {
      method: 'POST',
      headers: { 
        'Authorization': `Key ${env.PI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ txid })
    });

    // Calculate credits (Pure Math: 1π = 1 credit)
    // At 2% fee: 1 credit allows processing 50π
    // Example: 200π deposit = 200 credits = 10,000π capacity
    const creditsToAdd = depositAmount;  // 1:1 ratio

    // Update merchant balance
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

    // Send notification email (optional)
    // TODO: Implement email notification

    return Response.json({
      success: true,
      message: 'Credits added successfully!',
      deposit_amount: amount + 'π',
      credits_added: creditsToAdd,
      new_balance: merchant.credit_balance + ' credits',
      capacity: (merchant.credit_balance / 0.02) + 'π can process',
      fee_rate: '2%',
      txid: txid
    }, { headers: corsHeaders });

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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}