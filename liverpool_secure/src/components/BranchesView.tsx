import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Branch } from '../types';
import {
  Building2,
  Calendar,
  Crown,
  Gamepad2,
  Users2,
  DollarSign,
  TrendingUp,
  Plus,
  Check
} from 'lucide-react';
import { ClubLogo } from './ClubLogo';
import { playClickSound } from '../utils/sound';

export const BranchesView: React.FC = () => {
  const {
    branches,
    activeBranch,
    setActiveBranchId,
    devices,
    sessions,
    safeTransactions,
    addBranch,
    ownerProfile,
    currentUser,
    setActiveView
  } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchNameAr, setNewBranchNameAr] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');

  // Calculate real metrics per branch
  const getBranchMetrics = (branchId: string) => {
    const branchDevs = devices.filter(d => d.branchId === branchId);
    const ps4Count = branchDevs.filter(d => d.type === 'PS4').length;
    const ps5Count = branchDevs.filter(d => d.type === 'PS5').length;
    const activeSessionsCount = sessions.filter(
      s => s.branchId === branchId && s.status === 'active'
    ).length;

    // Revenue today
    const branchTxs = safeTransactions.filter(t => t.branchId === branchId);
    const revenueToday = branchTxs
      .filter(t => t.type === 'gaming_revenue' || t.type === 'bar_revenue')
      .reduce((sum, t) => sum + t.amount, 0);

    // Occupancy level
    let occupancyLabel = 'منخفض';
    let occupancyDotClass = 'bg-emerald-500';
    if (branchDevs.length > 0) {
      const ratio = activeSessionsCount / branchDevs.length;
      if (ratio > 0.6) {
        occupancyLabel = 'مرتفع';
        occupancyDotClass = 'bg-red-500';
      } else if (ratio > 0.25) {
        occupancyLabel = 'متوسط';
        occupancyDotClass = 'bg-amber-500';
      }
    }

    return {
      ps4Count,
      ps5Count,
      totalDevices: branchDevs.length,
      activeSessionsCount,
      revenueToday,
      occupancyLabel,
      occupancyDotClass,
    };
  };

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchNameAr.trim()) return;
    addBranch({
      name: newBranchName.trim() || newBranchNameAr.trim(),
      nameAr: newBranchNameAr.trim(),
      code: newBranchCode.trim().toUpperCase() || 'BR',
      logo: '',
      address: newBranchAddress.trim() || 'فرع جديد',
      phone: newBranchPhone.trim() || '01000000000',
    });
    setShowAddModal(false);
    setNewBranchName('');
    setNewBranchNameAr('');
    setNewBranchCode('');
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Top Banner with Subscription and Renewal Date */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#14151e] border border-[#232535] p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 block font-medium">تاريخ التجديد القادم</span>
            <span className="text-sm font-mono font-bold text-gray-200">
              {ownerProfile?.renewalDate || '2025 / 07 / 15'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gradient-to-r from-red-600/20 to-red-800/20 border border-red-500/30 px-4 py-2 rounded-2xl text-red-400 text-xs font-bold">
            <Crown className="w-4 h-4 text-red-400" />
            <span>خطة الاشتراك: Multi-Branch - EGP 999/شهر</span>
          </div>
          {currentUser?.isOwner && (
            <button
              onClick={() => {
                playClickSound();
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/50"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة فرع جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Heading */}
      <div className="text-center md:text-right space-y-1">
        <div className="flex items-center justify-center md:justify-start gap-3">
          <h2 className="text-2xl font-black text-white">إدارة الفروع</h2>
          <Building2 className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-sm text-gray-400">اختر الفرع الذي ترغب في إدارته والاطلاع على إشغاله وإيراداته</p>
      </div>

      {/* Branch Cards Grid (Liverpool, Chelsea, Anfield) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map(branch => {
          const isSelected = branch.id === activeBranch?.id;
          const metrics = getBranchMetrics(branch.id);

          return (
            <div
              key={branch.id}
              className={`bg-[#14151e] rounded-3xl border-2 transition-all duration-200 p-6 flex flex-col justify-between relative overflow-hidden shadow-xl ${
                isSelected
                  ? 'border-red-600 shadow-red-950/40 ring-1 ring-red-500/30'
                  : 'border-[#232535] hover:border-[#35384e]'
              }`}
            >
              {/* Branch Crest Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="w-16 h-16 rounded-2xl bg-[#1b1c28] border border-[#2b2d3d] p-2 flex items-center justify-center shadow-inner">
                  <ClubLogo branchId={branch.id} size="md" />
                </div>
                <div className="text-right">
                  <h3 className="text-2xl font-black text-white">{branch.nameAr}</h3>
                  <span className="text-xs text-gray-400 font-mono font-bold tracking-widest">{branch.code}</span>
                </div>
              </div>

              {/* Metrics Table / Rows */}
              <div className="space-y-4 my-2 border-y border-[#202230] py-4">
                {/* Devices count */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-mono font-bold text-gray-200">
                    <span>PS4: {metrics.ps4Count}</span>
                    <span className="text-gray-500">|</span>
                    <span>PS5: {metrics.ps5Count}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <span>عدد الأجهزة</span>
                    <Gamepad2 className="w-4 h-4 text-gray-500" />
                  </div>
                </div>

                {/* Occupancy Status */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-bold">
                    <span className={`w-2.5 h-2.5 rounded-full ${metrics.occupancyDotClass}`}></span>
                    <span className="text-gray-200">{metrics.occupancyLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <span>حالة الإشغال الحالية</span>
                    <Users2 className="w-4 h-4 text-gray-500" />
                  </div>
                </div>

                {/* Revenue Today */}
                <div className="flex items-center justify-between text-sm">
                  <div className="font-bold text-emerald-400 font-mono text-base">
                    EGP {metrics.revenueToday.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <span>إيرادات اليوم</span>
                    <DollarSign className="w-4 h-4 text-gray-500" />
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="flex items-center justify-between text-sm">
                  <div className="font-bold text-white font-mono text-base">
                    {metrics.activeSessionsCount}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <span>الجلسات النشطة</span>
                    <TrendingUp className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </div>

              {/* Action Button: "اختر الفرع" */}
              <div className="mt-4 pt-2">
                <button
                  onClick={() => {
                    playClickSound();
                    setActiveBranchId(branch.id);
                    setActiveView('dashboard');
                  }}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm transition cursor-pointer flex items-center justify-center gap-2 ${
                    isSelected
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-950/60'
                      : 'bg-[#1b1c28] hover:bg-red-600/30 text-gray-300 hover:text-white border border-[#2b2d3d]'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                  <span>{isSelected ? 'الفرع المحدد حالياً' : 'اختر الفرع'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Branch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151621] border border-[#2c2f42] rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-red-500" />
              <span>إضافة فرع جديد</span>
            </h3>
            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اسم الفرع بالعربية</label>
                <input
                  type="text"
                  required
                  value={newBranchNameAr}
                  onChange={e => setNewBranchNameAr(e.target.value)}
                  placeholder="مثال: فرع الزمالك"
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">الاسم بالإنجليزية (اختياري)</label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  placeholder="مثال: Zamalek"
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">كود الفرع</label>
                  <input
                    type="text"
                    value={newBranchCode}
                    onChange={e => setNewBranchCode(e.target.value)}
                    placeholder="ZAM"
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={newBranchPhone}
                    onChange={e => setNewBranchPhone(e.target.value)}
                    placeholder="010..."
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">العنوان</label>
                <input
                  type="text"
                  value={newBranchAddress}
                  onChange={e => setNewBranchAddress(e.target.value)}
                  placeholder="شارع 26 يوليو..."
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm transition"
                >
                  حفظ الفرع
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-[#1f212f] text-gray-400 hover:text-white rounded-xl text-sm"
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
