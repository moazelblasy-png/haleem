import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Device, DeviceType } from '../types';
import {
  ControllersCount,
  calculateBudgetSessionDetails,
  calculateSegmentCost,
  getDeviceTierRates
} from '../logic/pricing';
import {
  Play,
  Clock,
  DollarSign,
  User,
  Phone,
  X,
  ShieldAlert,
  Check,
  Gamepad2,
  AlertTriangle,
  Tv
} from 'lucide-react';
import { playSessionStartSound, playClickSound } from '../utils/sound';
import { ConsoleIcon } from './ConsoleIcon';

interface StartSessionModalProps {
  device: Device;
  isOpen: boolean;
  onClose: () => void;
  onStarted: () => void;
}

export const StartSessionModal: React.FC<StartSessionModalProps> = ({
  device: initialDevice,
  isOpen,
  onClose,
  onStarted,
}) => {
  const { startSession, pricingTiers, devices, activeBranch } = useApp();

  // اختيار نوع الجهاز أولاً ثم الشاشة المتاحة من نفس النوع.
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialDevice.id);
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType>(initialDevice.type);
  const branchDevices = devices.filter(d => d.branchId === activeBranch?.id && d.status === 'available');
  const devicesOfSelectedType = branchDevices.filter(d => d.type === selectedDeviceType);
  const currentDevice = devices.find(d => d.id === selectedDeviceId && d.type === selectedDeviceType)
    || devicesOfSelectedType[0]
    || branchDevices[0]
    || initialDevice;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedGame, setSelectedGame] = useState(currentDevice.installedGames[0] || 'FC 24');
  const [customGame, setCustomGame] = useState('');
  const [sessionType, setSessionType] = useState<'open' | 'timed' | 'budget'>('open');
  const [controllers, setControllers] = useState<ControllersCount>(2);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [customDurationInput, setCustomDurationInput] = useState<string>('60');
  const [budgetEgp, setBudgetEgp] = useState<number>(85);
  const [isPrepaid, setIsPrepaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'vodafone'>('cash');

  if (!isOpen) return null;

  // Rates calculation
  const { hourRate, minuteRate, min15Rate } = getDeviceTierRates(currentDevice.type, controllers, pricingTiers);

  let estimatedCost = 0;
  let budgetInfo: ReturnType<typeof calculateBudgetSessionDetails> | null = null;
  if (sessionType === 'timed') {
    const parsed = Number(customDurationInput);
    const mins = Number.isFinite(parsed) && parsed > 0 ? Math.max(15, Math.round(parsed)) : 15;
    estimatedCost = calculateSegmentCost(currentDevice.type, controllers, mins, pricingTiers).cost;
  } else if (sessionType === 'budget') {
    budgetInfo = calculateBudgetSessionDetails(budgetEgp, currentDevice.type, controllers, pricingTiers);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCustomerName = customerName.trim() || `عميل ${currentDevice.screenNumber}`;
    const game = customGame.trim() || selectedGame;
    const parsed = Number(customDurationInput);
    const plannedMins = sessionType === 'timed'
      ? Number.isFinite(parsed) && parsed > 0 ? Math.max(15, Math.round(parsed)) : 15
      : undefined;

    try {
      startSession({
        deviceId: currentDevice.id,
        customerName: finalCustomerName,
        customerPhone: customerPhone.trim() || undefined,
        gameName: game,
        sessionType,
        controllers,
        plannedDurationMinutes: plannedMins,
        budgetEgp: sessionType === 'budget' ? budgetEgp : undefined,
        isPrepaid,
        paidAmount: isPrepaid ? (sessionType === 'budget' ? budgetEgp : estimatedCost) : 0,
        paymentMethod: isPrepaid ? paymentMethod : undefined,
      });

      playSessionStartSound();
      onStarted();
      onClose();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء بدء الجلسة');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#141520] border-2 border-[#2b2d42] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header with Console Model */}
        <div className="p-5 bg-gradient-to-r from-red-950/50 via-red-900/30 to-[#141520] border-b border-[#252839] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1c1e2c] border border-red-500/30 flex items-center justify-center shadow-lg shadow-red-950/60 p-1">
              <ConsoleIcon type={currentDevice.type} size="sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">بدء جلسة جديدة</h3>
                <span className="px-2 py-0.5 rounded-lg bg-red-600 text-white font-mono font-black text-xs">
                  {currentDevice.type}
                </span>
              </div>
              <p className="text-xs text-gray-300">
                {currentDevice.screenNumber} • الساعة بـ {hourRate} ج.م ({minuteRate} ج/دقيقة)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1e2030] hover:bg-red-950/40 text-gray-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* اختيار نوع الجهاز ثم الشاشة المتاحة */}
          <div className="p-3 bg-[#181927] border border-[#2b2d42] rounded-2xl">
            <label className="block text-xs font-bold text-gray-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tv className="w-4 h-4 text-red-400" />
                <span>اختيار الشاشة المتاحة:</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {currentDevice.type}
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {devicesOfSelectedType.map(d => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => {
                    playClickSound();
                    setSelectedDeviceId(d.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    d.id === currentDevice.id
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-[#1e2030] text-gray-300 hover:bg-[#282a40] border border-[#2e3146]'
                  }`}
                >
                  <span>{d.screenNumber}</span>
                </button>
              ))}
            </div>
            {devicesOfSelectedType.length === 0 && (
              <p className="text-[11px] text-amber-300 mt-2">لا توجد شاشة {selectedDeviceType} متاحة حالياً في هذا الفرع.</p>
            )}
          </div>

          <div className="p-3 bg-[#181927] border border-[#2b2d42] rounded-2xl">
            <label className="block text-xs font-bold text-gray-300 mb-2">نوع الجهاز</label>
            <div className="grid grid-cols-2 gap-2">
              {(['PS4', 'PS5'] as const).map(type => {
                const availableCount = branchDevices.filter(d => d.type === type).length;
                return (
                  <button
                    type="button"
                    key={type}
                    disabled={availableCount === 0}
                    onClick={() => {
                      playClickSound();
                      setSelectedDeviceType(type);
                      const firstAvailable = branchDevices.find(d => d.type === type);
                      if (firstAvailable) setSelectedDeviceId(firstAvailable.id);
                    }}
                    className={`py-2.5 rounded-xl text-sm font-black transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      selectedDeviceType === type
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-[#1e2030] text-gray-300 border border-[#2e3146]'
                    }`}
                  >
                    {type} <span className="text-[10px] font-normal">({availableCount} متاح)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                اسم العميل <span className="text-gray-400 font-normal">(اختياري)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-500 absolute right-3 top-3" />
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder={`عميل ${currentDevice.screenNumber}`}
                  className="w-full bg-[#1b1c28] border border-[#2c2f44] rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                رقم هاتف العميل <span className="text-gray-400 font-normal">(اختياري)</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-500 absolute right-3 top-3" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="010 / 011 / 012..."
                  className="w-full bg-[#1b1c28] border border-[#2c2f44] rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Controllers Count (2, 3, 4) */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5">عدد أذرع التحكم</label>
            <div className="grid grid-cols-3 gap-2.5">
              {[2, 3, 4].map(c => {
                const rates = getDeviceTierRates(currentDevice.type, c as ControllersCount, pricingTiers);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => {
                      playClickSound();
                      setControllers(c as ControllersCount);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      controllers === c
                        ? 'bg-red-600 text-white shadow-lg shadow-red-950/60 border border-red-500'
                        : 'bg-[#1b1c28] text-gray-300 border border-[#2c2f44] hover:bg-[#232538]'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>{c} أذرع</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-80">{rates.hourRate} ج/ساعة</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Session Type */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5">نوع الجلسة</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setSessionType('open');
                }}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                  sessionType === 'open'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-[#1b1c28] text-gray-300 border border-[#2c2f44] hover:bg-[#202235]'
                }`}
              >
                جلسة مفتوحة
              </button>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setSessionType('timed');
                }}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                  sessionType === 'timed'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-[#1b1c28] text-gray-300 border border-[#2c2f44] hover:bg-[#202235]'
                }`}
              >
                جلسة بوقت (مدة محددة)
              </button>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setSessionType('budget');
                }}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                  sessionType === 'budget'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-[#1b1c28] text-gray-300 border border-[#2c2f44] hover:bg-[#202235]'
                }`}
              >
                جلسة بميزانية (فلوس)
              </button>
            </div>
          </div>

          {/* Timed options: Quick pills + CUSTOM MINUTES */}
          {sessionType === 'timed' && (
            <div className="p-3.5 bg-[#181927] border border-[#282a3d] rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-gray-300">
                <span>تحديد مدة اللعب:</span>
                <span className="text-[10px] text-gray-400 font-mono">الحد الأدنى: 15 دقيقة</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[15, 30, 45, 60, 75, 90, 105, 120].map(mins => (
                  <button
                    type="button"
                    key={mins}
                    onClick={() => {
                      playClickSound();
                      setDurationMinutes(mins);
                      setCustomDurationInput(String(mins));
                    }}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      Number(customDurationInput) === mins
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-[#1f2132] text-gray-300 hover:bg-[#282a3e]'
                    }`}
                  >
                    {mins} دقيقة
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-[#23253a]">
                <span className="text-xs text-gray-400 shrink-0">مدة مخصصة بالدقائق:</span>
                <input
                  type="number"
                  min="15"
                  step="5"
                  value={customDurationInput}
                  onChange={e => {
                    setCustomDurationInput(e.target.value);
                    setDurationMinutes(Number(e.target.value) || 15);
                  }}
                  className="w-24 bg-[#1b1c28] border border-[#2c2f44] rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold text-center"
                />
                <span className="text-xs text-gray-400">دقيقة</span>
              </div>
              <div className="text-xs text-gray-300 pt-1 flex justify-between items-center bg-[#141520] p-2.5 rounded-xl border border-[#222436]">
                <span>التكلفة المقدرة للجلسة:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">{estimatedCost} EGP</span>
              </div>
            </div>
          )}

          {/* Budget options */}
          {sessionType === 'budget' && (
            <div className="p-3.5 bg-[#181927] border border-[#282a3d] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300 font-bold">
                  المبلغ المدفوع من العميل:
                </span>
                <span className="text-[11px] font-mono text-red-400 bg-red-950/40 px-2 py-0.5 rounded-lg border border-red-500/30">
                  {minuteRate} ج/دقيقة
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={budgetEgp}
                  onChange={e => setBudgetEgp(Number(e.target.value))}
                  className="w-32 bg-[#1b1c28] border border-[#2c2f44] rounded-xl px-3 py-2 text-base text-white font-mono font-bold text-center"
                />
                <span className="text-xs text-gray-400 font-mono font-bold">جنيه مصري (EGP)</span>
              </div>
              {budgetInfo && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    budgetInfo.isBelowMinimum
                      ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                      : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  }`}
                >
                  {budgetInfo.isBelowMinimum ? (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        المبلغ أقل من الحد الأدنى (15 دقيقة = {budgetInfo.min15Cost} ج.م). سيتم احتساب 15 دقيقة.
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="font-bold">الوقت المتاح للعب بهذه الميزانية:</div>
                      <div className="text-sm font-mono font-black text-white mt-0.5">
                        {budgetInfo.approxHoursText}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono pt-1">
                        الحساب الدقيق: {budgetEgp} ÷ {minuteRate} ج/د = {budgetInfo.allowedMinutes} دقيقة لعب
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Game Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">اللعبة المطلوبة</label>
            <div className="grid grid-cols-3 gap-1.5 mb-1.5">
              {['FC 24', 'GTA V', 'Call of Duty: MW III', 'Spider-Man 2', 'eFootball 2024', 'UFC 5'].map(g => (
                <button
                  type="button"
                  key={g}
                  onClick={() => {
                    playClickSound();
                    setSelectedGame(g);
                    setCustomGame('');
                  }}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold transition text-center truncate cursor-pointer ${
                    selectedGame === g && !customGame
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-[#1b1c28] text-gray-300 border border-[#2b2d42] hover:bg-[#222436]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customGame}
              onChange={e => setCustomGame(e.target.value)}
              placeholder="أو اكتب اسم اللعبة هنا..."
              className="w-full bg-[#1b1c28] border border-[#2c2f44] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Pre-payment option */}
          <div className="p-3 bg-[#181927] border border-[#282a3d] rounded-2xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-200">
              <input
                type="checkbox"
                checked={isPrepaid}
                onChange={e => setIsPrepaid(e.target.checked)}
                className="rounded accent-red-600 w-4 h-4 cursor-pointer"
              />
              <span>تحصيل المبلغ مقدماً قبل بدء اللعب</span>
            </label>
            {isPrepaid && (
              <div className="flex items-center gap-2 pt-1.5">
                <span className="text-xs text-gray-400">طريقة الدفع:</span>
                {(['cash', 'instapay', 'vodafone'] as const).map(m => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => {
                      playClickSound();
                      setPaymentMethod(m);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      paymentMethod === m ? 'bg-red-600 text-white' : 'bg-[#222436] text-gray-400'
                    }`}
                  >
                    {m === 'cash' ? 'كاش' : m === 'instapay' ? 'InstaPay' : 'فودافون كاش'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-sm rounded-2xl transition shadow-xl shadow-red-950/80 cursor-pointer flex items-center justify-center gap-2 border border-red-500/40"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>تشغيل وبدء العداد</span>
          </button>
        </form>
      </div>
    </div>
  );
};
