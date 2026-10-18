/**
 * Liverpool Gaming - Pricing & Session Calculation Engine
 * Pure logic module for tiered pricing, controller variations, mid-session switches (controllers & PS4/PS5),
 * custom minute calculations, and budget sessions.
 */

import { PriceTier, DeviceType, ControllersCount, RoundingPolicy, SessionSegment } from '../types';
export type { PriceTier, DeviceType, ControllersCount, RoundingPolicy, SessionSegment };

export const DEFAULT_PRICE_TIERS: PriceTier[] = [
  // PS4 - 2 controllers (20 EGP/hr)
  { id: 'ps4-2-15', deviceType: 'PS4', controllers: 2, durationMinutes: 15, priceEgp: 5 },
  { id: 'ps4-2-30', deviceType: 'PS4', controllers: 2, durationMinutes: 30, priceEgp: 10 },
  { id: 'ps4-2-45', deviceType: 'PS4', controllers: 2, durationMinutes: 45, priceEgp: 15 },
  { id: 'ps4-2-60', deviceType: 'PS4', controllers: 2, durationMinutes: 60, priceEgp: 20 },
  { id: 'ps4-2-75', deviceType: 'PS4', controllers: 2, durationMinutes: 75, priceEgp: 25 },
  { id: 'ps4-2-90', deviceType: 'PS4', controllers: 2, durationMinutes: 90, priceEgp: 30 },
  { id: 'ps4-2-105', deviceType: 'PS4', controllers: 2, durationMinutes: 105, priceEgp: 35 },
  { id: 'ps4-2-120', deviceType: 'PS4', controllers: 2, durationMinutes: 120, priceEgp: 40 },

  // PS4 - 3 controllers (25 EGP/hr)
  { id: 'ps4-3-15', deviceType: 'PS4', controllers: 3, durationMinutes: 15, priceEgp: 10 },
  { id: 'ps4-3-30', deviceType: 'PS4', controllers: 3, durationMinutes: 30, priceEgp: 15 },
  { id: 'ps4-3-45', deviceType: 'PS4', controllers: 3, durationMinutes: 45, priceEgp: 20 },
  { id: 'ps4-3-60', deviceType: 'PS4', controllers: 3, durationMinutes: 60, priceEgp: 25 },
  { id: 'ps4-3-75', deviceType: 'PS4', controllers: 3, durationMinutes: 75, priceEgp: 35 },
  { id: 'ps4-3-90', deviceType: 'PS4', controllers: 3, durationMinutes: 90, priceEgp: 40 },
  { id: 'ps4-3-105', deviceType: 'PS4', controllers: 3, durationMinutes: 105, priceEgp: 45 },
  { id: 'ps4-3-120', deviceType: 'PS4', controllers: 3, durationMinutes: 120, priceEgp: 50 },

  // PS4 - 4 controllers (35 EGP/hr)
  { id: 'ps4-4-15', deviceType: 'PS4', controllers: 4, durationMinutes: 15, priceEgp: 10 },
  { id: 'ps4-4-30', deviceType: 'PS4', controllers: 4, durationMinutes: 30, priceEgp: 15 },
  { id: 'ps4-4-45', deviceType: 'PS4', controllers: 4, durationMinutes: 45, priceEgp: 30 },
  { id: 'ps4-4-60', deviceType: 'PS4', controllers: 4, durationMinutes: 60, priceEgp: 35 },
  { id: 'ps4-4-75', deviceType: 'PS4', controllers: 4, durationMinutes: 75, priceEgp: 45 },
  { id: 'ps4-4-90', deviceType: 'PS4', controllers: 4, durationMinutes: 90, priceEgp: 55 },
  { id: 'ps4-4-105', deviceType: 'PS4', controllers: 4, durationMinutes: 105, priceEgp: 65 },
  { id: 'ps4-4-120', deviceType: 'PS4', controllers: 4, durationMinutes: 120, priceEgp: 70 },

  // PS5 - 2 controllers (30 EGP/hr)
  { id: 'ps5-2-15', deviceType: 'PS5', controllers: 2, durationMinutes: 15, priceEgp: 10 },
  { id: 'ps5-2-30', deviceType: 'PS5', controllers: 2, durationMinutes: 30, priceEgp: 15 },
  { id: 'ps5-2-45', deviceType: 'PS5', controllers: 2, durationMinutes: 45, priceEgp: 25 },
  { id: 'ps5-2-60', deviceType: 'PS5', controllers: 2, durationMinutes: 60, priceEgp: 30 },
  { id: 'ps5-2-75', deviceType: 'PS5', controllers: 2, durationMinutes: 75, priceEgp: 40 },
  { id: 'ps5-2-90', deviceType: 'PS5', controllers: 2, durationMinutes: 90, priceEgp: 45 },
  { id: 'ps5-2-105', deviceType: 'PS5', controllers: 2, durationMinutes: 105, priceEgp: 55 },
  { id: 'ps5-2-120', deviceType: 'PS5', controllers: 2, durationMinutes: 120, priceEgp: 60 },

  // PS5 - 3 controllers (35 EGP/hr)
  { id: 'ps5-3-15', deviceType: 'PS5', controllers: 3, durationMinutes: 15, priceEgp: 10 },
  { id: 'ps5-3-30', deviceType: 'PS5', controllers: 3, durationMinutes: 30, priceEgp: 20 },
  { id: 'ps5-3-45', deviceType: 'PS5', controllers: 3, durationMinutes: 45, priceEgp: 30 },
  { id: 'ps5-3-60', deviceType: 'PS5', controllers: 3, durationMinutes: 60, priceEgp: 35 },
  { id: 'ps5-3-75', deviceType: 'PS5', controllers: 3, durationMinutes: 75, priceEgp: 50 },
  { id: 'ps5-3-90', deviceType: 'PS5', controllers: 3, durationMinutes: 90, priceEgp: 55 },
  { id: 'ps5-3-105', deviceType: 'PS5', controllers: 3, durationMinutes: 105, priceEgp: 65 },
  { id: 'ps5-3-120', deviceType: 'PS5', controllers: 3, durationMinutes: 120, priceEgp: 70 },

  // PS5 - 4 controllers (40 EGP/hr)
  { id: 'ps5-4-15', deviceType: 'PS5', controllers: 4, durationMinutes: 15, priceEgp: 15 },
  { id: 'ps5-4-30', deviceType: 'PS5', controllers: 4, durationMinutes: 30, priceEgp: 20 },
  { id: 'ps5-4-45', deviceType: 'PS5', controllers: 4, durationMinutes: 45, priceEgp: 35 },
  { id: 'ps5-4-60', deviceType: 'PS5', controllers: 4, durationMinutes: 60, priceEgp: 40 },
  { id: 'ps5-4-75', deviceType: 'PS5', controllers: 4, durationMinutes: 75, priceEgp: 55 },
  { id: 'ps5-4-90', deviceType: 'PS5', controllers: 4, durationMinutes: 90, priceEgp: 60 },
  { id: 'ps5-4-105', deviceType: 'PS5', controllers: 4, durationMinutes: 105, priceEgp: 75 },
  { id: 'ps5-4-120', deviceType: 'PS5', controllers: 4, durationMinutes: 120, priceEgp: 80 },
];

