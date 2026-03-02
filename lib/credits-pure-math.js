// lib/credits-pure-math.js
/**
 * Pure Math Credit Calculation Library
 * 
 * Simple, transparent credit system:
 * - Deposit: 1π = 1 credit (1:1)
 * - Payment: cost = amount × 0.02 (2% fee)
 * - Capacity: credits ÷ 0.02 = π processable
 */

export function calculateCreditsFromDeposit(piAmount) {
  if (typeof piAmount !== 'number' || piAmount < 0) {
    throw new Error('Invalid π amount');
  }
  return piAmount; // 1:1 ratio
}

export function calculateCreditCost(paymentAmount) {
  if (typeof paymentAmount !== 'number' || paymentAmount <= 0) {
    throw new Error('Invalid payment amount');
  }
  return paymentAmount * 0.02; // 2% fee
}

export function calculateCapacity(credits) {
  if (typeof credits !== 'number' || credits < 0) {
    throw new Error('Invalid credits');
  }
  return credits / 0.02;
}

export function checkSufficientCredits(currentBalance, paymentAmount) {
  const needed = calculateCreditCost(paymentAmount);
  const sufficient = currentBalance >= needed;
  
  return {
    sufficient,
    balance: currentBalance,
    needed,
    remaining: sufficient ? currentBalance - needed : currentBalance,
    capacity_after: sufficient ? calculateCapacity(currentBalance - needed) : 0,
    shortage: sufficient ? 0 : needed - currentBalance
  };
}

export const CREDIT_CONSTANTS = {
  FEE_RATE: 0.02,
  DEPOSIT_RATIO: 1,
  LOW_BALANCE_WARNING: 20,
  ZERO_BALANCE: 0
};