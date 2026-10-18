import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShiftClosing, validateHandoverChecklist } from './shift';

test('Shift closing formula: expected = opening + cashReceipts - expenses - withdrawals - advances', () => {
  const result = calculateShiftClosing({
    openingCash: 500,
    cashReceipts: 1200,
    cashExpenses: 150,
    cashWithdrawals: 200,
    cashAdvances: 100,
    otherCashOut: 0,
    actualClosingCash: 1250,
    electronicReceipts: 600,
  });

  // Expected = 500 + 1200 - 150 - 200 - 100 = 1250
  assert.equal(result.expectedClosingCash, 1250);
  assert.equal(result.actualClosingCash, 1250);
  assert.equal(result.discrepancy, 0);
  assert.equal(result.hasDiscrepancy, false);
  assert.equal(result.electronicReceiptsTotal, 600);
});

test('Shift closing accurately records cash deficit/surplus', () => {
  const result = calculateShiftClosing({
    openingCash: 0,
    cashReceipts: 1180,
    cashExpenses: 120,
    cashWithdrawals: 0,
    cashAdvances: 0,
    otherCashOut: 0,
    actualClosingCash: 1040,
    electronicReceipts: 70,
  });

  // Expected = 1180 - 120 = 1060. Actual = 1040 -> diff = -20
  assert.equal(result.expectedClosingCash, 1060);
  assert.equal(result.discrepancy, -20);
  assert.equal(result.hasDiscrepancy, true);
});

test('Handover checklist blocks submission when required items are unchecked', () => {
  const incomplete = validateHandoverChecklist({
    cashCounted: true,
    ps4Checked: true,
    ps5Checked: false, // missing
    controllersCounted: true,
    controllersCount: 8,
    cupsStockChecked: true,
    teaStockChecked: false, // missing
    coffeeStockChecked: true,
    noodleStockChecked: true,
  });
  assert.equal(incomplete.isValid, false);
  assert.ok(incomplete.missingItems.includes('فحص أجهزة PS5'));

  const complete = validateHandoverChecklist({
    cashCounted: true,
    ps4Checked: true,
    ps5Checked: true,
    controllersCounted: true,
    controllersCount: 8,
    cupsStockChecked: true,
    teaStockChecked: true,
    coffeeStockChecked: true,
    noodleStockChecked: true,
  });
  assert.equal(complete.isValid, true);
  assert.equal(complete.missingItems.length, 0);
});
