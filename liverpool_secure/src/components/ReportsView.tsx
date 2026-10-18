import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  BarChart3,
  TrendingUp,
  Building2,
  Tv,
  Users,
  DollarSign,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  Download,
  Printer
} from 'lucide-react';
import { playClickSound } from '../utils/sound';

export const ReportsView: React.FC = () => {
  const {
    devices,
    sessions,
    safeTransactions,
    branches,
    activeBranch,
    currentUser,
    auditLog,
    shifts
  } = useApp();

  const [activeTab, setActiveTab] = useState<'devices' | 'branches' | 'audit'>('devices');

  // Device analytics
  const deviceStats = devices.map(dev => {
    const devSessions = sessions.filter(s => s.deviceId === dev.id);
    const sessionsCount = devSessions.length;
    const totalRevenue = devSessions.reduce((sum, s) => sum + (s.finalGrandTotal || s.paidAmount || 0), 0);
    const totalMinutes = devSessions.reduce((sum, s) => {
      const segMins = s.segments.reduce((m, seg) => {
        const end = seg.endTime || Date.now();
        return m + Math.max(0, (end - seg.startTime) / (1000 * 60));
      }, 0);
      return sum + segMins;
    }, 0);
    const operationalHours = (totalMinutes / 60).toFixed(1);

    return {
      id: dev.id,
      name: dev.name,
      screenNumber: dev.screenNumber,
      type: dev.type,
      branchId: dev.branchId,
      sessionsCount,
      totalRevenue,
      operationalHours,
    };
  });

  // Branch comparisons (Liverpool, Chelsea, Anfield)
  const branchComparisons = branches.map(b => {
    const branchDevs = devices.filter(d => d.branchId === b.id);
    const branchSessions = sessions.filter(s => s.branchId === b.id);
    const branchTxs = safeTransactions.filter(t => t.branchId === b.id);

    const revenue = branchTxs
      .filter(t => t.type === 'gaming_revenue' || t.type === 'bar_revenue')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = branchTxs
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netProfit = revenue - expenses;

    return {
      id: b.id,
      nameAr: b.nameAr,
      code: b.code,
      devicesCount: branchDevs.length,
      sessionsCount: branchSessions.length,
      revenue,
      expenses,
      netProfit,
    };
  });

  const handlePrintOrPDF = () => {
    playClickSound();
    window.print();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">التقارير وتحليلات الأداء والطباعة</h1>
            <div className="w-8 h-8 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            إحصائيات إشغال الأجهزة، مقارنة أداء الفروع، وسجل العمليات المحصن (Audit Log)
          </p>
        </div>

        <button
          onClick={handlePrintOrPDF}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 self-start cursor-pointer shadow-lg shadow-red-950/60"
        >
          <Printer className="w-4 h-4" />
          <span>تصدير / طباعة التقرير PDF</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'devices', label: 'تقارير الأجهزة والتشغيل' },
          { id: 'branches', label: 'مقارنة الفروع (ليفربول / تشيلسي / أنفيلد)' },
          { id: 'audit', label: 'سجل العمليات الإداري (Audit Log)' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              playClickSound();
              setActiveTab(tab.id as any);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === tab.id
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-[#161722] text-gray-400 hover:text-white border border-[#232535]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Device Reports */}
      {activeTab === 'devices' && (
        <div className="bg-[#14151e] border border-[#232535] rounded-3xl overflow-hidden shadow-xl">
          <div className="p-4 bg-[#171824] border-b border-[#202232] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Tv className="w-4 h-4 text-red-500" />
              <span>إنتاجية وساعات تشغيل شاشات PlayStation</span>
            </h3>
            <span className="text-xs text-gray-400">
              إحصائيات حية لجميع أجهزة PS4 و PS5
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#202232] text-gray-400">
                  <th className="py-3 px-4 font-bold">الشاشة</th>
                  <th className="py-3 px-4 font-bold">النوع</th>
                  <th className="py-3 px-4 font-bold text-center">عدد الجلسات</th>
                  <th className="py-3 px-4 font-bold text-center">ساعات التشغيل</th>
                  <th className="py-3 px-4 font-bold text-center">إجمالي الإيراد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b1c28]">
                {deviceStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-500 text-xs">
                      لا توجد بيانات تشغيل مسجلة حتى الآن.
                    </td>
                  </tr>
                ) : (
                  deviceStats.map(stat => (
                    <tr key={stat.id} className="hover:bg-[#181926] text-gray-200">
                      <td className="py-3.5 px-4 font-bold text-white">{stat.screenNumber}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-red-400">{stat.type}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold">{stat.sessionsCount}</td>
                      <td className="py-3.5 px-4 text-center font-mono">{stat.operationalHours} ساعة</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">
                        {stat.totalRevenue.toFixed(2)} EGP
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Branch Comparisons (Liverpool vs Chelsea vs Anfield) */}
      {activeTab === 'branches' && (
        <div className="bg-[#14151e] border border-[#232535] rounded-3xl overflow-hidden shadow-xl">
          <div className="p-4 bg-[#171824] border-b border-[#202232]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-red-500" />
              <span>مقارنة الفروع الثلاثة (Liverpool vs Chelsea vs Anfield)</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#202232] text-gray-400">
                  <th className="py-3 px-4 font-bold">الفرع</th>
                  <th className="py-3 px-4 font-bold text-center">الأجهزة</th>
                  <th className="py-3 px-4 font-bold text-center">الجلسات</th>
                  <th className="py-3 px-4 font-bold text-center">الإيرادات</th>
                  <th className="py-3 px-4 font-bold text-center">المصروفات</th>
                  <th className="py-3 px-4 font-bold text-center">صافي الأرباح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b1c28]">
                {branchComparisons.map(b => (
                  <tr key={b.id} className="hover:bg-[#181926] text-gray-200">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span>{b.nameAr}</span>
                      <span className="text-[10px] text-gray-400 font-mono font-bold">({b.code})</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold">{b.devicesCount}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold">{b.sessionsCount}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">
                      {b.revenue.toFixed(2)} EGP
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-400">
                      {b.expenses.toFixed(2)} EGP
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                      {b.netProfit.toFixed(2)} EGP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Immutable Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#202232]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-500" />
              <span>سجل العمليات المحصن (Audit Log)</span>
            </h3>
            <span className="text-xs text-gray-400">سجل غير قابل للتعديل للحركات المالية وتغيير كلمات السر</span>
          </div>

          {auditLog.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-xs">
              لا توجد سجلات في سجل العمليات حتى الآن.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLog.map(entry => (
                <div
                  key={entry.id}
                  className="p-3 bg-[#181926] border border-[#242638] rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-red-400">{entry.userName}</span>: {entry.description}
                    {entry.deviceOrSessionRef && (
                      <span className="text-gray-400 block font-mono text-[10px] mt-0.5">
                        مرجع: {entry.deviceOrSessionRef}
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
      )}
    </div>
  );
};
