import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { InventoryItem } from '../types';
import {
  Coffee,
  Plus,
  Minus,
  Trash2,
  Search,
  CheckCircle2,
  Printer,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Banknote,
  Smartphone,
  AlertTriangle
} from 'lucide-react';
import { playCashSound, playClickSound } from '../utils/sound';

export const BarPOSView: React.FC = () => {
  const {
    inventory,
    activeBranch,
    sellBarItems,
    initializeDefaultCatalogueForBranch,
    addInventoryItem,
    activeShift,
    addNotification,
  } = useApp();

  const [activeCategory, setActiveCategory] = useState<'all' | 'hot_drinks' | 'cold_drinks' | 'food' | 'snacks'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'vodafone' | 'instapay' | 'card'>('cash');
  const [cart, setCart] = useState<Array<{ item: InventoryItem; quantity: number }>>([]);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastReceiptData, setLastReceiptData] = useState<any>(null);

  // Quick item addition modal
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPrice, setQuickPrice] = useState(15);
  const [quickCost, setQuickCost] = useState(8);
  const [quickStock, setQuickStock] = useState(30);
  const [quickCategory, setQuickCategory] = useState<InventoryItem['category']>('hot_drinks');

  const branchItems = inventory.filter(i => i.branchId === activeBranch?.id);
  const filteredItems = branchItems.filter(item => {
    const matchCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchCategory && matchSearch;
  });

  const addToCart = (item: InventoryItem) => {
    playClickSound();
    setCart(prev => {
      const existing = prev.find(line => line.item.id === item.id);
      if (existing) {
        return prev.map(line =>
          line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateCartQty = (itemId: string, delta: number) => {
    playClickSound();
    setCart(prev => {
      return prev
        .map(line => {
          if (line.item.id === itemId) {
            const newQty = line.quantity + delta;
            return newQty > 0 ? { ...line, quantity: newQty } : null;
          }
          return line;
        })
        .filter(Boolean) as Array<{ item: InventoryItem; quantity: number }>;
    });
  };

  const removeFromCart = (itemId: string) => {
    playClickSound();
    setCart(prev => prev.filter(line => line.item.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, line) => sum + (line.item.sellingPrice * line.quantity), 0);
  const totalItemsCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  const handleCompleteOrder = async () => {
    if (cart.length === 0) return;

    if (isSubmittingSale) return;
    setIsSubmittingSale(true);
    const result = await sellBarItems(cart.map(line => ({ productId: line.item.id, quantity: line.quantity })), paymentMethod);
    setIsSubmittingSale(false);
    if (!result.success) {
      addNotification({ title: 'لم يتم اعتماد البيع', message: result.message || 'تعذر تسجيل العملية على الخادم؛ لم يتم إصدار إيصال.', type: 'warning' });
      return;
    }
    playCashSound();

    const receipt = {
      orderNumber: `#BAR-${Date.now().toString().slice(-4)}`,
      timestamp: Date.now(),
      branchName: activeBranch?.nameAr || 'ليفربول',
      customerName: customerName.trim() || 'عميل مباشر',
      paymentMethod,
      items: [...cart],
      total: result.total ?? cartTotal,
      cashierName: activeShift?.cashierName || 'كاشير الفرع'
    };

    setLastReceiptData(receipt);
    setShowReceiptModal(true);
    setCart([]);
    setCustomerName('');

    addNotification({
      title: 'طلب بوفيه مباشر',
      message: `تم بيع طلب كافتيريا بقيمة ${cartTotal} ج.م (${paymentMethod})`,
      type: 'success',
    });
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    try { await addInventoryItem({
      branchId: activeBranch?.id || 'liverpool',
      name: quickName.trim(),
      category: quickCategory,
      sellingPrice: Number(quickPrice),
      costPrice: Number(quickCost),
      stockQuantity: Number(quickStock),
      minStockThreshold: 10,
    }); } catch (error) { addNotification({ title: 'فشل حفظ الصنف', message: error instanceof Error ? error.message : 'تعذر الاتصال بالخادم', type: 'warning' }); return; }
    setShowQuickAddModal(false);
    setQuickName('');
    playClickSound();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">نظام كافتيريا وبوفيه الألعاب</h1>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Coffee className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 bg-red-600/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold">
              نقاط بيع سريعة
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            بيع مباشر للمشروبات والوجبات السريعة وإصدار إيصالات فورية
          </p>
        </div>

        <div className="flex items-center gap-3">
          {branchItems.length === 0 && (
            <button
              onClick={() => {
                playClickSound();
                initializeDefaultCatalogueForBranch(activeBranch?.id || 'liverpool');
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-950/60 flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>تهيئة قائمة البوفيه الافتراضية</span>
            </button>
          )}

          <button
            onClick={() => {
              playClickSound();
              setShowQuickAddModal(true);
            }}
            className="px-4 py-2.5 bg-[#1f2130] hover:bg-[#282a3d] text-gray-200 border border-[#2f3248] font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>+ صنف جديد</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Products catalogue (Left) + Cart & Billing (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Products Area */}
        <div className="lg:col-span-8 space-y-4">
          {/* Categories & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#13141d] p-3 rounded-2xl border border-[#222436]">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-gray-500 absolute right-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مشروب أو وجبة..."
                className="w-full bg-[#1b1c28] border border-[#2b2d42] rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'hot_drinks', label: 'مشروبات ساخنة' },
                { id: 'cold_drinks', label: 'مشروبات باردة' },
                { id: 'food', label: 'مأكولات ونودلز' },
                { id: 'snacks', label: 'سناكس وشيبسي' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    playClickSound();
                    setActiveCategory(cat.id as any);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-[#1b1c28] text-gray-300 hover:bg-[#25273b]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Items Grid */}
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center bg-[#13141d] border border-[#222436] rounded-3xl space-y-4">
              <Coffee className="w-12 h-12 text-gray-600 mx-auto" />
              <h3 className="text-base font-bold text-gray-300">لا توجد أصناف مطابقة</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                يمكنك تهيئة القائمة الجاهزة لأصناف الكافتيريا لفرع {activeBranch?.nameAr} بضغطة واحدة.
              </p>
              <button
                onClick={() => initializeDefaultCatalogueForBranch(activeBranch?.id || 'liverpool')}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer"
              >
                تهيئة أصناف {activeBranch?.nameAr}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredItems.map(item => {
                const isOutOfStock = item.stockQuantity <= 0;
                const inCart = cart.find(c => c.item.id === item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => !isOutOfStock && addToCart(item)}
                    className={`bg-[#141520] border-2 rounded-2xl p-3.5 flex flex-col justify-between transition group relative select-none cursor-pointer ${
                      isOutOfStock
                        ? 'border-gray-800 opacity-60 cursor-not-allowed'
                        : inCart
                        ? 'border-red-600 bg-red-950/10 shadow-lg shadow-red-950/30'
                        : 'border-[#232537] hover:border-red-600/60 hover:bg-[#1a1b29]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2 text-[10px]">
                      <span className="text-gray-400 font-medium">
                        {item.category === 'food'
                          ? 'مأكولات'
                          : item.category === 'hot_drinks'
                          ? 'ساخن'
                          : item.category === 'cold_drinks'
                          ? 'بارد'
                          : 'سناكس'}
                      </span>
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                          isOutOfStock
                            ? 'bg-red-950 text-red-400'
                            : item.stockQuantity <= item.minStockThreshold
                            ? 'bg-amber-950 text-amber-400'
                            : 'bg-emerald-950 text-emerald-400'
                        }`}
                      >
                        {isOutOfStock ? 'نفذ' : `${item.stockQuantity} متبقي`}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-white leading-tight my-1 line-clamp-2">
                      {item.name}
                    </h4>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1f2130]">
                      <div className="text-right">
                        <span className="text-sm font-black font-mono text-emerald-400">
                          {item.sellingPrice}
                        </span>
                        <span className="text-[10px] text-gray-400 mr-1 font-mono">EGP</span>
                      </div>

                      {inCart ? (
                        <div className="w-6 h-6 rounded-full bg-red-600 text-white font-mono text-xs font-black flex items-center justify-center shadow">
                          {inCart.quantity}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-xl bg-[#202232] group-hover:bg-red-600 text-gray-300 group-hover:text-white flex items-center justify-center transition">
                          <Plus className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Cart & Instant Checkout */}
        <div className="lg:col-span-4">
          <div className="bg-[#12131b] border-2 border-[#26283b] rounded-3xl p-5 sticky top-24 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#212333]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-black text-white">سلة الطلبات</h3>
              </div>
              <span className="text-xs font-mono font-bold bg-[#1d1f2e] text-gray-300 px-2.5 py-1 rounded-xl">
                {totalItemsCount} أصناف
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1">
                اسم العميل أو الطاولة (اختياري)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="عميل مباشر..."
                className="w-full bg-[#181926] border border-[#2b2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-xs">
                  السلة فارغة. اضغط على أي صنف لإضافته.
                </div>
              ) : (
                cart.map(line => (
                  <div
                    key={line.item.id}
                    className="bg-[#181926] border border-[#25273a] rounded-xl p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{line.item.name}</div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        {line.item.sellingPrice} EGP × {line.quantity} = {line.item.sellingPrice * line.quantity} EGP
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateCartQty(line.item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-[#222436] hover:bg-red-950/60 text-gray-300 flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-bold text-xs text-white">
                        {line.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQty(line.item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-[#222436] hover:bg-emerald-950/60 text-gray-300 flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(line.item.id)}
                        className="p-1 text-gray-500 hover:text-red-400 transition mr-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 mb-1.5">طريقة الدفع</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cash', label: 'كاش' },
                  { id: 'vodafone', label: 'فودافون كاش' },
                  { id: 'instapay', label: 'InstaPay' },
                  { id: 'card', label: 'فيزا / بطاقة' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setPaymentMethod(m.id as any);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                      paymentMethod === m.id
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-[#181926] text-gray-400 border border-[#26283b] hover:bg-[#202235]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Total and Checkout */}
            <div className="pt-3 border-t border-[#222436] space-y-3">
              <div className="flex items-center justify-between text-base font-black">
                <span className="text-gray-300">الإجمالي:</span>
                <span className="text-xl font-mono text-emerald-400">{cartTotal.toFixed(2)} EGP</span>
              </div>
              <button
                disabled={cart.length === 0 || isSubmittingSale}
                onClick={() => void handleCompleteOrder()}
                className={`w-full py-3.5 rounded-2xl font-black text-sm transition flex items-center justify-center gap-2 shadow-xl cursor-pointer ${
                  cart.length === 0
                    ? 'bg-[#1f2130] text-gray-600 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>إتمام البيع وطباعة الإيصال</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instant Printed Receipt Modal */}
      {showReceiptModal && lastReceiptData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141520] border border-[#2b2d42] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">تم تسجيل طلب البوفيه</h3>
              <p className="text-xs text-gray-400">إيصال مبيعات الكافتيريا</p>
            </div>

            <div className="bg-white text-black p-4 rounded-2xl text-right font-mono text-xs space-y-2 shadow-inner">
              <div className="text-center pb-2 border-b border-gray-300">
                <div className="font-black text-sm tracking-widest text-red-700">LIVERPOOL GAMING BAR</div>
                <div className="text-[10px] text-gray-600">فرع {lastReceiptData.branchName}</div>
                <div className="text-[10px] text-gray-500">{new Date(lastReceiptData.timestamp).toLocaleTimeString('ar-EG')}</div>
              </div>
              <div className="space-y-1 py-1">
                <div className="flex justify-between text-[11px] font-bold text-gray-700">
                  <span>العميل: {lastReceiptData.customerName}</span>
                  <span>{lastReceiptData.orderNumber}</span>
                </div>
                <div className="border-t border-dashed border-gray-300 my-1 pt-1">
                  {lastReceiptData.items.map((line: any) => (
                    <div key={line.item.id} className="flex justify-between py-0.5 text-[11px]">
                      <span>{line.item.name} × {line.quantity}</span>
                      <span className="font-bold">{line.item.sellingPrice * line.quantity} EGP</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t-2 border-black flex justify-between font-black text-sm">
                <span>الإجمالي ({lastReceiptData.paymentMethod}):</span>
                <span>{lastReceiptData.total} EGP</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-[#25283b] hover:bg-[#32364e] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141520] border border-[#2b2d42] rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-black text-white">إضافة صنف جديد للكافتيريا</h3>
            <form onSubmit={handleQuickAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اسم الصنف</label>
                <input
                  type="text"
                  required
                  value={quickName}
                  onChange={e => setQuickName(e.target.value)}
                  placeholder="مثال: ليمون نعناع فريش..."
                  className="w-full bg-[#1b1c28] border border-[#2b2d42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">سعر البيع للزبون (EGP)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quickPrice}
                    onChange={e => setQuickPrice(Number(e.target.value))}
                    className="w-full bg-[#1b1c28] border border-[#2b2d42] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">سعر التكلفة (للمالك فقط)</label>
                  <input
                    type="number"
                    min="0"
                    value={quickCost}
                    onChange={e => setQuickCost(Number(e.target.value))}
                    className="w-full bg-[#1b1c28] border border-[#2b2d42] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">الكمية بالمخزن</label>
                  <input
                    type="number"
                    min="0"
                    value={quickStock}
                    onChange={e => setQuickStock(Number(e.target.value))}
                    className="w-full bg-[#1b1c28] border border-[#2b2d42] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">التصنيف</label>
                  <select
                    value={quickCategory}
                    onChange={e => setQuickCategory(e.target.value as any)}
                    className="w-full bg-[#1b1c28] border border-[#2b2d42] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="hot_drinks">مشروبات ساخنة</option>
                    <option value="cold_drinks">مشروبات باردة</option>
                    <option value="food">مأكولات ونودلز</option>
                    <option value="snacks">سناكس وشيبسي</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="flex-1 py-2.5 bg-[#202232] text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
