import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { HandoverChecklist } from '../types';
import {
  ClipboardList,
  FolderLock,
  Gamepad2,
  DollarSign,
  Banknote,
  Wallet,
  Calculator,
  AlertTriangle,
  Printer,
  CheckCircle2,
  Lock,
  UserCheck,
  Check,
  Calendar,
  Clock,
  Sparkles,
  PlusCircle,
  Download,
  ArrowRightLeft
} from 'lucide-react';
import { ExpenseModal } from './ExpenseModal';
import { playCashSound, playClickSound } from '../utils/sound';
import { exportShiftReportPDF } from '../utils/pdfExport';

export const ShiftHandoverView: React.FC = () => {
  const {
    activeShift,
    shifts,
    sessions,
    safeTransactions,
    employees,
    activeBranch,
    startShiftHandover,
    closeShift,
    verifyOwnerPin,
    currentUser,
    ownerProfile
  } = useApp();

  // Handover Checklist State (Section 1)
  const [cashCounted, setCashCounted] = useState(false);
  const [ps4Checked, setPs4Checked] = useState(false);
  const [ps5Checked, setPs5Checked] = useState(false);
  const [controllersCounted, setControllersCounted] = useState(false);
  const [controllersCount, setControllersCount] = useState<number>(8);
  const [noodleStockChecked, setNoodleStockChecked] = useState(false);
  const [teaStockChecked, setTeaStockChecked] = useState(false);
  const [coffeeStockChecked, setCoffeeStockChecked] = useState(false);
  const [cupsStockChecked, setCupsStockChecked] = useState(false);
  const [notes, setNotes] = useState('');

  // Start shift state
  const [openingCashInput, setOpeningCashInput] = useState<number>(300);

  // Closing Shift State (Section 2)
  const [deliveringEmployee, setDeliveringEmployee] = useState(currentUser?.name || '');
  const [receivingEmployee, setReceivingEmployee] = useState('');
  const [actualCashEntered, setActualCashEntered] = useState<string>('');
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Financial calculations for active shift
  const currentShiftId = activeShift?.id;
  const shiftSessions = sessions.filter(
    s => s.branchId === activeBranch?.id && (activeShift ? s.startTime >= activeShift.startTime : false)
  );

  const openSessionsCount = sessions.filter(
    s => s.branchId === activeBranch?.id && s.status === 'active'
  ).length;

  const shiftTxs = safeTransactions.filter(
    t => t.branchId === activeBranch?.id && (currentShiftId ? t.shiftId === currentShiftId : false)
  );

  const totalSessionsCount = shiftSessions.length;

  const totalRevenue = shiftTxs
    .filter(t => t.type === 'gaming_revenue' || t.type === 'bar_revenue')
    .reduce((sum, t) => sum + t.amount, 0);

  const cashCollected = shiftTxs
    .filter(t => (t.type === 'gaming_revenue' || t.type === 'bar_revenue') && t.paymentMethod === 'cash')
    .reduce((sum, t) => sum + t.amount, 0);

  const electronicCollected = shiftTxs
    .filter(t => (t.type === 'gaming_revenue' || t.type === 'bar_revenue') && t.paymentMethod !== 'cash')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = shiftTxs
    .filter(t => t.type === 'expense' || t.type === 'advance')
    .reduce((sum, t) => sum + t.amount, 0);

  const netAmount = Math.max(0, cashCollected - expenses);
  const openingCash = activeShift?.openingCash || 0;
  const expectedDrawerCash = Math.max(0, openingCash + cashCollected - expenses);
  const actualCashNumeric = actualCashEntered !== '' ? parseFloat(actualCashEntered) : expectedDrawerCash;
  const discrepancy = actualCashNumeric - expectedDrawerCash;

  const handleStartShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashCounted || !ps4Checked || !ps5Checked || !controllersCounted) {
      setStatusMessage({
        text: 'يرجى مراجعة وتحديد كافة بنود قائمة الاستلام الإلزامية أولاً',
        type: 'error',
      });
      return;
    }

    const checklist: HandoverChecklist = {
      cashCounted,
      ps4Checked,
      ps5Checked,
      controllersCounted,
      controllersCount,
      cupsStockChecked,
      teaStockChecked,
      coffeeStockChecked,
      noodleStockChecked,
      notes,
    };

    startShiftHandover(openingCashInput, checklist, notes);
    playCashSound();
    setStatusMessage({
      text: `تم استلام الوردية بنجاح! وتم ترحيل ${openSessionsCount} جلسة جارية للشفت الجديد.`,
      type: 'success',
    });
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) {
      setStatusMessage({ text: 'لا يوجد وردية نشطة حالياً لإغلاقها', type: 'error' });
      return;
    }
    if (!ownerPinInput.trim()) {
      setStatusMessage({ text: 'رمز PIN الخاص بالمالك مطلوب لاعتماد الإغلاق', type: 'error' });
      return;
    }

    const res = closeShift(actualCashNumeric, ownerPinInput.trim(), notes);
    if (res.success) {
      playCashSound();
      setStatusMessage({
        text: `${res.message} (الفارق المالي: ${res.discrepancy?.toFixed(2)} EGP). تم ترحيل الجلسات المفتوحة للشفت القادم.`,
        type: 'success',
      });
      setOwnerPinInput('');
      setActualCashEntered('');
    } else {
      setStatusMessage({ text: res.message, type: 'error' });
    }
  };

  const handleExportPDF = () => {
    if (!activeShift) return;
    exportShiftReportPDF(activeShift, shiftSessions, shiftTxs, activeBranch);
  };

  const addCashDenomination = (amt: number) => {
    playClickSound();
    const curr = actualCashEntered !== '' ? parseFloat(actualCashEntered) : 0;
    setActualCashEntered(String(curr + amt));
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Top Banner (Exact layout of screenshot 75c76e68394ddc9e221dcfeee53d0e36) */}
      <div className="bg-[#12131a] border border-[#232535] rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        {/* PS Gaming Center Brand */}
        <div className="flex items-center gap-3">
          <div className="text-red-500 font-mono tracking-widest text-lg font-black flex items-center gap-1.5">
            <span>▲</span>
            <span>●</span>
            <span>✖</span>
            <span>■</span>
          </div>
          <div>
            <span className="text-xs font-mono tracking-widest text-gray-400 block font-bold">
              PLAYSTATION GAMING CENTER
            </span>
            <span className="text-sm font-black text-white">
              LIVERPOOL GAMING • فرع {activeBranch?.nameAr}
            </span>
          </div>
        </div>

        {/* Center: Handshake Icon & Arabic Title */}
        <div className="flex items-center gap-3 bg-[#171824] px-5 py-2.5 rounded-2xl border border-[#26283b] shadow">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center">
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M21.71 8.71l-1.42-1.42a1 1 0 0 0-1.41 0L16.17 10H14V8a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2H3a1 1 0 0 0-1 1v7a3 3 0 0 0 3 3h4.18a3 3 0 0 0 2.12-.88l4.24-4.24a1 1 0 0 0 0-1.42L15 13h1.17l3.54-3.54a1 1 0 0 0 0-1.41zM5 19a1 1 0 0 1-1-1v-6h2v6a1 1 0 0 1-1 1zm8-1.59l-4 4A1 1 0 0 1 8.29 22H7v-2h1.59l3.7-3.71z" />
            </svg>
          </div>
          <span className="text-base font-black text-white tracking-wide">
            تسليم واستلام الوردية
          </span>
        </div>

        {/* Left: Quick Actions */}
        <div className="flex items-center gap-2">
          {activeShift && (
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 bg-[#1f2132] hover:bg-[#282a3f] text-gray-200 border border-[#2e3146] font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow"
              title="تصدير تقرير الوردية PDF"
            >
              <Download className="w-3.5 h-3.5 text-red-400" />
              <span>تصدير PDF</span>
            </button>
          )}

          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ سلفة / مصروف</span>
          </button>
        </div>
      </div>

      {/* Open Sessions Carryover Notice (User requirement!) */}
      {openSessionsCount > 0 && (
        <div className="p-4 bg-[#141523] border border-blue-500/40 rounded-2xl flex items-center justify-between gap-3 text-blue-200 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <ArrowRightLeft className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              يوجد حالياً <b>{openSessionsCount} جلسة نشطة مستمرة</b> في الفرع. يتم ترحيلها تلقائياً للشفت الجديد لاستكمالها دون انقطاع، وتُحصّل الإيرادات للشفت الذي يقوم بالإغلاق والمحاسبة!
            </span>
          </div>
          <span className="bg-blue-600/30 text-blue-300 font-mono font-bold px-2 py-0.5 rounded text-[11px]">
            ترحيل تلقائي آمن
          </span>
        </div>
      )}

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-red-950/60 border-red-500/50 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs underline text-gray-400 hover:text-white cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* 1. قائمة تسليم واستلام الشفت (Section 1 in screenshot) */}
      <div className="bg-[#12131a] border border-[#232535] rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#1f2130]">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-black text-white">
              1. قائمة تسليم واستلام الشفت
            </h3>
          </div>
          {activeShift ? (
            <span className="px-3 py-1 bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-full">
              الوردية الحالية مفتوحة: {activeShift.shiftNumber} ({activeShift.cashierName})
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full">
              الوردية مغلقة - يرجى استلام الوردية
            </span>
          )}
        </div>

        {/* 3 Columns of Checkboxes matching reference screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          {/* Column 1 */}
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={cashCounted}
                onChange={e => setCashCounted(e.target.checked)}
                className="w-5 h-5 rounded-lg border-2 border-gray-600 bg-[#1c1d29] checked:bg-red-600 accent-red-600 cursor-pointer"
              />
              <span className="text-gray-200 font-bold group-hover:text-white transition">تم عد النقدية في الدرج</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={ps4Checked}
                onChange={e => setPs4Checked(e.target.checked)}
                className="w-5 h-5 rounded-lg border-2 border-gray-600 bg-[#1c1d29] checked:bg-red-600 accent-red-600 cursor-pointer"
              />
              <span className="text-gray-200 font-bold group-hover:text-white transition">تم فحص أجهزة PS4</span>
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-3 cursor-pointer group shrink-0">
                <input
                  type="checkbox"
                  checked={controllersCounted}
                  onChange={e => setControllersCounted(e.target.checked)}
                  className="w-5 h-5 rounded-lg border-2 border-gray-600 bg-[#1c1d29] checked:bg-red-600 accent-red-600 cursor-pointer"
                />
                <span className="text-gray-200 font-bold group-hover:text-white transition">تم عد وحدات التحكم</span>
              </label>
              <div className="flex items-center gap-1.5 bg-[#1a1b28] border border-[#2b2d42] px-2 py-1 rounded-xl">
                <span className="text-[10px] text-gray-400">العدد:</span>
                <input
                  type="number"
                  min="0"
                  value={controllersCount}
                  onChange={e => setControllersCount(Number(e.target.value))}
                  className="w-16 bg-transparent text-center font-mono font-bold text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={ps5Checked}
                onChange={e => setPs5Checked(e.target.checked)}
                className="w-5 h-5 rounded-lg border-2 border-gray-600 bg-[#1c1d29] checked:bg-red-600 accent-red-600 cursor-pointer"
              />
              <span className="text-gray-200 font-bold group-hover:text-white transition">تم فحص أجهزة PS5</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={noodleStockChecked}
                onChange={e => setNoodleStockChecked(e.target.checked)}
                className="w-5 h-5 rounded-lg border-2 border-gray-600 bg-[#1c1d29] checked:bg-red-600 accent-red-600 cursor-pointer"
              />
              <span className="text-gray-200 font-bold group-hover:text-white transition">مخزون النودلز والإندومي</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={teaStockChecked}
                onChange={e => setTeaStockChecked(e.target.checked)}
                className="w-5 h-5 rounded-lg border-2 border-gray-600 bg-[#1c1d29] checked:bg-red-600 accent-red-600 cursor-pointer"
              />
              <span className="text-gray-200 font-bold group-hover:text-white transition">مخزون الشاي والمشروبات</span>
            </label>
          </div>

          {/* Column 3 */}
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={cupsStockChecked}
                onChange={e => setCupsStockChecked(e.target.checked)}
                className="w-5 h-5 rounded-lg border-2 border-gray-600 bg-[#1c1d29] checked:bg-red-600 accent-red-600 cursor-pointer"
              />
              <span className="text-gray-200 font-bold group-hover:text-white transition">مخزون الأكواب الكرتون</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={coffeeStockChecked}
                onChange={e => setCoffeeStockChecked(e.target.checked)}
                className="w-5 h-5 rounded-lg border-2 border-gray-600 bg-[#1c1d29] checked:bg-red-600 accent-red-600 cursor-pointer"
              />
              <span className="text-gray-200 font-bold group-hover:text-white transition">مخزون القهوة والنسكافيه</span>
            </label>
          </div>
        </div>

        {/* Notes Textarea */}
        <div>
          <label className="block text-xs font-bold text-gray-400 mb-1.5">ملاحظات الاستلام والتسليم</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="اكتب أي ملاحظات أو معلومات إضافية هنا (مثل شاشة تحتاج صيانة أو عهدة خاصة)..."
            className="w-full bg-[#181926] border border-[#2b2d42] rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-red-500 placeholder-gray-600"
          ></textarea>
        </div>

        {/* Start Shift Option if not open */}
        {!activeShift && (
          <div className="p-4 bg-[#181926] border border-[#282a3e] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-300">النقدية الافتتاحية في الدرج:</span>
              <input
                type="number"
                min="0"
                value={openingCashInput}
                onChange={e => setOpeningCashInput(Number(e.target.value))}
                className="w-28 bg-[#1f2130] border border-[#32354a] rounded-xl px-3 py-1.5 text-center font-mono font-bold text-white text-sm"
              />
              <span className="text-xs text-gray-400 font-mono">EGP</span>
            </div>
            <button
              onClick={handleStartShift}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-950/60 cursor-pointer"
            >
              استلام الوردية وبدء الشفت
            </button>
          </div>
        )}
      </div>

      {/* 2. تقرير الإغلاق اليومي (Section 2 in screenshot) */}
      <div className="bg-[#12131a] border border-[#232535] rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#1f2130]">
          <div className="flex items-center gap-2.5">
            <FolderLock className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-black text-red-500">
              2. تقرير الإغلاق اليومي
            </h3>
          </div>
          <span className="text-xs text-gray-400">
            الدرج = الافتتاح ({openingCash}) + مقبوضات ({cashCollected}) - مصروفات ({expenses}) = <b className="text-white font-mono">{expectedDrawerCash.toFixed(2)} EGP</b>
          </span>
        </div>

        {/* 6 Metric Cards matching screenshot */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. إجمالي الجلسات اليوم */}
          <div className="bg-[#171824] border border-[#242638] rounded-2xl p-4 flex flex-col justify-between text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mb-2">
              <Gamepad2 className="w-4 h-4 text-gray-400" />
              <span>إجمالي الجلسات اليوم</span>
            </div>
            <div className="text-3xl font-black font-mono text-white">
              {totalSessionsCount}
            </div>
            <span className="text-[10px] text-gray-500 mt-1">جلسة</span>
          </div>

          {/* 2. إجمالي الإيرادات */}
          <div className="bg-[#171824] border border-[#242638] rounded-2xl p-4 flex flex-col justify-between text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 mb-2">
              <Banknote className="w-4 h-4" />
              <span>إجمالي الإيرادات</span>
            </div>
            <div className="text-2xl font-black font-mono text-white">
              {totalRevenue.toFixed(2)}
            </div>
            <span className="text-[10px] text-gray-500 mt-1">
              (كاش {cashCollected.toFixed(0)} + إلكتروني {electronicCollected.toFixed(0)})
            </span>
          </div>

          {/* 3. النقدية المحصلة */}
          <div className="bg-[#171824] border border-[#242638] rounded-2xl p-4 flex flex-col justify-between text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 mb-2">
              <DollarSign className="w-4 h-4" />
              <span>النقدية المحصلة</span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              {cashCollected.toFixed(2)}
            </div>
            <span className="text-[10px] text-gray-500 mt-1">ريال / ج.م</span>
          </div>

          {/* 4. المصروفات */}
          <div className="bg-[#171824] border border-[#242638] rounded-2xl p-4 flex flex-col justify-between text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-amber-500 mb-2">
              <Wallet className="w-4 h-4" />
              <span>المصروفات والسلف</span>
            </div>
            <div className="text-2xl font-black font-mono text-amber-400">
              {expenses.toFixed(2)}
            </div>
            <span className="text-[10px] text-gray-500 mt-1">ريال / ج.م</span>
          </div>

          {/* 5. المبلغ الصافي المتوقع */}
          <div className="bg-[#171824] border border-[#242638] rounded-2xl p-4 flex flex-col justify-between text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-blue-400 mb-2">
              <Calculator className="w-4 h-4" />
              <span>المبلغ الصافي</span>
            </div>
            <div className="text-2xl font-black font-mono text-blue-400">
              {expectedDrawerCash.toFixed(2)}
            </div>
            <span className="text-[10px] text-gray-500 mt-1">متوقع بالدرج</span>
          </div>

          {/* 6. الفارق (إن وجد) */}
          <div
            className={`rounded-2xl p-4 flex flex-col justify-between text-center shadow-lg transition-all ${
              discrepancy === 0
                ? 'bg-emerald-950/30 border-2 border-emerald-500/80 shadow-emerald-950/40'
                : discrepancy < 0
                ? 'bg-red-950/40 border-2 border-red-600 shadow-red-950/50'
                : 'bg-blue-950/40 border-2 border-blue-500 shadow-blue-950/50'
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-xs font-bold mb-2">
              {discrepancy === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
              <span className={discrepancy === 0 ? 'text-emerald-300' : 'text-red-400'}>
                {discrepancy === 0 ? 'الدرج متطابق' : discrepancy < 0 ? 'الفارق (عجز)' : 'الفارق (زيادة)'}
              </span>
            </div>
            <div
              className={`text-2xl font-black font-mono ${
                discrepancy === 0
                  ? 'text-emerald-400'
                  : discrepancy < 0
                  ? 'text-red-500'
                  : 'text-blue-400'
              }`}
            >
              {discrepancy >= 0 ? `+${discrepancy.toFixed(2)}` : discrepancy.toFixed(2)}
            </div>
            <span className="text-[10px] text-gray-400 mt-1">
              {discrepancy === 0 ? '0.00 EGP (متوازن)' : `${Math.abs(discrepancy).toFixed(2)} EGP`}
            </span>
          </div>
        </div>

        {/* Cash Drawer Counting Section */}
        <div className="p-4 bg-[#181927] border border-[#2b2d42] rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-white">إدخال الجرد الفعلي للنقدية:</h4>
              <p className="text-xs text-gray-400">
                المبلغ المفترض تواجده: <b className="text-blue-400 font-mono">{expectedDrawerCash.toFixed(2)} EGP</b>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-300">النقدية الفعلية:</span>
              <input
                type="number"
                min="0"
                step="5"
                value={actualCashEntered !== '' ? actualCashEntered : expectedDrawerCash}
                onChange={e => setActualCashEntered(e.target.value)}
                placeholder={String(expectedDrawerCash)}
                className="w-32 bg-[#1b1c28] border-2 border-red-500/60 rounded-xl px-3 py-2 text-center font-mono font-black text-white text-base focus:outline-none focus:border-red-500"
              />
              <span className="text-xs text-gray-400 font-mono font-bold">EGP</span>
            </div>
          </div>

          {/* Quick Denominations */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#23253a]">
            <span className="text-[11px] text-gray-400">فئات سريعة:</span>
            {[200, 100, 50, 20, 10, 5].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => addCashDenomination(val)}
                className="px-2.5 py-1 rounded-lg bg-[#222438] hover:bg-red-950/60 text-gray-200 text-xs font-mono font-bold border border-[#2e314a] cursor-pointer"
              >
                +{val}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActualCashEntered(String(expectedDrawerCash))}
              className="px-3 py-1 rounded-lg bg-[#1f2130] text-emerald-400 text-xs font-bold mr-auto cursor-pointer"
            >
              مطابقة المتوقع
            </button>
          </div>
        </div>

        {/* Bottom Form: Closing Handover */}
        {activeShift && (
          <form onSubmit={handleCloseShift} className="pt-4 border-t border-[#212334] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">اسم الموظف المُسلِّم</label>
                <input
                  type="text"
                  readOnly
                  value={activeShift.cashierName}
                  className="w-full bg-[#181926] border border-[#26283b] rounded-xl px-3 py-2 text-xs text-gray-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">اسم الموظف المُستلِم (شفت تالي)</label>
                <select
                  value={receivingEmployee}
                  onChange={e => setReceivingEmployee(e.target.value)}
                  className="w-full bg-[#181926] border border-[#2b2d42] rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-red-500"
                >
                  <option value="">-- اختر الموظف المستلم --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                  <option value="المالك">المالك مباشرة</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  رمز تأكيد المالك (PIN) <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={ownerPinInput}
                  onChange={e => setOwnerPinInput(e.target.value)}
                  placeholder="أدخل رمز PIN للمالك للاعتماد"
                  className="w-full bg-[#181926] border-2 border-[#33364f] focus:border-red-500 rounded-xl px-3 py-2 text-xs text-white font-mono text-center"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="px-4 py-2.5 bg-[#1b1c28] hover:bg-[#25283b] text-gray-200 border border-[#2b2d42] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-gray-400" />
                  <span>طباعة تقرير الشفت</span>
                </button>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition shadow-xl shadow-red-950/80 cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد التسليم والإغلاق اليومي</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Expense Modal */}
      <ExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
      />
    </div>
  );
};
