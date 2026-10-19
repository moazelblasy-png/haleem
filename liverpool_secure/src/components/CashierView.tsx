import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GameSession, Device } from '../types';
import { calculateInvoiceTotals, calculatePaymentBalance, calculateSessionGamingCost } from '../logic/pricing';
import {
  Receipt,
  Banknote,
  Smartphone,
  CreditCard,
  Printer,
  CheckCircle2,
  Trash2,
  Plus,
  Tv,
  Coffee,
  X,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { playCashSound, playClickSound } from '../utils/sound';

interface CashierViewProps {
  initialSessionToCheckout?: GameSession | null;
  onCheckoutComplete?: () => void;
}

export const CashierView: React.FC<CashierViewProps> = ({
  initialSessionToCheckout,
  onCheckoutComplete,
}) => {
  const {
    sessions,
    devices,
    inventory,
    activeBranch,
    pricingTiers,
    roundingPolicy,
    completeSession,
    sellBarItems,
    activeShift,
    currentUser,
    setActiveView
  } = useApp();

  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    initialSessionToCheckout?.id || ''
  );

  const [extraItems, setExtraItems] = useState<
    Array<{ id: string; productId: string; name: string; quantity: number; unitPrice: number }>
  >([]);

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'vodafone'>('cash');
  const [amountTenderedStr, setAmountTenderedStr] = useState<string>('');
  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percent'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [printReceipt, setPrintReceipt] = useState<boolean>(true);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);
  const [completedInvoiceData, setCompletedInvoiceData] = useState<any>(null);

  const activeBranchSessions = sessions.filter(
    s => s.branchId === activeBranch?.id && s.status === 'active'
  );

  const currentSession = sessions.find(s => s.id === selectedSessionId) || null;
  const currentDevice = currentSession ? devices.find(d => d.id === currentSession.deviceId) : null;

  // Calculate bill items
  let gamingTotal = 0;
  const sessionItems: Array<{ id: string; name: string; quantity: number; unitPrice: number; total: number }> = [];

  if (currentSession) {
    const { totalCost } = calculateSessionGamingCost(
      currentSession.segments,
      Date.now(),
      pricingTiers,
      roundingPolicy
    );
    gamingTotal = Math.max(0, totalCost - currentSession.paidAmount);
    sessionItems.push({
      id: 'gaming-time',
      name: `جلسة بلايستيشن ${currentDevice?.type || '5'} (${currentDevice?.screenNumber || ''})`,
      quantity: 1,
      unitPrice: gamingTotal,
      total: gamingTotal,
    });

    currentSession.products.forEach(p => {
      if (!p.isPaid) {
        sessionItems.push({
          id: p.id,
          name: p.name,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          total: p.unitPrice * p.quantity,
        });
      }
    });
  }

  const allLineItems = [
    ...sessionItems,
    ...extraItems.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.unitPrice * item.quantity,
    })),
  ];

  const subtotal = allLineItems.reduce((sum, item) => sum + item.total, 0);
  const { discountAmount, grandTotal } = calculateInvoiceTotals(
    subtotal,
    0,
    discountType,
    discountValue,
    0
  );

  const tenderedNumeric = amountTenderedStr ? parseFloat(amountTenderedStr) : grandTotal;
  const { change, remainingDebt } = calculatePaymentBalance(grandTotal, tenderedNumeric || 0);

  const handleNumpadPress = (digit: string) => {
    playClickSound();
    if (digit === 'C') {
      setAmountTenderedStr('');
      return;
    }
    if (digit === 'BACK') {
      setAmountTenderedStr(prev => prev.slice(0, -1));
      return;
    }
    if (digit === '.' && amountTenderedStr.includes('.')) return;
    setAmountTenderedStr(prev => prev + digit);
  };

  const handleQuickAmount = (val: number) => {
    playClickSound();
    setAmountTenderedStr(val.toString());
  };

  const handleRemoveLineItem = (id: string) => {
    playClickSound();
    setExtraItems(prev => prev.filter(i => i.id !== id));
  };

  const handleAddDirectProduct = (product: any) => {
    playClickSound();
    setExtraItems(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: product.sellingPrice,
        },
      ];
    });
  };

  const handleExecutePayment = async () => {
    if (grandTotal <= 0 && allLineItems.length === 0) return;

    if (currentSession && extraItems.length > 0) {
      alert('أضف منتجات الجلسة من شاشة تفاصيل الجلسة حتى تدخل في نفس الفاتورة بشكل صحيح');
      return;
    }
    if (!currentSession && tenderedNumeric < grandTotal) {
      alert('لا يمكن إتمام بيع مباشر مع دفع جزئي؛ سجّل المبلغ كاملاً أو استخدم فاتورة مديونية');
      return;
    }
    const invalidDirectItem = extraItems.find(item => {
      const stockItem = inventory.find(i => i.id === item.productId);
      return !stockItem || !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > stockItem.stockQuantity;
    });
    if (invalidDirectItem) {
      alert('الكمية المطلوبة غير متاحة في المخزون، ولم يتم تسجيل البيع');
      return;
    }

    // Check shift permissions: employees cannot checkout unless shift is open
    if (!currentUser?.isOwner && !activeShift) {
      alert('يجب فتح شيفت واستلام الوردية قبل إجراء المعاملات النقدية');
      return;
    }

    playCashSound();

    if (currentSession) {
      try {
        const res = await completeSession(currentSession.id, {
          discountType,
          discountValue,
          paymentMethod,
          amountReceived: tenderedNumeric,
        });

        setCompletedInvoiceData({
          invoice: res.invoice,
          change,
          paid: tenderedNumeric,
          method: paymentMethod,
          items: allLineItems,
        });
        setIsCompletedModalOpen(true);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'تعذر إنهاء الجلسة؛ لم يتم اعتماد الفاتورة');
        return;
      }
    } else {
      const saleResult = await sellBarItems(extraItems.map(item => ({ productId: item.productId, quantity: item.quantity })), paymentMethod);
      if (!saleResult.success) {
        alert(saleResult.message || 'فشل تسجيل البيع على الخادم؛ لم يتم اعتماد العملية');
        return;
      }

      setCompletedInvoiceData({
        invoice: {
          sessionNumber: `INV-${Date.now().toString().slice(-6)}`,
          customerName: 'عميل كافتيريا مباشر',
          finalGrandTotal: grandTotal,
        },
        change,
        paid: tenderedNumeric,
        method: paymentMethod,
        items: allLineItems,
      });
      setIsCompletedModalOpen(true);
    }

    setExtraItems([]);
    setSelectedSessionId('');
    setAmountTenderedStr('');
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Session Selector Strip */}
      {activeBranchSessions.length > 0 && (
        <div className="bg-[#14151f] border border-[#232535] p-3 rounded-2xl flex items-center gap-3 overflow-x-auto shadow-lg">
          <span className="text-xs font-bold text-gray-400 shrink-0">اختر جلسة للمحاسبة:</span>
          {activeBranchSessions.map(s => {
            const dev = devices.find(d => d.id === s.deviceId);
            const isSelected = s.id === selectedSessionId;
            return (
              <button
                key={s.id}
                onClick={() => {
                  playClickSound();
                  setSelectedSessionId(s.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-[#1b1c28] text-gray-300 hover:bg-[#252839] border border-[#292c3f]'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>{dev?.screenNumber} - {s.customerName}</span>
              </button>
            );
          })}
          {selectedSessionId && (
            <button
              onClick={() => setSelectedSessionId('')}
              className="text-xs text-red-400 hover:text-red-300 font-bold shrink-0 underline cursor-pointer"
            >
              إلغاء التحديد (فاتورة بوفيه فقط)
            </button>
          )}
        </div>
      )}

      {/* Main Cashier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Invoice Details Table (7 cols) */}
        <div className="lg:col-span-7 bg-[#14151e] border border-[#232535] rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#202232] mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-white">تفاصيل الفاتورة</h3>
              </div>
              {currentSession && (
                <span className="text-xs font-mono font-bold text-red-400 bg-red-950/40 px-3 py-1 rounded-full border border-red-500/30">
                  {currentSession.sessionNumber}
                </span>
              )}
            </div>

            {/* Table Header & Rows */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#202232] text-gray-400">
                    <th className="py-2.5 px-3 font-bold">الصنف</th>
                    <th className="py-2.5 px-3 text-center font-bold">الكمية</th>
                    <th className="py-2.5 px-3 text-center font-bold">السعر</th>
                    <th className="py-2.5 px-3 text-center font-bold">الإجمالي</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b1c28]">
                  {allLineItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500 text-xs">
                        الفاتورة فارغة. اختر جلسة نشطة من الأعلى أو أضف أصناف من الكافتيريا بالأسفل.
                      </td>
                    </tr>
                  ) : (
                    allLineItems.map(item => (
                      <tr key={item.id} className="hover:bg-[#181926] text-gray-200">
                        <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <span>{item.name}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">{item.quantity}</td>
                        <td className="py-3 px-3 text-center font-mono">{item.unitPrice.toFixed(2)}</td>
                        <td className="py-3 px-3 text-center font-mono font-black text-white">
                          {item.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {item.id !== 'gaming-time' && (
                            <button
                              onClick={() => handleRemoveLineItem(item.id)}
                              className="w-7 h-7 bg-red-950/50 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick Bar Add Pills */}
            <div className="mt-4 pt-3 border-t border-[#202232]">
              <span className="text-[11px] font-bold text-gray-400 block mb-2">إضافة أصناف مباشرة للفاتورة:</span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {inventory
                  .filter(i => i.branchId === activeBranch?.id)
                  .map(invItem => (
                    <button
                      key={invItem.id}
                      onClick={() => handleAddDirectProduct(invItem)}
                      className="px-2.5 py-1 bg-[#1a1b28] hover:bg-red-600/30 text-gray-300 hover:text-white border border-[#2b2d42] rounded-lg text-[11px] transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>+ {invItem.name}</span>
                      <span className="text-red-400 font-mono">({invItem.sellingPrice} EGP)</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Subtotal & Grand Total Section */}
          <div className="mt-6 pt-4 border-t border-[#202232] space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-300">
              <span>المجموع الفرعي:</span>
              <span className="font-mono font-bold text-sm">{subtotal.toFixed(2)} EGP</span>
            </div>

            {/* Discount */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-gray-400">تطبيق خصم:</span>
              <div className="flex items-center gap-2">
                <select
                  value={discountType}
                  onChange={e => setDiscountType(e.target.value as any)}
                  className="bg-[#1b1c28] border border-[#2b2e42] rounded-lg px-2 py-1 text-white text-xs font-bold"
                >
                  <option value="none">بدون</option>
                  <option value="fixed">مبلغ ثابت</option>
                  <option value="percent">نسبة مئوية %</option>
                </select>
                {discountType !== 'none' && (
                  <input
                    type="number"
                    min="0"
                    value={discountValue}
                    onChange={e => setDiscountValue(Number(e.target.value))}
                    className="w-16 bg-[#1b1c28] border border-[#2b2e42] rounded-lg px-2 py-1 text-center font-mono font-bold text-white text-xs"
                  />
                )}
                <span className="font-mono text-red-400 font-bold">-{discountAmount.toFixed(2)} EGP</span>
              </div>
            </div>

            {/* Grand Total */}
            <div className="flex items-baseline justify-between pt-2 border-t border-[#26283b]">
              <span className="text-sm font-bold text-gray-300">الإجمالي الكلي:</span>
              <div className="text-3xl md:text-4xl font-black text-red-500 font-mono tracking-tight">
                {grandTotal.toFixed(2)} <span className="text-sm font-sans text-red-400">EGP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Payment Methods & Numpad (5 cols) */}
        <div className="lg:col-span-5 bg-[#14151e] border border-[#232535] rounded-3xl p-6 flex flex-col justify-between shadow-xl space-y-5">
          {/* Payment Method Cards */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#202232] mb-3">
              <h4 className="font-black text-sm text-white">طريقة الدفع</h4>
              <CreditCard className="w-4 h-4 text-gray-400" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Cash */}
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setPaymentMethod('cash');
                }}
                className={`p-3 rounded-2xl border-2 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'border-red-600 bg-red-950/20 text-white shadow-lg shadow-red-950/40'
                    : 'border-[#232535] bg-[#1a1b28] text-gray-400 hover:text-white'
                }`}
              >
                <Banknote className={`w-6 h-6 ${paymentMethod === 'cash' ? 'text-red-500' : 'text-gray-400'}`} />
                <span className="text-xs font-bold">كاش</span>
              </button>

              {/* InstaPay */}
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setPaymentMethod('instapay');
                }}
                className={`p-3 rounded-2xl border-2 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  paymentMethod === 'instapay'
                    ? 'border-red-600 bg-red-950/20 text-white shadow-lg shadow-red-950/40'
                    : 'border-[#232535] bg-[#1a1b28] text-gray-400 hover:text-white'
                }`}
              >
                <Smartphone className={`w-6 h-6 ${paymentMethod === 'instapay' ? 'text-amber-400' : 'text-gray-400'}`} />
                <span className="text-xs font-bold font-mono">InstaPay</span>
              </button>

              {/* Vodafone Cash */}
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setPaymentMethod('vodafone');
                }}
                className={`p-3 rounded-2xl border-2 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                  paymentMethod === 'vodafone'
                    ? 'border-red-600 bg-red-950/20 text-white shadow-lg shadow-red-950/40'
                    : 'border-[#232535] bg-[#1a1b28] text-gray-400 hover:text-white'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                  paymentMethod === 'vodafone' ? 'bg-red-600' : 'bg-gray-600'
                }`}>
                  V
                </div>
                <span className="text-[11px] font-bold">فودافون كاش</span>
              </button>
            </div>
          </div>

          {/* Amount Paid Display */}
          <div className="space-y-1">
            <span className="text-[11px] text-gray-400 block font-medium">المبلغ المدفوع (EGP)</span>
            <div className="bg-[#191a27] border border-[#2b2e44] rounded-2xl p-3 flex items-center justify-between">
              <button
                onClick={() => setAmountTenderedStr('')}
                className="w-7 h-7 rounded-lg bg-[#25283a] text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-2xl font-black font-mono text-white tracking-wider">
                {(tenderedNumeric || 0).toFixed(2)}
              </div>
            </div>

            {/* Quick buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[50, 100, 200].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="py-1.5 bg-[#1b1c2a] hover:bg-[#25283b] text-gray-300 text-xs font-mono font-bold rounded-xl border border-[#282a3f] transition cursor-pointer"
                >
                  +{val} EGP
                </button>
              ))}
            </div>
          </div>

          {/* Virtual Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'BACK'].map(key => (
              <button
                key={key}
                type="button"
                onClick={() => handleNumpadPress(key)}
                className="h-12 rounded-xl bg-[#1a1b28] hover:bg-red-600/30 text-white font-mono font-bold text-lg border border-[#26283b] transition flex items-center justify-center active:scale-95 cursor-pointer"
              >
                {key === 'BACK' ? 'مسح' : key}
              </button>
            ))}
          </div>

          {/* Remaining Change / Debt */}
          <div className="bg-[#181a26] border border-[#26283c] rounded-2xl p-3 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold">
              {change > 0 ? 'المتبقي للعميل (الباقي):' : remainingDebt > 0 ? 'المتبقي على العميل (دين):' : 'المبلغ مسدد بالضبط'}
            </span>
            <span
              className={`text-xl font-black font-mono ${
                remainingDebt > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {remainingDebt > 0 ? `-${remainingDebt.toFixed(2)}` : change.toFixed(2)} EGP
            </span>
          </div>

          {/* Receipt toggle & Complete Button */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={printReceipt}
                  onChange={e => setPrintReceipt(e.target.checked)}
                  className="rounded accent-red-600"
                />
                <span>طباعة إيصال دفع</span>
              </label>
              <Printer className="w-4 h-4 text-gray-400" />
            </div>

            <button
              onClick={handleExecutePayment}
              disabled={allLineItems.length === 0}
              className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black text-sm rounded-2xl transition shadow-xl shadow-red-950/60 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>إتمام العملية والتحصيل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Receipt Confirmation Modal */}
      {isCompletedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#141520] border border-[#2b2d42] rounded-3xl w-full max-w-md p-6 text-center shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-white">تمت العملية بنجاح!</h3>
            <p className="text-xs text-gray-400">
              تم تسجيل الإيراد في خزينة الفرع وطباعة السجل.
            </p>

            <div className="bg-white text-black p-4 rounded-2xl text-right font-mono text-xs space-y-2 shadow-inner">
              <div className="text-center pb-2 border-b border-gray-300">
                <div className="font-black text-sm tracking-widest text-red-700">LIVERPOOL GAMING</div>
                <div className="text-[10px] text-gray-600">فرع {activeBranch?.nameAr}</div>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-300 pb-2">
                <span>رقم الفاتورة:</span>
                <span className="font-bold">{completedInvoiceData?.invoice?.sessionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>الإجمالي:</span>
                <span className="font-bold">{completedInvoiceData?.invoice?.finalGrandTotal?.toFixed(2)} EGP</span>
              </div>
              <div className="flex justify-between">
                <span>المدفوع:</span>
                <span className="font-bold">{completedInvoiceData?.paid?.toFixed(2)} EGP</span>
              </div>
              <div className="flex justify-between">
                <span>الباقي للعميل:</span>
                <span className="font-bold">{completedInvoiceData?.change?.toFixed(2)} EGP</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-[#202235] hover:bg-[#2b2d45] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة</span>
              </button>
              <button
                onClick={() => {
                  setIsCompletedModalOpen(false);
                  if (onCheckoutComplete) onCheckoutComplete();
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-red-950/60"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
