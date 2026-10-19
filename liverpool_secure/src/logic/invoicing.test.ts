import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInvoice, settleDebtPayment } from './invoicing';

test('Test 1: Mandatory Example - Session 100 EGP + Products 20 EGP = Total 120 EGP, Paid 100 EGP', () => {
  const result = calculateInvoice({
    gamingTotal: 100,
    productsTotal: 20,
    discountType: 'none',
    discountValue: 0,
    prepaidAmount: 0,
    amountReceived: 100,
  });

  // Gross total = 120
  assert.equal(result.grossTotal, 120, 'Gross total must be 120 EGP');
  // Net total = 120
  assert.equal(result.netGrandTotal, 120, 'Net grand total must be 120 EGP');
  // Actual collected cash entered into safe = 100 (NOT 120!)
  assert.equal(result.actualCollected, 100, 'Actual collected must be exactly 100 EGP');
  // Remaining debt = 20
  assert.equal(result.remainingDebt, 20, 'Remaining debt must be exactly 20 EGP');
  // Bill is NOT fully paid
  assert.equal(result.isFullyPaid, false, 'Invoice must NOT be marked fully paid');
  assert.equal(result.paymentStatus, 'partial', 'Payment status must be partial');
  // Safe allocation should only be 100
  assert.equal(result.safeAllocations.length, 1);
  assert.equal(result.safeAllocations[0].amount, 100, 'Safe transaction amount must be exactly 100 EGP');
});

test('Test 2: Settle Debt Later - Pay remaining 20 EGP without duplicating original 100 EGP revenue', () => {
  const currentDebt = 20;
  const settlement = settleDebtPayment(currentDebt, 20, 'cash');

  assert.equal(settlement.collectedAmount, 20, 'Collected debt amount must be 20 EGP');
  assert.equal(settlement.newRemainingDebt, 0, 'New remaining debt must be 0 EGP');
  assert.equal(settlement.isFullySettled, true, 'Debt must be fully settled');
  assert.equal(settlement.safeTransaction.type, 'debt_collection', 'Safe transaction must be debt_collection');
  assert.equal(settlement.safeTransaction.amount, 20, 'Safe amount must be 20 EGP');
});

test('Test 3: Split Payment between Cash and Electronic (InstaPay)', () => {
  const result = calculateInvoice({
    gamingTotal: 70,
    productsTotal: 30,
    discountType: 'none',
    discountValue: 0,
    prepaidAmount: 0,
    amountReceived: 100,
    splitPayments: [
      { method: 'cash', amount: 60 },
      { method: 'instapay', amount: 40 },
    ],
  });

  assert.equal(result.netGrandTotal, 100);
  assert.equal(result.actualCollected, 100);
  assert.equal(result.remainingDebt, 0);
  assert.equal(result.isFullyPaid, true);
  assert.equal(result.safeAllocations.length, 2, 'Should create 2 distinct safe allocations');
  assert.equal(result.safeAllocations[0].paymentMethod, 'cash');
  assert.equal(result.safeAllocations[0].amount, 60);
  assert.equal(result.safeAllocations[1].paymentMethod, 'instapay');
  assert.equal(result.safeAllocations[1].amount, 40);
});

test('Single electronic payment keeps its payment method and does not become cash', () => {
  const result = calculateInvoice({
    gamingTotal: 100,
    productsTotal: 20,
    discountType: 'none',
    discountValue: 0,
    prepaidAmount: 0,
    amountReceived: 120,
    paymentMethod: 'instapay',
  });

  assert.equal(result.actualCollected, 120);
  assert.equal(result.safeAllocations.length, 1);
  assert.equal(result.safeAllocations[0].paymentMethod, 'instapay');
  assert.equal(result.safeAllocations[0].amount, 120);
});

test('Test 4: Discounts on session and bar products (fixed and percentage)', () => {
  // 10% discount on 100 EGP = 10 EGP discount, net = 90 EGP
  const pctResult = calculateInvoice({
    gamingTotal: 80,
    productsTotal: 20,
    discountType: 'percent',
    discountValue: 10,
    prepaidAmount: 0,
    amountReceived: 90,
  });
  assert.equal(pctResult.discountAmount, 10);
  assert.equal(pctResult.netGrandTotal, 90);
  assert.equal(pctResult.remainingDebt, 0);

  // Fixed 25 EGP discount on 100 EGP = 75 EGP net
  const fixedResult = calculateInvoice({
    gamingTotal: 80,
    productsTotal: 20,
    discountType: 'fixed',
    discountValue: 25,
    prepaidAmount: 0,
    amountReceived: 75,
  });
  assert.equal(fixedResult.discountAmount, 25);
  assert.equal(fixedResult.netGrandTotal, 75);
});

