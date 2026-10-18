/**
 * Liverpool Gaming - Shift, Safe & Handover Calculation Engine
 * Pure logic module for shift balance reconciliation, discrepancy reporting, and financial tracking.
 */

import { HandoverChecklist } from '../types';
export type { HandoverChecklist };

export interface ShiftFinancialsInput {
  openingCash: number;        // نقدية افتتاحية
  cashReceipts: number;       // مقبوضات كاش فعلية
  cashExpenses: number;       // مصروفات كاش
  cashWithdrawals: number;    // مسحوبات المالك
  cashAdvances: number;       // سلف ومكافآت العاملين
  otherCashOut?: number;      // أي خوارج نقدية أخرى
  actualClosingCash: number;  // المبلغ الفعلي الموجود في الدرج عند الجرد
  electronicReceipts: number; // إيرادات إلكترونية (InstaPay / فودافون كاش / بطاقات) - لا تدخل درج الكاش!
}

export interface ShiftClosingResult {
  expectedClosingCash: number; // النقدية المتوقعة في الدرج
  actualClosingCash: number;   // النقدية الفعلية
  discrepancy: number;         // الفارق (عجز بسالب أو زيادة بموجب)
  hasDiscrepancy: boolean;
  electronicReceiptsTotal: number; // إجمالي المدفوعات الإلكترونية
  totalNetRevenue: number;     // صافي الإيراد العام = (إيراد كاش + إلكتروني) - المصروفات
}

/**
 * Calculates shift expected cash balance according to physical cash drawer formula:
 * Expected = Opening + CashReceipts - Expenses - Withdrawals - Advances - OtherOut
 * Note: Electronic receipts (InstaPay / Vodafone Cash / Visa) are strictly tracked separately and NEVER added to physical drawer cash.
 */
export function calculateShiftClosing(input: ShiftFinancialsInput): ShiftClosingResult {
  const otherOut = input.otherCashOut || 0;
  const expectedClosingCash =
    input.openingCash +
    input.cashReceipts -
    input.cashExpenses -
    input.cashWithdrawals -
    input.cashAdvances -
    otherOut;

  const roundedExpected = Math.round(expectedClosingCash * 100) / 100;
  const roundedActual = Math.round(input.actualClosingCash * 100) / 100;
  const discrepancy = Math.round((roundedActual - roundedExpected) * 100) / 100;

  const totalNetRevenue = Math.round(
    (input.cashReceipts + input.electronicReceipts - input.cashExpenses) * 100
  ) / 100;

  return {
    expectedClosingCash: roundedExpected,
    actualClosingCash: roundedActual,
    discrepancy,
    hasDiscrepancy: Math.abs(discrepancy) > 0.01,
    electronicReceiptsTotal: Math.round(input.electronicReceipts * 100) / 100,
    totalNetRevenue,
  };
}

/**
 * Validates whether an employee can hand over without required counts
 */
export function validateHandoverChecklist(checklist: HandoverChecklist): { isValid: boolean; missingItems: string[] } {
  const missing: string[] = [];
  if (!checklist.cashCounted) missing.push('تم عد النقدية في الدرج');
  if (!checklist.ps4Checked) missing.push('فحص أجهزة PS4');
  if (!checklist.ps5Checked) missing.push('فحص أجهزة PS5');
  if (!checklist.controllersCounted) missing.push('عد وحدات التحكم');
  if (!checklist.cupsStockChecked) missing.push('مخزون الأكواب');
  if (!checklist.teaStockChecked) missing.push('مخزون الشاي');
  if (!checklist.coffeeStockChecked) missing.push('مخزون القهوة');
  if (!checklist.noodleStockChecked) missing.push('مخزون النودلز');

  return {
    isValid: missing.length === 0,
    missingItems: missing,
  };
}