/**
 * Returns minute rate and 1-hour rate for a device & controller tier
 */
export function getDeviceTierRates(
  deviceType: DeviceType,
  controllers: ControllersCount,
  tiers: PriceTier[] = DEFAULT_PRICE_TIERS
): { hourRate: number; minuteRate: number; min15Rate: number } {
  const match = tiers.filter(t => t.deviceType === deviceType && t.controllers === controllers);
  const hourTier = match.find(t => t.durationMinutes === 60);
  const min15Tier = match.find(t => t.durationMinutes === 15);
  const hourRate = hourTier?.priceEgp ?? (deviceType === 'PS5' ? 30 : 20);
  const min15Rate = min15Tier?.priceEgp ?? (hourRate / 4);
  const minuteRate = Math.round((hourRate / 60) * 1000) / 1000;
  return { hourRate, minuteRate, min15Rate };
}

/**
 * Rounds duration in minutes based on owner policy:
 * Minimum 15 minutes applies to total session or standalone segment.
 */
export function roundDurationMinutes(rawMinutes: number, policy: RoundingPolicy = 'ceil_quarter'): number {
  if (rawMinutes <= 0) return 15;
  if (rawMinutes < 15) return 15;
  if (policy === 'ceil_quarter' || policy === 'ceil_tier') {
    return Math.ceil(rawMinutes / 15) * 15;
  }
  return Math.round(rawMinutes);
}

/**
 * Calculate the cost of a single segment duration (in minutes).
 */
