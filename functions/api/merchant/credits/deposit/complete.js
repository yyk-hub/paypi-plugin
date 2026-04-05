// functions/api/merchant/credits/deposit/complete.js
/**
 * Credit Deposit Completion
 * 
 * Called by Pi SDK after merchant approves payment
 * Credits merchant account automatically
 */

export async function onRequest(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json({
      success: false,
      error: 'Method not allowed'
    }, { status: 405, headers: corsHeaders });
  }

  try {
    const { deposit_id, pi_payment_id, txid } = await request.json();

    if (!deposit_id) {
      return Response.json({
        success: false,
        error: 'Missing deposit_id'
      }, { status: 400, headers: corsHeaders });
    }

    // Get deposit record
    const deposit = await env.DB.prepare(
      'SELECT * FROM credit_deposits WHERE deposit_id = ?'
    ).bind(deposit_id).first();

    if (!deposit) {
      return Response.json({
        success: false,
        error: 'Deposit not found'
      }, { status: 404, headers: corsHeaders });
    }

    // Check if already completed
    if (deposit.status === 'completed') {
      return Response.json({
        success: true,
        message: 'Deposit already processed',
        deposit_id: deposit_id
      }, { headers: corsHeaders });
    }

    // Update deposit status
    await env.DB.prepare(`
      UPDATE credit_deposits 
      SET status = 'completed',
          pi_payment_id = ?,
          txid = ?,
          completed_at = unixepoch()
      WHERE deposit_id = ?
    `).bind(pi_payment_id, txid, deposit_id).run();

    // Add credits to merchant account
    await env.DB.prepare(`
      UPDATE merchants 
      SET credit_balance = credit_balance + ?,
          total_deposits = total_deposits + ?,
          updated_at = unixepoch()
      WHERE merchant_id = ?
    `).bind(deposit.credits, deposit.amount, deposit.merchant_id).run();

    console.log('✅ Credits added:', deposit.merchant_id, '+', deposit.credits);

    // Get updated merchant balance
    const merchant = await env.DB.prepare(
      'SELECT credit_balance, total_deposits FROM merchants WHERE merchant_id = ?'
    ).bind(deposit.merchant_id).first();

    return Response.json({
      success: true,
      message: 'Credits added successfully',
      deposit_id: deposit_id,
      amount: deposit.amount,
      credits_added: deposit.credits,
      new_balance: merchant.credit_balance,
      total_deposits: merchant.total_deposits
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Deposit completion error:', error);
    return Response.json({
      success: false,
      error: 'Failed to process deposit'
    }, { status: 500, headers: corsHeaders });
  }
}