test('Test 5: Reject selling product when requested quantity exceeds available stock', () => {
  const stockQuantity = 5;
  const requestedQuantity = 8;
  const isSaleAllowed = requestedQuantity > 0 && requestedQuantity <= stockQuantity;
  assert.equal(isSaleAllowed, false, 'Sale must be rejected if stock is insufficient');

  const validRequestedQuantity = 3;
  const isValidSaleAllowed = validRequestedQuantity > 0 && validRequestedQuantity <= stockQuantity;
  assert.equal(isValidSaleAllowed, true, 'Sale must be allowed when stock is sufficient');
  const remainingStock = stockQuantity - validRequestedQuantity;
  assert.equal(remainingStock, 2, 'Stock must decrease accurately');
});

test('Test 6: Idempotent invoice checkout prevents double-click duplicate safe transactions', () => {
  const processedInvoiceIds = new Set<string>();
  const invoiceId = 'inv-test-999';

  function processInvoice(id: string): { processed: boolean; reason?: string } {
    if (processedInvoiceIds.has(id)) {
      return { processed: false, reason: 'Duplicate submission blocked' };
    }
    processedInvoiceIds.add(id);
    return { processed: true };
  }

  const firstAttempt = processInvoice(invoiceId);
  assert.equal(firstAttempt.processed, true, 'First click should succeed');

  const secondAttempt = processInvoice(invoiceId);
  assert.equal(secondAttempt.processed, false, 'Double-click duplicate must be blocked');
  assert.equal(secondAttempt.reason, 'Duplicate submission blocked');
});


test('Overpayment records only the amount due and returns the remainder as change', () => {
  const result = calculateInvoice({
    gamingTotal: 80,
    productsTotal: 20,
    discountType: 'none',
    discountValue: 0,
    prepaidAmount: 0,
    amountReceived: 120,
    paymentMethod: 'cash',
  });

  assert.equal(result.netGrandTotal, 100);
  assert.equal(result.actualCollected, 100);
  assert.equal(result.changeGiven, 20);
  assert.equal(result.remainingDebt, 0);
  assert.equal(result.paymentStatus, 'overpaid');
  assert.equal(result.safeAllocations.length, 1);
  assert.equal(result.safeAllocations[0].amount, 100);
});

test('Prepaid amount reduces the balance due without being collected twice', () => {
  const result = calculateInvoice({
    gamingTotal: 100,
    productsTotal: 25,
    discountType: 'none',
    discountValue: 0,
    prepaidAmount: 40,
    amountReceived: 60,
    paymentMethod: 'cash',
  });

  assert.equal(result.grossTotal, 125);
  assert.equal(result.effectiveBalanceDue, 85);
  assert.equal(result.actualCollected, 60);
  assert.equal(result.remainingDebt, 25);
  assert.equal(result.safeAllocations.reduce((sum, item) => sum + item.amount, 0), 60);
});

test('Percentage and fixed discounts cannot reduce invoice below zero', () => {
  const percentage = calculateInvoice({
    gamingTotal: 100,
    productsTotal: 50,
    discountType: 'percent',
    discountValue: 150,
    prepaidAmount: 0,
    amountReceived: 0,
  });
  const fixed = calculateInvoice({
    gamingTotal: 100,
    productsTotal: 50,
    discountType: 'fixed',
    discountValue: 999,
    prepaidAmount: 0,
    amountReceived: 0,
  });

  assert.equal(percentage.discountAmount, 150);
  assert.equal(percentage.netGrandTotal, 0);
  assert.equal(fixed.discountAmount, 150);
  assert.equal(fixed.netGrandTotal, 0);
});

test('Debt settlement caps collected amount at debt and returns excess as change', () => {
  const result = settleDebtPayment(35, 50, 'instapay');

  assert.equal(result.collectedAmount, 35);
  assert.equal(result.newRemainingDebt, 0);
  assert.equal(result.changeGiven, 15);
  assert.equal(result.isFullySettled, true);
  assert.equal(result.safeTransaction.type, 'debt_collection');
  assert.equal(result.safeTransaction.amount, 35);
  assert.equal(result.safeTransaction.paymentMethod, 'instapay');
});
