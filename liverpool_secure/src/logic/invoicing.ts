/**
 * Liverpool Gaming - Invoicing & Debt Settlement Engine
 * Pure logic module for financial reconciliation, partial payments,
 * split payment distribution, debt collection, and refunds.
 */

import { SplitPaymentPortion, SafeTransaction, SafeTransactionType } from '../types';

export interface InvoiceCalculationInput {
  gamingTotal: number;
  productsTotal: number;
  discountType: 'none' | 'fixed' | 'percent';
  discountValue: number;
  prepaidAmount: number;
  amountReceived: number;
  paymentMethod?: 'cash' | 'instapay' | 'vodafone' | 'card';
  splitPayments?: SplitPaymentPortion[];
}

export interface InvoiceCalculationResult {
  grossTotal: number;           // gaming + products
  discountAmount: number;       // calculated discount
  netGrandTotal: number;        // grossTotal - discountAmount
  effectiveBalanceDue: number;  // netGrandTotal - prepaidAmount
  actualCollected: number;      // cash/electronic actually received now
  remainingDebt: number;        // any unpaid amount remaining
  changeGiven: number;          // change returned to customer
  isFullyPaid: boolean;         // true if debt is 0
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'overpaid';
  safeAllocations: Array<{
    type: SafeTransactionType;
    amount: number;
    paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card';
    description: string;
  }>;
}

/**
 * Calculates a complete invoice with strict validation of collected amounts,
 * partial payments, and split payment methods.
 */
export function calculateInvoice(input: InvoiceCalculationInput): InvoiceCalculationResult {
  const grossTotal = Math.max(0, input.gamingTotal + input.productsTotal);
  
  // Calculate discount
  let discountAmount = 0;
  if (input.discountType === 'percent') {
    const pct = Math.max(0, Math.min(100, input.discountValue));
    discountAmount = Math.round(((grossTotal * pct) / 100) * 100) / 100;
  } else if (input.discountType === 'fixed') {
    discountAmount = Math.max(0, Math.min(grossTotal, input.discountValue));
  }
  
  const netGrandTotal = Math.max(0, grossTotal - discountAmount);
  const prepaid = Math.max(0, input.prepaidAmount || 0);
  const effectiveBalanceDue = Math.max(0, netGrandTotal - prepaid);

  // Validate received amount
  let totalReceived = Math.max(0, input.amountReceived || 0);
  
  // If split payments are provided, ensure total received matches the split portions
  if (input.splitPayments && input.splitPayments.length > 0) {
    const splitSum = input.splitPayments.reduce((sum, p) => sum + Math.max(0, p.amount), 0);
    totalReceived = splitSum;
  }

  let changeGiven = 0;
  let remainingDebt = 0;
  let actualCollected = 0;

  if (totalReceived >= effectiveBalanceDue) {
    // Paid in full or overpaid (with change)
    actualCollected = effectiveBalanceDue;
    changeGiven = Math.max(0, totalReceived - effectiveBalanceDue);
    remainingDebt = 0;
  } else {
    // Partial payment
    actualCollected = totalReceived;
    changeGiven = 0;
    remainingDebt = Math.max(0, effectiveBalanceDue - totalReceived);
  }

  const isFullyPaid = remainingDebt <= 0;
  let paymentStatus: 'paid' | 'partial' | 'unpaid' | 'overpaid' = 'unpaid';
  if (isFullyPaid) {
    paymentStatus = changeGiven > 0 ? 'overpaid' : 'paid';
  } else if (actualCollected > 0) {
    paymentStatus = 'partial';
  }

  // Build safe transaction allocations (ONLY for actual collected money)
  const safeAllocations: InvoiceCalculationResult['safeAllocations'] = [];
  
  if (actualCollected > 0) {
    if (input.splitPayments && input.splitPayments.length > 0) {
      // Allocate proportionally or directly based on split portions
      let remainingToAllocate = actualCollected;
      for (const split of input.splitPayments) {
        if (remainingToAllocate <= 0) break;
        const allocAmount = Math.min(split.amount, remainingToAllocate);
        if (allocAmount > 0) {
          safeAllocations.push({
            type: 'gaming_revenue',
            amount: allocAmount,
            paymentMethod: split.method,
            description: `تحصيل فاتورة (دفع مجزأ - ${split.method})`,
          });
          remainingToAllocate -= allocAmount;
        }
      }
    } else {
      // Single payment method
      safeAllocations.push({
        type: 'gaming_revenue',
        amount: actualCollected,
        paymentMethod: input.paymentMethod || 'cash',
        description: `تحصيل فاتورة`,
      });
    }
  }

  return {
    grossTotal,
    discountAmount,
    netGrandTotal,
    effectiveBalanceDue,
    actualCollected,
    remainingDebt,
    changeGiven,
    isFullyPaid,
    paymentStatus,
    safeAllocations,
  };
}

/**
 * Handles debt collection for an existing invoice without duplicating original revenues.
 */
export function settleDebtPayment(
  currentRemainingDebt: number,
  amountPaid: number,
  paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card'
): {
  collectedAmount: number;
  newRemainingDebt: number;
  changeGiven: number;
  isFullySettled: boolean;
  safeTransaction: {
    type: SafeTransactionType;
    amount: number;
    paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card';
    description: string;
  };
} {
  const debt = Math.max(0, currentRemainingDebt);
  const paid = Math.max(0, amountPaid);
  
  const collectedAmount = Math.min(debt, paid);
  const changeGiven = Math.max(0, paid - debt);
  const newRemainingDebt = Math.max(0, debt - collectedAmount);
  const isFullySettled = newRemainingDebt === 0;

  return {
    collectedAmount,
    newRemainingDebt,
    changeGiven,
    isFullySettled,
    safeTransaction: {
      type: 'debt_collection',
      amount: collectedAmount,
      paymentMethod,
      description: `سداد مديونية سابقة`,
    },
  };
}
