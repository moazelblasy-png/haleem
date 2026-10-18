import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DeviceType, ControllersCount, RoundingPolicy } from '../types';
import {
  Settings,
  DollarSign,
  Gamepad2,
  Clock,
  History,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Plus,
  Shield,
  Key,
  Lock
} from 'lucide-react';
import { playClickSound } from '../utils/sound';

export const PricingSettingsView: React.FC = () => {
  const {
    pricingTiers,
    updatePricingTier,
    roundingPolicy,
    setRoundingPolicy,
    auditLog,
    currentUser,
    recordSafeTransaction,
    ownerProfile
  } = useApp();

  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType>('PS5');
  const [selectedControllers, setSelectedControllers] = useState<ControllersCount>(2);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<number>(0);
  const [successMsg, setSuccessMsg] = useState('');

  // Safe Transaction logging state
  const [showSafeTxModal, setShowSafeTxModal] = useState(false);
  const [txType, setTxType] = useState<'expense' | 'withdrawal' | 'advance'>('expense');
  const [txAmount, setTxAmount] = useState<number>(50);
  const [txMethod, setTxMethod] = useState<'cash' | 'instapay' | 'vodafone'>('cash');
  const [txDesc, setTxDesc] = useState('');

  // 2FA setting
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(ownerProfile?.twoFactorEnabled ?? true);

  const currentTiers = pricingTiers
    .filter(t => t.deviceType === selectedDeviceType && t.controllers === selectedControllers)
    .sort((a, b) => a.durationMinutes - b.durationMinutes);

  const priceAuditEntries = auditLog.filter(a => a.actionType === 'price_change' || a.actionType === 'password_changed');

  const handleSavePrice = (tierId: string) => {
    if (!currentUser?.isOwner) return;
    updatePricingTier(tierId, newPriceInput);
    setEditingTierId(null);
    setSuccessMsg('تم حفظ وتعديل السعر بنجاح.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSafeTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txDesc.trim() || txAmount <= 0) return;
    try {
      await recordSafeTransaction({ type: txType, amount: Number(txAmount), paymentMethod: txMethod, description: txDesc.trim() });
    } catch (error) { window.alert(error instanceof Error ? error.message : 'تعذر تسجيل حركة الخزنة'); return; }
    setShowSafeTxModal(false);
    setTxDesc('');
    setSuccessMsg('تم تسجيل حركة الخزينة بنجاح.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">إعدادات الأسعار والربط السحابي والأمان</h1>
            <div className="w-8 h-8 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            تسعير PS4 و PS5، سياسة التقريب، والتحقق بخطوتين (2FA)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playClickSound();
              setShowSafeTxModal(true);
            }}
            className="px-4 py-2.5 bg-[#1a1b28] hover:bg-[#25283b] text-gray-200 border border-[#2b2d42] rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <Wallet className="w-4 h-4 text-amber-400" />
            <span>تسجيل حركة خزنة مباشرة</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Multi-Factor Authentication (MFA / 2FA) Setting (User requested!) */}
      <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#202232]">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-red-500" />
            <div>
              <h3 className="text-base font-black text-white">التحقق متعدد العوامل (Multi-Factor Authentication - 2FA)</h3>
              <p className="text-xs text-gray-400">حماية حسابات الإدارة والموظفين برمز تحقق إضافي عند تسجيل الدخول وإغلاق الشفت</p>
            </div>
          </div>
          <button
            onClick={() => {
              playClickSound();
              setTwoFactorEnabled(!twoFactorEnabled);
              setSuccessMsg(`تم ${!twoFactorEnabled ? 'تفعيل' : 'تعطيل'} ميزة التحقق بخطوتين 2FA بنجاح.`);
              setTimeout(() => setSuccessMsg(''), 3000);
            }}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              twoFactorEnabled ? 'bg-red-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                twoFactorEnabled ? 'right-1' : 'right-7'
              }`}
            ></span>
          </button>
        </div>
        <p className="text-xs text-gray-400">
          عند تفعيل هذه الميزة، يتطلب النظام إدخال رمز التحقق الأمني المكون من 6 أرقام (أو رمز PIN للمالك) عند الدخول وتعديل الحسابات الحساسة.
        </p>
      </div>

      {/* Rounding Policy Setting */}
      <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#202232]">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-black text-white">سياسة تقريب أوقات اللعب</h3>
          </div>
          {!currentUser?.isOwner && (
            <span className="text-xs text-amber-400 font-bold">صلاحية المالك فقط</span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          تحدد طريقة حساب الدقائق عند انتهاء الجلسة، علماً بأن الحد الأدنى لأي جلسة هو 15 دقيقة دائماً.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              id: 'ceil_quarter',
              title: 'تقريب لأقرب ربع ساعة (مُوصى به)',
              desc: 'مثال: لعب ساعة و 10 دقائق (70 دقيقة) يُحاسب كـ ساعة وربع (75 دقيقة).',
            },
            {
              id: 'ceil_tier',
              title: 'التقريب للشريحة التالية',
              desc: 'يتم احتساب سعر الشريحة الأعلى فور تجاوز الدقائق الحالية.',
            },
            {
              id: 'exact_minute',
              title: 'حساب بالدقيقة الدقيقة',
              desc: 'حساب سعر الدقيقة الفعلي بعد تجاوز الـ 15 دقيقة الأولى.',
            },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => {
                playClickSound();
                currentUser?.isOwner && setRoundingPolicy(opt.id as RoundingPolicy);
              }}
              disabled={!currentUser?.isOwner}
              className={`p-4 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between ${
                roundingPolicy === opt.id
                  ? 'border-red-600 bg-red-950/20 text-white shadow-lg shadow-red-950/30'
                  : 'border-[#232535] bg-[#171824] text-gray-400 hover:text-white'
              }`}
            >
              <div>
                <span className="text-xs font-bold block mb-1">{opt.title}</span>
                <span className="text-[11px] text-gray-400 leading-relaxed block">{opt.desc}</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-red-400">
                {roundingPolicy === opt.id && <span>✓ السياسة المفعلة</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pricing Matrix View */}
      <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#202232]">
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-5 h-5 text-red-500" />
            <div>
              <h3 className="text-base font-black text-white">مصفوفة تسعير الجلسات والشرائح</h3>
              <p className="text-xs text-gray-400">تعديل أسعار الشرائح (EGP) حسب عدد الأذرع والكونسول</p>
            </div>
          </div>

          {/* Device Type Toggle (PS5 / PS4) */}
          <div className="flex items-center gap-2 bg-[#1b1c28] p-1 rounded-xl border border-[#292b3d]">
            <button
              onClick={() => {
                playClickSound();
                setSelectedDeviceType('PS5');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition font-mono cursor-pointer ${
                selectedDeviceType === 'PS5' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              PlayStation 5
            </button>
            <button
              onClick={() => {
                playClickSound();
                setSelectedDeviceType('PS4');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition font-mono cursor-pointer ${
                selectedDeviceType === 'PS4' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              PlayStation 4
            </button>
          </div>
        </div>

        {/* Controllers count selector (2, 3, 4) */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400">عدد الأذرع:</span>
          <div className="flex items-center gap-2">
            {[2, 3, 4].map(c => (
              <button
                key={c}
                onClick={() => {
                  playClickSound();
                  setSelectedControllers(c as ControllersCount);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedControllers === c
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-[#1b1c28] text-gray-400 hover:text-white border border-[#26283b]'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                <span>{c} أذرع</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pricing Tiers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {currentTiers.map(tier => {
            const isEditing = editingTierId === tier.id;
            return (
              <div
                key={tier.id}
                className="bg-[#171824] border border-[#242638] rounded-2xl p-3 flex flex-col justify-between text-center relative hover:border-[#35384e] transition"
              >
                <div>
                  <span className="text-[11px] font-bold text-gray-400 block mb-1">
                    {tier.durationMinutes === 15
                      ? 'ربع ساعة'
                      : tier.durationMinutes === 30
                      ? 'نصف ساعة'
                      : tier.durationMinutes === 45
                      ? '45 دقيقة'
                      : tier.durationMinutes === 60
                      ? 'ساعة كاملة'
                      : tier.durationMinutes === 75
                      ? 'ساعة وربع'
                      : tier.durationMinutes === 90
                      ? 'ساعة ونصف'
                      : tier.durationMinutes === 105
                      ? 'ساعة و45 د'
                      : 'ساعتين'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono block">({tier.durationMinutes} دقيقة)</span>
                </div>

                <div className="my-3">
                  {isEditing ? (
                    <div className="space-y-1">
                      <input
                        type="number"
                        min="1"
                        value={newPriceInput}
                        onChange={e => setNewPriceInput(Number(e.target.value))}
                        className="w-full bg-[#1b1c28] border border-red-500 rounded-lg px-1 py-1 text-center font-mono font-bold text-sm text-white"
                      />
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleSavePrice(tier.id)}
                          className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold cursor-pointer"
                        >
                          حفظ
                        </button>
                        <button
                          onClick={() => setEditingTierId(null)}
                          className="px-2 py-0.5 bg-gray-700 text-white rounded text-[10px] cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xl font-black font-mono text-white">
                      {tier.priceEgp} <span className="text-xs text-red-400 font-sans">EGP</span>
                    </div>
                  )}
                </div>

                {currentUser?.isOwner && !isEditing && (
                  <button
                    onClick={() => {
                      setEditingTierId(tier.id);
                      setNewPriceInput(tier.priceEgp);
                    }}
                    className="w-full py-1 bg-[#1f2130] hover:bg-red-600 text-gray-400 hover:text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    تعديل السعر
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Price Changes Audit History */}
      <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#202232]">
          <History className="w-5 h-5 text-red-500" />
          <h3 className="text-base font-black text-white">سجل تعديلات الأسعار والأمان (Audit Log)</h3>
        </div>
        {priceAuditEntries.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-xs">
            لا توجد تعديلات سابقة مسجلة.
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {priceAuditEntries.map(entry => (
              <div
                key={entry.id}
                className="p-3 bg-[#181926] border border-[#242638] rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-white">{entry.userName}:</span> {entry.description}
                  {entry.oldValue && entry.newValue && (
                    <span className="text-gray-400 block font-mono text-[11px] mt-0.5">
                      القيمة السابقة: {entry.oldValue} EGP ← الجديدة: {entry.newValue} EGP
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-500 font-mono shrink-0">
                  {new Date(entry.timestamp).toLocaleString('ar-EG')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Safe Transaction Modal */}
      {showSafeTxModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-500" />
              <span>تسجيل حركة خزنة نقدية</span>
            </h3>
            <form onSubmit={handleSafeTxSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">نوع الحركة</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'expense', label: 'مصروفات' },
                    { id: 'withdrawal', label: 'مسحوبات مالك' },
                    { id: 'advance', label: 'سلفة موظف' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTxType(t.id as any)}
                      className={`py-2 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                        txType === t.id
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-[#1b1c28] text-gray-400 border border-[#2b2d42]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">المبلغ (EGP)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={txAmount}
                    onChange={e => setTxAmount(Number(e.target.value))}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">طريقة الدفع</label>
                  <select
                    value={txMethod}
                    onChange={e => setTxMethod(e.target.value as any)}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="cash">كاش (من الدرج)</option>
                    <option value="instapay">InstaPay</option>
                    <option value="vodafone">فودافون كاش</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">البيان والسبب</label>
                <input
                  type="text"
                  required
                  value={txDesc}
                  onChange={e => setTxDesc(e.target.value)}
                  placeholder="مثال: فاتورة كهرباء أو صيانة ذراع..."
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  تسجيل المعاملة
                </button>
                <button
                  type="button"
                  onClick={() => setShowSafeTxModal(false)}
                  className="px-4 py-2.5 bg-[#1f212f] text-gray-400 hover:text-white rounded-xl text-xs cursor-pointer"
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
