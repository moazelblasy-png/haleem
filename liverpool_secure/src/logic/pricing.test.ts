import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSegmentCost,
  calculateSessionGamingCost,
  calculateBudgetSessionDetails,
  calculatePaymentBalance,
  calculateInvoiceTotals,
  DEFAULT_PRICE_TIERS
} from './pricing';

test('PS4 - 2 controllers price matches default tiers exactly', () => {
  assert.equal(calculateSegmentCost('PS4', 2, 15, DEFAULT_PRICE_TIERS).cost, 5);
  assert.equal(calculateSegmentCost('PS4', 2, 30, DEFAULT_PRICE_TIERS).cost, 10);
  assert.equal(calculateSegmentCost('PS4', 2, 45, DEFAULT_PRICE_TIERS).cost, 15);
  assert.equal(calculateSegmentCost('PS4', 2, 60, DEFAULT_PRICE_TIERS).cost, 20);
  assert.equal(calculateSegmentCost('PS4', 2, 75, DEFAULT_PRICE_TIERS).cost, 25);
  assert.equal(calculateSegmentCost('PS4', 2, 90, DEFAULT_PRICE_TIERS).cost, 30);
  assert.equal(calculateSegmentCost('PS4', 2, 105, DEFAULT_PRICE_TIERS).cost, 35);
  assert.equal(calculateSegmentCost('PS4', 2, 120, DEFAULT_PRICE_TIERS).cost, 40);
});

test('PS5 - 4 controllers price matches default tiers exactly', () => {
  assert.equal(calculateSegmentCost('PS5', 4, 15, DEFAULT_PRICE_TIERS).cost, 15);
  assert.equal(calculateSegmentCost('PS5', 4, 30, DEFAULT_PRICE_TIERS).cost, 20);
  assert.equal(calculateSegmentCost('PS5', 4, 45, DEFAULT_PRICE_TIERS).cost, 35);
  assert.equal(calculateSegmentCost('PS5', 4, 60, DEFAULT_PRICE_TIERS).cost, 40);
  assert.equal(calculateSegmentCost('PS5', 4, 75, DEFAULT_PRICE_TIERS).cost, 55);
  assert.equal(calculateSegmentCost('PS5', 4, 90, DEFAULT_PRICE_TIERS).cost, 60);
  assert.equal(calculateSegmentCost('PS5', 4, 105, DEFAULT_PRICE_TIERS).cost, 75);
  assert.equal(calculateSegmentCost('PS5', 4, 120, DEFAULT_PRICE_TIERS).cost, 80);
});

test('Rounding rule rounds up to next 15-minute mark (ceil_quarter)', () => {
  const result = calculateSegmentCost('PS4', 2, 70, DEFAULT_PRICE_TIERS, 'ceil_quarter');
  assert.equal(result.billedMinutes, 75);
  assert.equal(result.cost, 25);
});

test('Minimum session duration is 15 minutes', () => {
  const result = calculateSegmentCost('PS5', 2, 5, DEFAULT_PRICE_TIERS, 'ceil_quarter');
  assert.equal(result.billedMinutes, 15);
  assert.equal(result.cost, 10);
});

test('Historical session minimum uses captured tiers after current prices change', () => {
  const capturedTiers = DEFAULT_PRICE_TIERS.map(t => ({ ...t }));
  const currentTiers = DEFAULT_PRICE_TIERS.map(t =>
    t.deviceType === 'PS5' && t.controllers === 2 && t.durationMinutes === 15
      ? { ...t, priceEgp: 99 }
      : { ...t }
  );
  const result = calculateSessionGamingCost([
    { id: 'old-session', deviceType: 'PS5', controllers: 2, startTime: 0, appliedPriceTiers: capturedTiers },
  ], 60_000, currentTiers);
  assert.equal(result.totalCost, 10);
});

test('Non-finite session duration never produces NaN pricing output', () => {
  const result = calculateSegmentCost('PS5', 2, Number.NaN, DEFAULT_PRICE_TIERS);
  assert.equal(Number.isFinite(result.cost), true);
  assert.equal(Number.isFinite(result.billedMinutes), true);
});

test('Invoice preview can exclude products already paid', () => {
  const unpaidOnly = calculateInvoiceTotals(100, 0, 'none', 0, 0);
  assert.equal(unpaidOnly.grandTotal, 100);
});

test('Handles mid-session controller switch correctly across multiple segments', () => {
  const baseTime = 1000000;
  const segments = [
    {
      id: 'seg-1',
      deviceType: 'PS4' as const,
      controllers: 2 as const,
      startTime: baseTime,
      endTime: baseTime + (30 * 60 * 1000),
    },
    {
      id: 'seg-2',
      deviceType: 'PS4' as const,
      controllers: 3 as const,
      startTime: baseTime + (30 * 60 * 1000),
      endTime: baseTime + (60 * 60 * 1000),
    }
  ];
  const { totalCost, totalMinutes } = calculateSessionGamingCost(segments, baseTime + (60 * 60 * 1000), DEFAULT_PRICE_TIERS);
  assert.equal(totalMinutes, 60);
  assert.equal(totalCost, 10 + 15); // 25 EGP
});

test('Budget session: 85 EGP on PS5 with 2 controllers allows 170 minutes at 0.5 EGP/min', () => {
  const { allowedMinutes, minuteRate } = calculateBudgetSessionDetails(85, 'PS5', 2, DEFAULT_PRICE_TIERS);
  assert.equal(minuteRate, 0.5);
  assert.equal(allowedMinutes, 170);
});

test('Payment balance calculation for change and debt', () => {
  const p1 = calculatePaymentBalance(135, 200);
  assert.equal(p1.change, 65);
  assert.equal(p1.remainingDebt, 0);
  assert.equal(p1.isSettled, true);

  const p2 = calculatePaymentBalance(135, 100);
  assert.equal(p2.change, 0);
  assert.equal(p2.remainingDebt, 35);
  assert.equal(p2.isSettled, false);
});