export function calculateSegmentCost(
  deviceType: DeviceType,
  controllers: ControllersCount,
  durationMinutes: number,
  tiers: PriceTier[] = DEFAULT_PRICE_TIERS,
  policy: RoundingPolicy = 'ceil_quarter',
  isSubSegment: boolean = false
): { cost: number; billedMinutes: number } {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    return { cost: 0, billedMinutes: 0 };
  }

  const effectiveMinutes = isSubSegment
    ? Math.max(0, durationMinutes)
    : roundDurationMinutes(durationMinutes, policy);

  if (effectiveMinutes <= 0) {
    return { cost: 0, billedMinutes: 0 };
  }

  const matchingTiers = tiers
    .filter(t => t.deviceType === deviceType && t.controllers === controllers && Number.isFinite(t.priceEgp) && t.priceEgp >= 0)
    .sort((a, b) => a.durationMinutes - b.durationMinutes);

  const { hourRate } = getDeviceTierRates(deviceType, controllers, tiers);

  // Exact tier match (15, 30, 45, 60, etc.)
  const exactTier = matchingTiers.find(t => t.durationMinutes === effectiveMinutes);
  if (exactTier) {
    return { cost: exactTier.priceEgp, billedMinutes: effectiveMinutes };
  }

  const maxTier = matchingTiers[matchingTiers.length - 1] || { durationMinutes: 120, priceEgp: hourRate * 2 };

  if (effectiveMinutes <= maxTier.durationMinutes) {
    if (!isSubSegment && policy === 'ceil_quarter') {
      const nextQuarter = Math.ceil(effectiveMinutes / 15) * 15;
      const matched = matchingTiers.find(t => t.durationMinutes === nextQuarter);
      if (matched) {
        return { cost: matched.priceEgp, billedMinutes: nextQuarter };
      }
    }

    const lowerTier = [...matchingTiers].reverse().find(t => t.durationMinutes < effectiveMinutes) || { durationMinutes: 0, priceEgp: 0 };
    const upperTier = matchingTiers.find(t => t.durationMinutes > effectiveMinutes) || maxTier;
    const span = upperTier.durationMinutes - lowerTier.durationMinutes;

    if (span > 0) {
      const progress = (effectiveMinutes - lowerTier.durationMinutes) / span;
      const interpolated = lowerTier.priceEgp + progress * (upperTier.priceEgp - lowerTier.priceEgp);
      return { cost: Math.round(interpolated * 10) / 10, billedMinutes: Math.round(effectiveMinutes) };
    }
  }

  // Beyond 120 minutes: 2-hour blocks + remainder
  const twoHourBlocks = Math.floor(effectiveMinutes / 120);
  const remainderMinutes = effectiveMinutes % 120;
  let remainderCost = 0;
  if (remainderMinutes > 0) {
    const remainderResult = calculateSegmentCost(deviceType, controllers, remainderMinutes, tiers, policy, true);
    remainderCost = remainderResult.cost;
  }
  const totalCost = (twoHourBlocks * maxTier.priceEgp) + remainderCost;
  return { cost: Math.round(totalCost * 10) / 10, billedMinutes: Math.round(effectiveMinutes) };
}

/**
 * Calculates total gaming cost across multiple segments (handles controller change 2 -> 3 -> 4, and PS4 <-> PS5 console switches).
 */
