/**
 * Liverpool Gaming - PDF Export Service
 * Exports clean, executive-ready PDF reports for Shifts, Devices, Payroll, and Financials.
 */

import { jsPDF } from 'jspdf';
import { Shift, GameSession, SafeTransaction, Branch, Employee } from '../types';

export function exportShiftReportPDF(
  shift: Shift,
  sessions: GameSession[],
  transactions: SafeTransaction[],
  branch: Branch | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const branchName = branch?.nameAr || 'Liverpool Gaming';
  const branchCode = branch?.code || 'LIV';
  const nowStr = new Date().toLocaleString('en-GB');

  // Primary Theme Header
  doc.setFillColor(220, 38, 38); // Crimson Red
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('LIVERPOOL GAMING - SHIFT HANDOVER REPORT', 14, 15);

  doc.setFontSize(10);
  doc.text(`Branch: ${branchCode} - ${branch?.name || 'Liverpool'}`, 14, 21);
  doc.text(`Generated: ${nowStr}`, 150, 21);

  // Shift Meta Card
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 30, 182, 34, 3, 3, 'F');

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.text(`Shift Number: ${shift.shiftNumber}`, 18, 38);
  doc.text(`Cashier: ${shift.cashierName}`, 18, 46);
  doc.text(`Receiving Staff: ${shift.receivingCashierName || 'Owner Review'}`, 18, 54);

  const startTimeStr = new Date(shift.startTime).toLocaleTimeString('en-GB');
  const endTimeStr = shift.endTime ? new Date(shift.endTime).toLocaleTimeString('en-GB') : 'Active';
  doc.text(`Start Time: ${startTimeStr}`, 110, 38);
  doc.text(`End Time: ${endTimeStr}`, 110, 46);
  doc.text(`Status: ${shift.status.toUpperCase()}`, 110, 54);

  // Financial Table
  doc.setFontSize(13);
  doc.setTextColor(220, 38, 38);
  doc.text('Cash Drawer & Financial Summary', 14, 73);

  const opening = shift.openingCash || 0;
  const cashRec = shift.closingFinancials?.cashReceipts || 0;
  const elecRec = shift.closingFinancials?.electronicReceipts || 0;
  const exp = shift.closingFinancials?.cashExpenses || 0;
  const adv = shift.closingFinancials?.cashAdvances || 0;
  const expected = shift.expectedClosingCash || 0;
  const actual = shift.actualClosingCash || 0;
  const disc = shift.discrepancy || 0;

  const rows = [
    ['Opening Cash Balance', `${opening.toFixed(2)} EGP`],
    ['Cash Gaming & Bar Receipts', `+ ${cashRec.toFixed(2)} EGP`],
    ['Electronic Receipts (InstaPay/Vodafone)', `${elecRec.toFixed(2)} EGP (Tracked Separately)`],
    ['Cash Expenses & Supplies', `- ${exp.toFixed(2)} EGP`],
    ['Staff Advances & Bonuses', `- ${adv.toFixed(2)} EGP`],
    ['----------------------------------------', '------------------------------'],
    ['Expected Cash in Drawer', `${expected.toFixed(2)} EGP`],
    ['Actual Cash Counted', `${actual.toFixed(2)} EGP`],
    ['Discrepancy (Deficit/Surplus)', `${disc >= 0 ? '+' : ''}${disc.toFixed(2)} EGP (${disc === 0 ? 'BALANCED' : disc < 0 ? 'SHORTAGE' : 'OVER'})`],
  ];

  let currentY = 82;
  doc.setFontSize(10);
  rows.forEach(([label, val]) => {
    if (label.startsWith('Expected') || label.startsWith('Actual') || label.startsWith('Discrepancy')) {
      doc.setFont('helvetica', 'bold');
      if (label.startsWith('Discrepancy')) {
        doc.setTextColor(disc === 0 ? 16 : disc < 0 ? 220 : 37, disc === 0 ? 185 : disc < 0 ? 38 : 99, disc === 0 ? 129 : disc < 0 ? 38 : 235);
      } else {
        doc.setTextColor(15, 23, 42);
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
    }
    doc.text(label, 20, currentY);
    doc.text(val, 130, currentY);
    currentY += 7;
  });

  // Recent shift transactions
  currentY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(220, 38, 38);
  doc.text('Key Shift Transactions & Gaming Sessions', 14, currentY);
  currentY += 8;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('#', 16, currentY);
  doc.text('Type', 28, currentY);
  doc.text('Description', 60, currentY);
  doc.text('Method', 140, currentY);
  doc.text('Amount (EGP)', 170, currentY);
  currentY += 4;
  doc.line(14, currentY, 196, currentY);
  currentY += 5;

  const sampleTxs = transactions.slice(0, 10);
  sampleTxs.forEach((tx, idx) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${idx + 1}`, 16, currentY);
    doc.text(tx.type.replace('_', ' '), 28, currentY);
    doc.text(tx.description.slice(0, 40), 60, currentY);
    doc.text(tx.paymentMethod.toUpperCase(), 140, currentY);
    doc.text(`${tx.amount.toFixed(2)}`, 175, currentY);
    currentY += 6;
  });

  if (transactions.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.text('No separate cash transactions recorded for this shift.', 20, currentY);
    currentY += 6;
  }

  // Footer / Sign-off
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.line(14, 270, 196, 270);
  doc.text('Cashier Signature: ______________________', 20, 278);
  doc.text('Owner / Supervisor Signature: ______________________', 110, 278);
  doc.text('Liverpool Gaming Operating System - Document ID: LG-' + shift.id, 14, 287);

  doc.save(`Shift-${shift.shiftNumber}-${branchCode}.pdf`);
}

export function exportPayrollReportPDF(employees: Employee[], branchName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('LIVERPOOL GAMING - STAFF PAYROLL & DEDUCTIONS', 14, 15);
  doc.setFontSize(10);
  doc.text(`Branch: ${branchName} | Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 21);

  let y = 35;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Employee', 16, y);
  doc.text('Role', 60, y);
  doc.text('Base Salary', 95, y);
  doc.text('Overtime', 125, y);
  doc.text('Deductions', 155, y);
  doc.text('Net Due', 180, y);
  y += 3;
  doc.line(14, y, 196, y);
  y += 7;

  employees.forEach((emp) => {
    const totalOT = emp.overtimeRequests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (r.hours * r.hourlyRate), 0);
    const totalDeductions = (emp.deductions || []).reduce((sum, d) => sum + d.amount, 0);
    const net = Math.max(0, emp.salaryMonthly + totalOT - totalDeductions);

    doc.setFont('helvetica', 'normal');
    doc.text(emp.name, 16, y);
    doc.text(emp.role, 60, y);
    doc.text(`${emp.salaryMonthly} EGP`, 95, y);
    doc.text(`+${totalOT} EGP`, 125, y);
    doc.text(`-${totalDeductions} EGP`, 155, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${net} EGP`, 180, y);
    y += 8;
  });

  doc.save(`Payroll-Report-${branchName.replace(/\s+/g, '-')}.pdf`);
}
