import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GameSession, Device } from '../types';
import {
  ControllersCount,
  calculateSessionGamingCost,
  calculateInvoiceTotals
} from '../logic/pricing';
import {
  Tv,
  Gamepad2,
  Clock,
  User,
  Plus,
  Minus,
  StopCircle,
  Tag,
  ArrowRightLeft,
  Coffee,
  X,
  CheckCircle2,
  AlertCircle,
  Users2,
  Sliders,
  DollarSign
} from 'lucide-react';
import { playClickSound } from '../utils/sound';

interface SessionDetailModalProps {
  session: GameSession;
  device: Device;
  isOpen: boolean;
  onClose: () => void;
  onCheckout: (session: GameSession) => void;
  onTransfer: (device: Device) => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  session,
  device,
  isOpen,
  onClose,
  onCheckout,
  onTransfer,
}) => {
  const {
    sessions,
    devices,
    changeSessionControllers,
    switchSessionDeviceType,
    addSessionProduct,
    markProductPaid,
    pricingTiers,
    roundingPolicy,
    inventory,
    waitlist,
    addToWaitlist
  } = useApp();

  const [nowMs, setNowMs] = useState(Date.now());
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productQty, setProductQty] = useState(1);
  const [productPaidNow, setProductPaidNow] = useState(false);

  // Discount
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percent'>('none');
  const [discountVal, setDiscountVal] = useState(0);

  // Waitlist fast-add
  const [newWaitCustomer, setNewWaitCustomer] = useState('');
  const [newWaitPhone, setNewWaitPhone] = useState('');
  const [newWaitGame, setNewWaitGame] = useState('FC 24');

  // Timer ticker
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const currentSession = sessions.find(s => s.id === session.id) || session;
  const currentDevice = devices.find(d => d.id === device.id) || device;
  const currentSegments = currentSession.segments;
  const activeSegment = currentSegments[currentSegments.length - 1];
  const activeControllers = activeSegment?.controllers || 2;
  const currentDeviceType = activeSegment?.deviceType || currentDevice.type;

  // Live costs
  const { totalCost: gamingCost, totalMinutes, segmentBreakdown } = calculateSessionGamingCost(
    currentSegments,
    nowMs,
    pricingTiers,
    roundingPolicy
  );

  const unpaidProductsTotal = currentSession.products
    .filter(p => !p.isPaid)
    .reduce((sum, p) => sum + (p.unitPrice * p.quantity), 0);

  const { discountAmount, grandTotal } = calculateInvoiceTotals(
    gamingCost,
    unpaidProductsTotal,
    discountType,
    discountVal,
    0
  );

  // Timer calculation
  let timerDisplay = '00:00:00';
  let isOverdue = false;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - session.startTime) / 1000));

  if (session.sessionType === 'timed' && session.plannedDurationMinutes) {
    const plannedSeconds = session.plannedDurationMinutes * 60;
    const remainingSeconds = plannedSeconds - elapsedSeconds;
    if (remainingSeconds <= 0) {
      isOverdue = true;
      const over = Math.abs(remainingSeconds);
      const h = Math.floor(over / 3600);
      const m = Math.floor((over % 3600) / 60);
      const s = over % 60;
      timerDisplay = `+${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      const h = Math.floor(remainingSeconds / 3600);
      const m = Math.floor((remainingSeconds % 3600) / 60);
      const s = remainingSeconds % 60;
      timerDisplay = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
  } else {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = elapsedSeconds % 60;
    timerDisplay = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    addSessionProduct(session.id, selectedProductId, Number(productQty), productPaidNow);
    setShowAddProductModal(false);
    setSelectedProductId('');
    setProductQty(1);
    playClickSound();
  };

  const handleAddWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWaitCustomer.trim()) return;
    addToWaitlist({
      customerName: newWaitCustomer.trim(),
      customerPhone: newWaitPhone.trim(),
      gameRequested: newWaitGame,
      branchId: session.branchId,
      preferredDeviceType: device.type,
    });
    setNewWaitCustomer('');
    setNewWaitPhone('');
    playClickSound();
  };

  const branchWaitlist = waitlist.filter(
    w => w.branchId === session.branchId && w.status === 'waiting'
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#12131b] border border-[#26283b] rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95">
        {/* Top Bar */}
        <div className="px-6 py-4 bg-[#181924] border-b border-[#242738] flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-950/60">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">تفاصيل الجلسة الحالية</h2>
                <span className="text-xs text-red-500 font-bold font-mono">| {device.screenNumber}</span>
              </div>
              <span className="text-xs text-gray-400">
                بدء الجلسة: {new Date(session.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-[10px] text-gray-500 block">
                بواسطة: {session.startedBy || 'غير مسجل'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              جلسة نشطة
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#202232] hover:bg-red-950/40 text-gray-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Left/Center Main Area (8 cols) & Right Waitlist (4 cols) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Main Area */}
          <div className="lg:col-span-8 p-6 space-y-5 border-b lg:border-b-0 lg:border-l border-[#242738]">
            {/* Header Device & Game Details Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#171823] p-4 rounded-2xl border border-[#252839]">
              <div>
                <span className="text-[10px] text-gray-400 block font-medium">نوع الجلسة</span>
                <span className="text-xs font-black text-white block mt-0.5">
                  {currentSession.sessionType === 'timed'
                    ? `جلسة بوقت (${currentSession.plannedDurationMinutes} د)`
                    : currentSession.sessionType === 'budget'
                    ? `ميزانية (${currentSession.budgetEgp} ج.م)`
                    : 'مفتوحة'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-medium">العميل</span>
                <span className="text-xs font-black text-white block mt-0.5 truncate">
                  {currentSession.customerName}
                </span>
                {currentSession.customerPhone && (
                  <span className="text-[10px] text-gray-500 font-mono block">
                    {currentSession.customerPhone}
                  </span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-medium">اللعبة</span>
                <span className="text-xs font-black text-red-400 block mt-0.5 truncate">
                  {currentSession.gameName}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-medium">الجهاز والشاشة</span>
                <span className="text-xs font-black text-white block mt-0.5">
                  {currentDeviceType} - {currentDevice.screenNumber}
                </span>
              </div>
            </div>

            {/* Glowing Big Digital Timer */}
            <div className="bg-[#161722] border border-[#26283b] rounded-3xl p-6 text-center relative overflow-hidden">
              <span className="text-xs text-gray-400 block font-bold mb-2">
                {currentSession.sessionType === 'timed'
                  ? isOverdue
                    ? 'الوقت الزائد بعد الانتهاء'
                    : 'الوقت المتبقي للجلسة'
                  : 'الوقت المستغرق حتى الآن'}
              </span>
              <div
                className={`text-5xl sm:text-6xl md:text-7xl font-mono font-black tracking-wider ${
                  isOverdue ? 'text-amber-500 animate-pulse' : 'text-red-500'
                }`}
                style={{ textShadow: isOverdue ? '0 0 30px rgba(245, 158, 11, 0.4)' : '0 0 30px rgba(239, 68, 68, 0.4)' }}
              >
                {timerDisplay}
              </div>
              <div className="text-xs text-gray-500 font-mono mt-2">
                ساعة : دقيقة : ثانية
              </div>

              {currentSession.sessionType === 'budget' && currentSession.budgetEgp && (
                <div className="mt-4 inline-flex items-center gap-3 bg-[#202232] px-4 py-1.5 rounded-2xl text-xs text-gray-300">
                  <span>الميزانية: <b className="text-white font-mono">{currentSession.budgetEgp} EGP</b></span>
                  <span>|</span>
                  <span>المستهلك: <b className="text-red-400 font-mono">{gamingCost} EGP</b></span>
                  <span>|</span>
                  <span>المتبقي: <b className="text-emerald-400 font-mono">{Math.max(0, currentSession.budgetEgp - gamingCost)} EGP</b></span>
                </div>
              )}
            </div>

            {/* Controllers Counter Widget with 1-click tier buttons */}
            <div className="bg-[#171824] border border-[#26283b] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">عدد وحدات التحكم (الأذرع)</div>
                  <div className="text-xs text-gray-400">السعر يُحسب حسب مدة كل فترة</div>
                </div>
              </div>

              {/* 1-click Controller Buttons (2, 3, 4) */}
              <div className="flex items-center gap-2">
                {[2, 3, 4].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      changeSessionControllers(currentSession.id, c as ControllersCount);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeControllers === c
                        ? 'bg-red-600 text-white shadow-lg shadow-red-950/60 border border-red-500'
                        : 'bg-[#202232] text-gray-300 hover:bg-[#2a2d42] border border-[#2d3045]'
                    }`}
                  >
                    <span>{c} أذرع</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Controllers Segment Breakdown Notice */}
            {segmentBreakdown.length > 1 && (
              <div className="p-3 bg-[#191a27] border border-[#292c40] rounded-xl text-xs space-y-1">
                <div className="font-bold text-gray-300">سجل تغييرات الجلسة وحساب الوقت:</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {segmentBreakdown.map((seg, idx) => (
                    <span key={seg.segmentId} className="px-2.5 py-1 bg-[#222436] rounded-lg text-gray-300 font-mono text-[11px]">
                      فترة {idx + 1}: {seg.deviceType} ({seg.controllers} أذرع) • {seg.minutes} د = {seg.cost} ج.م
                      {currentSession.segments[idx]?.changedBy ? ` • ${currentSession.segments[idx].changedBy}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bar Products attached to this session */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-amber-500" />
                  <span>طلبات الكافتيريا المضافة ({currentSession.products.length})</span>
                </h4>
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="px-3 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs font-bold transition border border-red-500/30 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة طلب</span>
                </button>
              </div>

              {currentSession.products.length === 0 ? (
                <div className="p-3 bg-[#161722] rounded-xl border border-[#222434] text-center text-xs text-gray-500">
                  لا توجد طلبات كافتيريا مسجلة على هذه الجلسة حتى الآن
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {currentSession.products.map(p => (
                    <div
                      key={p.id}
                      className="p-2.5 bg-[#171824] border border-[#242638] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="font-bold text-white">{p.name}</span>
                          <span className="text-gray-400 font-mono"> × {p.quantity}</span>
                          <span className="text-[10px] text-gray-500 block">
                            {p.addedBy || 'كاشير'} • {new Date(p.addedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold font-mono text-gray-200">
                          {p.unitPrice * p.quantity} EGP
                        </span>
                        {p.isPaid ? (
                          <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[10px] rounded font-bold">
                            مسدد
                          </span>
                        ) : (
                          <button
                            onClick={() => markProductPaid(currentSession.id, p.id)}
                            className="px-2 py-0.5 bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[10px] rounded font-bold hover:bg-amber-800 cursor-pointer"
                          >
                            سداد الآن
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  const targetType = currentDeviceType === 'PS4' ? 'PS5' : 'PS4';
                  switchSessionDeviceType(currentSession.id, targetType);
                }}
                className="py-2.5 px-2 bg-gradient-to-r from-purple-900/60 to-purple-800/40 hover:from-purple-800 text-purple-200 rounded-xl text-xs font-bold transition border border-purple-500/40 flex items-center justify-center gap-1 cursor-pointer"
                title="تغيير فئة الجهاز وحساب الفارق"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{currentDeviceType === 'PS4' ? 'ترقية لـ PS5' : 'تخفيض لـ PS4'}</span>
              </button>

              <button
                onClick={() => onTransfer(currentDevice)}
                className="py-2.5 px-2 bg-[#1d1f2e] hover:bg-[#282a3e] text-gray-200 rounded-xl text-xs font-bold transition border border-[#2e3146] flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-gray-400" />
                <span>نقل / تبديل</span>
              </button>

              <button
                onClick={() => setShowDiscountInput(!showDiscountInput)}
                className="py-2.5 px-2 bg-[#1d1f2e] hover:bg-[#282a3e] text-gray-200 rounded-xl text-xs font-bold transition border border-[#2e3146] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                <span>خصم</span>
              </button>

              <button
                onClick={() => setShowAddProductModal(true)}
                className="py-2.5 px-2 bg-[#1d1f2e] hover:bg-[#282a3e] text-gray-200 rounded-xl text-xs font-bold transition border border-[#2e3146] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Coffee className="w-3.5 h-3.5 text-amber-500" />
                <span>بوفيه</span>
              </button>

              <button
                onClick={() => onCheckout(currentSession)}
                className="py-2.5 px-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-lg shadow-red-950/60 cursor-pointer"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>إنهاء ومحاسبة</span>
              </button>
            </div>

            {/* Discount Input */}
            {showDiscountInput && (
              <div className="p-3 bg-[#1c1e2d] border border-[#2c3046] rounded-xl flex items-center gap-3">
                <span className="text-xs text-gray-300 font-bold">نوع الخصم:</span>
                <select
                  value={discountType}
                  onChange={e => setDiscountType(e.target.value as any)}
                  className="bg-[#141520] border border-[#2f3248] text-xs text-white rounded-lg p-1.5 font-bold"
                >
                  <option value="none">بدون خصم</option>
                  <option value="fixed">مبلغ ثابت (EGP)</option>
                  <option value="percent">نسبة مئوية (%)</option>
                </select>
                {discountType !== 'none' && (
                  <input
                    type="number"
                    min="0"
                    value={discountVal}
                    onChange={e => setDiscountVal(Number(e.target.value))}
                    className="w-20 bg-[#141520] border border-[#2f3248] text-xs text-white rounded-lg p-1.5 text-center font-mono font-bold"
                  />
                )}
              </div>
            )}

            {/* Live Financial Breakdown Bar */}
            <div className="bg-[#171824] border border-[#26283b] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-gray-400 block">وقت اللعب</span>
                <span className="text-sm font-bold text-white font-mono">{gamingCost} EGP</span>
                <span className="text-[10px] text-gray-500 block font-mono">({totalMinutes} دقيقة)</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">إجمالي البوفيه</span>
                <span className="text-sm font-bold text-white font-mono">{unpaidProductsTotal} EGP</span>
                {unpaidProductsTotal > 0 && (
                  <span className="text-[10px] text-amber-400 block font-mono">({unpaidProductsTotal} EGP متبقي)</span>
                )}
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">الخصم</span>
                <span className="text-sm font-bold text-gray-400 font-mono">{discountAmount} EGP</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">المدفوع مقدماً</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">{currentSession.paidAmount || 0} EGP</span>
              </div>
              <div className="border-r border-[#2d3045] pr-4">
                <span className="text-[11px] text-gray-400 block font-bold">الإجمالي المستحق</span>
                <span className="text-2xl font-black text-red-500 font-mono">
                  {grandTotal} EGP
                </span>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Waitlist */}
          <div className="lg:col-span-4 p-5 bg-[#14151f] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#222434] mb-3">
                <div className="flex items-center gap-2">
                  <Users2 className="w-4 h-4 text-red-500" />
                  <h3 className="font-bold text-sm text-white">قائمة الانتظار</h3>
                </div>
                <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center">
                  {branchWaitlist.length}
                </span>
              </div>

              {branchWaitlist.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  لا يوجد عملاء في الانتظار حالياً
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {branchWaitlist.map((waitItem, idx) => (
                    <div
                      key={waitItem.id}
                      className="p-3 bg-[#191a27] border border-[#25283a] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="text-red-500 font-mono font-black">{idx + 1}.</span>
                          <span>{waitItem.customerName}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">{waitItem.customerPhone}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">طلب: {waitItem.gameRequested}</div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-[#222436] flex items-center justify-center font-bold text-gray-300 font-mono text-sm">
                        {idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Add to Waitlist Form */}
            <form onSubmit={handleAddWaitlist} className="pt-4 border-t border-[#222434] space-y-2 mt-4">
              <span className="text-[11px] font-bold text-gray-400 block">إضافة عميل لقائمة الانتظار:</span>
              <input
                type="text"
                placeholder="اسم العميل"
                value={newWaitCustomer}
                onChange={e => setNewWaitCustomer(e.target.value)}
                className="w-full bg-[#191a27] border border-[#282a3d] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="رقم الهاتف"
                  value={newWaitPhone}
                  onChange={e => setNewWaitPhone(e.target.value)}
                  className="bg-[#191a27] border border-[#282a3d] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                />
                <input
                  type="text"
                  placeholder="اللعبة المطلوبة"
                  value={newWaitGame}
                  onChange={e => setNewWaitGame(e.target.value)}
                  className="bg-[#191a27] border border-[#282a3d] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-[#202232] hover:bg-red-600 hover:text-white text-gray-300 font-bold text-xs rounded-lg transition cursor-pointer"
              >
                + إضافة لقائمة الانتظار
              </button>
            </form>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#151620] border-t border-[#202230] flex items-center justify-between text-xs text-gray-400 shrink-0 font-mono">
          <span>رقم الجلسة: {session.sessionNumber}</span>
          <span>Liverpool Gaming Center OS</span>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#161723] border border-[#2e3146] rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h4 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
              <Coffee className="w-4 h-4 text-amber-500" />
              <span>إضافة طلب كافتيريا</span>
            </h4>
            <form onSubmit={handleAddProductSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">اختر الصنف</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full bg-[#1b1c2a] border border-[#2a2d42] text-xs text-white rounded-xl p-2.5 font-bold"
                >
                  <option value="">-- اختر الصنف --</option>
                  {inventory
                    .filter(i => i.branchId === session.branchId && i.stockQuantity > 0)
                    .map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} • {item.sellingPrice} EGP (المخزون: {item.stockQuantity})
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">الكمية</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={productQty}
                    onChange={e => setProductQty(Number(e.target.value))}
                    className="w-full bg-[#1b1c2a] border border-[#2a2d42] text-xs text-white rounded-xl p-2 font-bold font-mono text-center"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productPaidNow}
                      onChange={e => setProductPaidNow(e.target.checked)}
                      className="rounded accent-red-600"
                    />
                    <span>تم الدفع كاش الآن</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!selectedProductId}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  تأكيد الإضافة
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-3 py-2 bg-[#202232] text-gray-400 hover:text-white text-xs rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
