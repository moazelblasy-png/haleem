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


test('Electronic receipts never increase the physical cash drawer balance', () => {
  const cashOnly = calculateShiftClosing({
    openingCash: 100,
    cashReceipts: 50,
    cashExpenses: 10,
    cashWithdrawals: 0,
    cashAdvances: 0,
    actualClosingCash: 140,
    electronicReceipts: 0,
  });
  const withElectronic = calculateShiftClosing({
    openingCash: 100,
    cashReceipts: 50,
    cashExpenses: 10,
    cashWithdrawals: 0,
    cashAdvances: 0,
    actualClosingCash: 140,
    electronicReceipts: 900,
  });

  assert.equal(cashOnly.expectedClosingCash, 140);
  assert.equal(withElectronic.expectedClosingCash, 140);
  assert.equal(withElectronic.electronicReceiptsTotal, 900);
  assert.equal(withElectronic.totalNetRevenue, 940);
});

test('Other cash outflows are deducted from expected closing cash', () => {
  const result = calculateShiftClosing({
    openingCash: 200,
    cashReceipts: 100,
    cashExpenses: 20,
    cashWithdrawals: 10,
    cashAdvances: 15,
    otherCashOut: 5,
    actualClosingCash: 250,
    electronicReceipts: 30,
  });

  assert.equal(result.expectedClosingCash, 250);
  assert.equal(result.discrepancy, 0);
  assert.equal(result.totalNetRevenue, 110);
});

test('Shift cash calculations round monetary results to two decimals', () => {
  const result = calculateShiftClosing({
    openingCash: 10.105,
    cashReceipts: 0.205,
    cashExpenses: 0,
    cashWithdrawals: 0,
    cashAdvances: 0,
    actualClosingCash: 10.31,
    electronicReceipts: 0.105,
  });

  assert.equal(result.expectedClosingCash, 10.31);
  assert.equal(result.actualClosingCash, 10.31);
  assert.equal(result.discrepancy, 0);
  assert.equal(result.electronicReceiptsTotal, 0.11);
});
