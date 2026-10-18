import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wallet, DollarSign, User, AlertTriangle, CheckCircle2, X, PlusCircle, Gift, Wrench, ShoppingBag } from 'lucide-react';
import { playCashSound, playClickSound } from '../utils/sound';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose }) => {
  const { employees, recordSafeTransaction, activeShift, addNotification } = useApp();
  const [category, setCategory] = useState<'advance' | 'bonus' | 'supplies' | 'maintenance' | 'general'>('advance');
  const [amount, setAmount] = useState<number>(50);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.id || '');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  if (!isOpen) return null;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    const emp = employees.find(e => e.id === selectedEmployeeId);
    let finalDesc = description.trim();
    if (category === 'advance') {
      finalDesc = finalDesc || `سلفة للموظف: ${emp?.name || 'موظف'}`;
    } else if (category === 'bonus') {
      finalDesc = finalDesc || `مكافأة للموظف: ${emp?.name || 'موظف'}`;
    } else if (category === 'supplies') {
      finalDesc = finalDesc || 'شراء خامات وبوفيه للمركز';
    } else if (category === 'maintenance') {
      finalDesc = finalDesc || 'صيانة شاشات أو أجهزة أو أذرع';
    } else {
      finalDesc = finalDesc || 'مصروف عام للمركز';
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await recordSafeTransaction({
        type: category === 'advance' ? 'advance' : 'expense',
        amount: Number(amount),
        paymentMethod: 'cash',
        description: finalDesc,
        notes: notes.trim() || undefined,
      });
    } catch (error) {
      addNotification({ title: 'لم يتم تسجيل المصروف', message: error instanceof Error ? error.message : 'تعذر الاتصال بالخادم', type: 'warning' });
      setIsSubmitting(false); return;
    }
    setIsSubmitting(false);
    playCashSound();
    addNotification({
      title: 'تسجيل حركة مالية',
      message: `تم صرف ${amount} ج.م (${finalDesc}) من الخزينة.`,
      type: 'info',
    });

    setSuccessMsg(true);
    setTimeout(() => {
      setSuccessMsg(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#141520] border border-[#2b2d42] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-red-950/40 via-red-900/20 to-transparent border-b border-[#252839] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-black shadow-lg shadow-amber-950/60 font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">تسجيل سلفة أو مصروف</h3>
              <p className="text-[11px] text-gray-400">خصم نقدي مباشر من درج الوردية والخزينة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#1e2030] hover:bg-red-950/40 text-gray-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {successMsg ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-black text-white">تم قيد المصروف بنجاح!</h4>
            <p className="text-xs text-gray-400">تم تسجيل الحركة وتحديث رصيد الخزينة والوردية.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Category selection */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">نوع البند</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setCategory('advance');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    category === 'advance'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-[#1b1c28] text-gray-300 border border-[#2b2d40]'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>سلفة موظف</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setCategory('bonus');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    category === 'bonus'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'bg-[#1b1c28] text-gray-300 border border-[#2b2d40]'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>مكافأة موظف</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setCategory('supplies');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    category === 'supplies'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-[#1b1c28] text-gray-300 border border-[#2b2d40]'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>خامات وبوفيه</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setCategory('maintenance');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    category === 'maintenance'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-[#1b1c28] text-gray-300 border border-[#2b2d40]'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>صيانة وتجهيزات</span>
                </button>
              </div>
            </div>

            {/* If advance or bonus, show employee picker */}
            {(category === 'advance' || category === 'bonus') && (
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">الموظف المعني</label>
                {employees.length === 0 ? (
                  <div className="text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/30">
                    لا يوجد موظفين مسجلين حالياً، يمكنك إضافة موظفين من تبويب الموظفين
                  </div>
                ) : (
                  <select
                    value={selectedEmployeeId}
                    onChange={e => setSelectedEmployeeId(e.target.value)}
                    className="w-full bg-[#1b1c28] border border-[#2b2d40] rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-red-500"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role === 'cashier' ? 'كاشير' : emp.role === 'supervisor' ? 'مشرف' : 'فني'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Amount input */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">المبلغ المصروف (EGP)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="5"
                  required
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="w-full bg-[#1b1c28] border border-[#2b2d40] rounded-xl px-3 py-2.5 text-base font-mono font-bold text-white text-center focus:outline-none focus:border-red-500"
                />
                <span className="text-xs text-gray-400 font-mono font-bold">EGP</span>
              </div>
              <div className="flex gap-2 mt-1.5">
                {[20, 50, 100, 200].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setAmount(amt);
                    }}
                    className="flex-1 py-1 rounded-lg bg-[#202232] hover:bg-[#2b2d44] text-gray-300 text-[11px] font-mono font-bold cursor-pointer"
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">البيان والتفاصيل</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="مثال: سلفة نقدية أو شراء شاي وسكر..."
                className="w-full bg-[#1b1c28] border border-[#2b2d40] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">ملاحظات إضافية (اختياري)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="أي تفاصيل أخرى..."
                className="w-full bg-[#1b1c28] border border-[#2b2d40] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition shadow-lg shadow-red-950/60 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تأكيد الصرف من الخزينة</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
