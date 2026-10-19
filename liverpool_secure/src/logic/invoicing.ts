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
 * Monetary input ceiling prevents finite-but-extreme numbers from overflowing
 * sums and rounding operations. Values above this business-safe ceiling are
 * clamped before any invoice arithmetic is performed.
 */
const MAX_MONEY_AMOUNT = 1_000_000_000_000;

/**
 * Calculates a complete invoice with strict validation of collected amounts,
 * partial payments, and split payment methods.
 */
function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_MONEY_AMOUNT, Math.max(0, value)) : 0;
}

const PAYMENT_METHODS = new Set(['cash', 'instapay', 'vodafone', 'card']);

function safePaymentMethod(value: unknown): 'cash' | 'instapay' | 'vodafone' | 'card' {
  return typeof value === 'string' && PAYMENT_METHODS.has(value) ? value as 'cash' | 'instapay' | 'vodafone' | 'card' : 'cash';
}

export function calculateInvoice(input: InvoiceCalculationInput): InvoiceCalculationResult {
  const gamingTotal = nonNegativeFinite(input.gamingTotal);
  const productsTotal = nonNegativeFinite(input.productsTotal);
  const grossTotal = Math.round((gamingTotal + productsTotal) * 100) / 100;
  
  // Calculate discount
  let discountAmount = 0;
  if (input.discountType === 'percent') {
    const pct = Math.max(0, Math.min(100, nonNegativeFinite(input.discountValue)));
    discountAmount = Math.round(((grossTotal * pct) / 100) * 100) / 100;
  } else if (input.discountType === 'fixed') {
    discountAmount = Math.max(0, Math.min(grossTotal, nonNegativeFinite(input.discountValue)));
  }
  
  const netGrandTotal = Math.max(0, grossTotal - discountAmount);
  const prepaid = nonNegativeFinite(input.prepaidAmount);
  const effectiveBalanceDue = Math.max(0, netGrandTotal - prepaid);

  // Treat runtime payloads defensively: malformed split entries must not crash checkout.
  const splitPayments = Array.isArray(input.splitPayments)
    ? input.splitPayments.filter((portion): portion is SplitPaymentPortion => Boolean(portion && typeof portion === 'object'))
    : [];

  // If the caller supplied split-payment entries, never fall back to amountReceived
  // when every entry is malformed. Doing so could mark a split invoice paid without a
  // valid payment allocation. A partially valid list uses only its valid entries.
  const hasSplitPaymentInput = Array.isArray(input.splitPayments) && input.splitPayments.length > 0;
  let totalReceived = nonNegativeFinite(input.amountReceived);

  if (hasSplitPaymentInput) {
    totalReceived = splitPayments.reduce((sum, p) => sum + nonNegativeFinite(p.amount), 0);
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
    if (splitPayments.length > 0) {
      // Allocate proportionally or directly based on split portions
      let remainingToAllocate = actualCollected;
      for (const split of splitPayments) {
        if (remainingToAllocate <= 0) break;
        const allocAmount = Math.min(nonNegativeFinite(split.amount), remainingToAllocate);
        if (allocAmount > 0) {
          safeAllocations.push({
            type: 'gaming_revenue',
            amount: allocAmount,
            paymentMethod: safePaymentMethod(split.method),
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
        paymentMethod: safePaymentMethod(input.paymentMethod),
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
  const debt = nonNegativeFinite(currentRemainingDebt);
  const paid = nonNegativeFinite(amountPaid);
  
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
      paymentMethod: safePaymentMethod(paymentMethod),
      description: `سداد مديونية سابقة`,
    },
  };
}
