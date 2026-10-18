import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { InventoryItem } from '../types';
import {
  Package,
  Plus,
  Coffee,
  AlertTriangle,
  ArrowRightLeft,
  Sparkles,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { playClickSound } from '../utils/sound';

export const InventoryView: React.FC = () => {
  const {
    inventory,
    addInventoryItem,
    updateInventoryItem,
    initializeDefaultCatalogueForBranch,
    activeBranch,
    currentUser
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'food' | 'hot_drinks' | 'cold_drinks' | 'snacks'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [restockItemId, setRestockItemId] = useState<string | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(10);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<InventoryItem['category']>('hot_drinks');
  const [sellingPrice, setSellingPrice] = useState<number>(15);
  const [costPrice, setCostPrice] = useState<number>(5);
  const [stockQuantity, setStockQuantity] = useState<number>(20);
  const [minStockThreshold, setMinStockThreshold] = useState<number>(10);

  const branchItems = inventory.filter(i => i.branchId === activeBranch?.id);
  const filteredItems = branchItems.filter(i => activeTab === 'all' || i.category === activeTab);
  const lowStockCount = branchItems.filter(i => i.stockQuantity <= i.minStockThreshold).length;

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { await addInventoryItem({
      branchId: activeBranch?.id || 'liverpool',
      name: name.trim(),
      category,
      sellingPrice: Number(sellingPrice),
      costPrice: Number(costPrice),
      stockQuantity: Number(stockQuantity),
      minStockThreshold: Number(minStockThreshold),
    }); } catch (error) { window.alert(error instanceof Error ? error.message : 'فشل حفظ الصنف على الخادم'); return; }
    setShowAddModal(false);
    setName('');
    playClickSound();
  };

  const handleRestock = async (itemId: string) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    try { await updateInventoryItem(itemId, { stockQuantity: item.stockQuantity + restockAmount }); }
    catch (error) { window.alert(error instanceof Error ? error.message : 'فشل تحديث المخزون على الخادم'); return; }
    setRestockItemId(null);
    playClickSound();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">إدارة المخزون والمشتريات</h1>
            <div className="w-8 h-8 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            متابعة أرصدة المأكولات والمشروبات، تنبيهات النواقص، وهوامش الربح
          </p>
        </div>

        <div className="flex items-center gap-3">
          {branchItems.length === 0 && (
            <button
              onClick={() => {
                playClickSound();
                initializeDefaultCatalogueForBranch(activeBranch?.id || 'liverpool');
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-950/60 flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>تهيئة القائمة الافتراضية للفرع</span>
            </button>
          )}

          <button
            onClick={() => {
              playClickSound();
              setShowAddModal(true);
            }}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-950/60 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صنف للمخزن</span>
          </button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex items-center gap-3 text-amber-200 text-xs shadow-md">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            تنبيه نقص المخزون: يوجد <b>{lowStockCount} أصناف</b> قاربت على النفاد في فرع {activeBranch?.nameAr}. يرجى التوريد فوراً.
          </span>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'كل الأصناف' },
          { id: 'food', label: 'مأكولات ونودلز' },
          { id: 'hot_drinks', label: 'مشروبات ساخنة' },
          { id: 'cold_drinks', label: 'مشروبات باردة' },
          { id: 'snacks', label: 'سناكس وشيبسي' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              playClickSound();
              setActiveTab(tab.id as any);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-[#161722] text-gray-400 hover:text-white border border-[#232535]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Inventory Items Grid */}
      {branchItems.length === 0 ? (
        <div className="p-12 text-center bg-[#13141d] border border-[#222436] rounded-3xl max-w-xl mx-auto my-8">
          <Coffee className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">المخزن فارغ حالياً</h3>
          <p className="text-xs text-gray-400 mb-6">
            يمكنك إدراج قائمة المنتجات الجاهزة لفرع {activeBranch?.nameAr} بضغطة زر واحدة.
          </p>
          <button
            onClick={() => initializeDefaultCatalogueForBranch(activeBranch?.id || 'liverpool')}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-950/60 cursor-pointer"
          >
            تهيئة المخزون تلقائياً
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map(item => {
            const isLow = item.stockQuantity <= item.minStockThreshold;
            const profit = item.sellingPrice - item.costPrice;

            return (
              <div
                key={item.id}
                className={`bg-[#14151e] border rounded-2xl p-4 flex flex-col justify-between transition-all shadow-md relative overflow-hidden ${
                  isLow ? 'border-amber-500/80 shadow-amber-950/20' : 'border-[#232535] hover:border-[#35384e]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400 bg-[#1b1c28] px-2 py-0.5 rounded-md">
                      {item.category === 'food'
                        ? 'مأكولات'
                        : item.category === 'hot_drinks'
                        ? 'ساخن'
                        : item.category === 'cold_drinks'
                        ? 'بارد'
                        : 'سناكس'}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                        isLow
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      المخزون: {item.stockQuantity}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white mb-2">{item.name}</h4>

                  <div className="space-y-1 text-xs border-t border-[#1e202d] pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">سعر البيع:</span>
                      <span className="font-bold text-white font-mono">{item.sellingPrice} EGP</span>
                    </div>

                    {/* Cost & Profit restricted to Owner */}
                    {currentUser?.isOwner && (
                      <>
                        <div className="flex items-center justify-between text-gray-400 text-[11px]">
                          <span>التكلفة (خاص بالمالك):</span>
                          <span className="font-mono text-gray-300">{item.costPrice} EGP</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px]">
                          <span>هامش الربح:</span>
                          <span className="font-mono">+{profit} EGP</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#1e202d]">
                  {restockItemId === item.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={restockAmount}
                        onChange={e => setRestockAmount(Number(e.target.value))}
                        className="w-16 bg-[#1b1c28] border border-[#2b2d42] rounded-lg px-2 py-1 text-xs font-mono text-white text-center"
                      />
                      <button
                        onClick={() => handleRestock(item.id)}
                        className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg cursor-pointer"
                      >
                        إضافة
                      </button>
                      <button
                        onClick={() => setRestockItemId(null)}
                        className="px-2 py-1 bg-[#202232] text-gray-400 text-xs rounded-lg cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setRestockItemId(item.id);
                        setRestockAmount(10);
                      }}
                      className="w-full py-1.5 bg-[#1b1c28] hover:bg-red-600 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>توريد وتزويد المخزون</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-red-500" />
              <span>إضافة صنف جديد للمخزون</span>
            </h3>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اسم الصنف</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: شاي بالنعناع..."
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">التصنيف</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="food">مأكولات ونودلز</option>
                  <option value="hot_drinks">مشروبات ساخنة</option>
                  <option value="cold_drinks">مشروبات باردة</option>
                  <option value="snacks">سناكس وشيبسي</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">سعر البيع (EGP)</label>
                  <input
                    type="number"
                    min="1"
                    value={sellingPrice}
                    onChange={e => setSellingPrice(Number(e.target.value))}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">سعر التكلفة (خاص بالمالك)</label>
                  <input
                    type="number"
                    min="0"
                    value={costPrice}
                    onChange={e => setCostPrice(Number(e.target.value))}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">الكمية الافتتاحية</label>
                  <input
                    type="number"
                    min="0"
                    value={stockQuantity}
                    onChange={e => setStockQuantity(Number(e.target.value))}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">حد إعادة الطلب (نقص)</label>
                  <input
                    type="number"
                    min="1"
                    value={minStockThreshold}
                    onChange={e => setMinStockThreshold(Number(e.target.value))}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  حفظ الصنف
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