export function calculateSessionGamingCost(
  segments: SessionSegment[],
  nowMs: number = Date.now(),
  tiers: PriceTier[] = DEFAULT_PRICE_TIERS,
  policy: RoundingPolicy = 'ceil_quarter'
): {
  totalCost: number;
  totalMinutes: number;
  segmentBreakdown: Array<{
    segmentId: string;
    minutes: number;
    billedMinutes: number;
    cost: number;
    controllers: ControllersCount;
    deviceType: DeviceType;
  }>;
} {
  if (!segments || segments.length === 0) {
    return { totalCost: 0, totalMinutes: 0, segmentBreakdown: [] };
  }

  let rawTotalMinutes = 0;
  const isMultiSegment = segments.length > 1;
  const tempSegments: Array<{ seg: SessionSegment; rawMinutes: number }> = [];

  for (const seg of segments) {
    const end = seg.endTime || nowMs;
    const rawMinutes = Math.max(0, (end - seg.startTime) / (1000 * 60));
    rawTotalMinutes += rawMinutes;
    tempSegments.push({ seg, rawMinutes });
  }

  let totalCost = 0;
  const segmentBreakdown = [];

  for (const { seg, rawMinutes } of tempSegments) {
    const segmentTiers = seg.appliedPriceTiers && seg.appliedPriceTiers.length > 0 ? seg.appliedPriceTiers : tiers;
    const { cost, billedMinutes } = calculateSegmentCost(
      seg.deviceType,
      seg.controllers,
      rawMinutes,
      segmentTiers,
      policy,
      isMultiSegment
    );
    totalCost += cost;
    segmentBreakdown.push({
      segmentId: seg.id,
      minutes: Math.round(rawMinutes * 10) / 10,
      billedMinutes: Math.round(billedMinutes),
      cost: Math.round(cost * 10) / 10,
      controllers: seg.controllers,
      deviceType: seg.deviceType,
    });
  }

  // Minimum session 15 mins
  if (rawTotalMinutes < 15 && segments.length > 0) {
    const firstSeg = segments[0];
    const firstSegmentTiers = firstSeg.appliedPriceTiers && firstSeg.appliedPriceTiers.length > 0
      ? firstSeg.appliedPriceTiers
      : tiers;
    const { min15Rate } = getDeviceTierRates(firstSeg.deviceType, firstSeg.controllers, firstSegmentTiers);
    totalCost = Math.max(totalCost, min15Rate);
  }

  return {
    totalCost: Math.round(totalCost * 10) / 10,
    totalMinutes: Math.round(rawTotalMinutes),
    segmentBreakdown,
  };
}

/**
 * Budget session details: calculates playable minutes from Egyptian Pounds budget
 */
export function calculateBudgetSessionDetails(
  budgetEgp: number,
  deviceType: DeviceType,
  controllers: ControllersCount,
  tiers: PriceTier[] = DEFAULT_PRICE_TIERS
): {
  allowedMinutes: number;
  minuteRate: number;
  min15Cost: number;
  isBelowMinimum: boolean;
  approxHoursText: string;
} {
  const { minuteRate, min15Rate } = getDeviceTierRates(deviceType, controllers, tiers);

  if (budgetEgp <= 0) {
    return {
      allowedMinutes: 0,
      minuteRate,
      min15Cost: min15Rate,
      isBelowMinimum: true,
      approxHoursText: '0 دقيقة',
    };
  }

  const isBelowMinimum = budgetEgp < min15Rate;
  const exactMinutes = Math.floor(budgetEgp / minuteRate);
  const allowedMinutes = Math.max(isBelowMinimum ? 0 : 15, exactMinutes);
  const hours = Math.floor(allowedMinutes / 60);
  const mins = allowedMinutes % 60;

  const text =
    hours > 0
      ? mins > 0
        ? `${hours} ساعة و ${mins} دقيقة (${allowedMinutes} دقيقة)`
        : `${hours} ساعة (${allowedMinutes} دقيقة)`
      : `${allowedMinutes} دقيقة`;

  return {
    allowedMinutes,
    minuteRate,
    min15Cost: min15Rate,
    isBelowMinimum,
    approxHoursText: text,
  };
}

/**
 * Payment balance calculation (change vs debt)
 */
export function calculatePaymentBalance(
  totalDue: number,
  amountPaid: number
): { change: number; remainingDebt: number; isSettled: boolean } {
  const diff = amountPaid - totalDue;
  if (diff >= 0) {
    return {
      change: Math.round(diff * 100) / 100,
      remainingDebt: 0,
      isSettled: true,
    };
  }
  return {
    change: 0,
    remainingDebt: Math.round(Math.abs(diff) * 100) / 100,
    isSettled: false,
  };
}

/**
 * Invoice totals with discounts and optional tax
 */
export function calculateInvoiceTotals(
  gamingCost: number,
  itemsTotal: number,
  discountType: 'none' | 'fixed' | 'percent' = 'none',
  discountValue: number = 0,
  taxPercent: number = 0
): { subtotal: number; discountAmount: number; taxableTotal: number; taxAmount: number; grandTotal: number } {
  const subtotal = gamingCost + itemsTotal;
  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = (subtotal * Math.min(100, Math.max(0, discountValue))) / 100;
  } else if (discountType === 'fixed') {
    discountAmount = Math.min(subtotal, Math.max(0, discountValue));
  }
  discountAmount = Math.round(discountAmount * 100) / 100;
  const taxableTotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(((taxableTotal * taxPercent) / 100) * 100) / 100;
  const grandTotal = Math.round((taxableTotal + taxAmount) * 100) / 100;
  return { subtotal, discountAmount, taxableTotal, taxAmount, grandTotal };
}
