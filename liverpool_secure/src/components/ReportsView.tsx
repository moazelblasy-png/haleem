import React, { useEffect, useState } from 'react';
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

type SessionInvoiceReport = {
  id: string;
  session_id: string;
  branch_id: string;
  session_number: string;
  customer_name: string;
  customer_phone?: string | null;
  gaming_total: number;
  products_total: number;
  billable_products_total: number;
  discount_type: 'none' | 'fixed' | 'percent';
  discount_value: number;
  discount_amount: number;
  grand_total: number;
  prepaid_amount: number;
  collected_amount: number;
  remaining_debt: number;
  payment_method: string;
  created_at: string;
};

type SessionDebtPaymentReport = {
  id: string;
  session_id: string;
  branch_id: string;
  amount: number;
  payment_method: string;
  received_by: string;
  created_at: string;
};

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

  const [activeTab, setActiveTab] = useState<'devices' | 'branches' | 'audit' | 'finance'>('devices');
  const [sessionInvoices, setSessionInvoices] = useState<SessionInvoiceReport[]>([]);
  const [sessionDebtPayments, setSessionDebtPayments] = useState<SessionDebtPaymentReport[]>([]);
  const [financeReportLoading, setFinanceReportLoading] = useState(false);
  const [financeReportError, setFinanceReportError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadFinancialReports = async () => {
      if (!currentUser || !['owner', 'admin', 'supervisor'].includes(currentUser.role)) {
        setSessionInvoices([]);
        setSessionDebtPayments([]);
        setFinanceReportError('التقرير المالي السحابي متاح للمالك والإدارة والمشرف فقط.');
        return;
      }
      let accessToken: string | null = null;
      try {
        const ownSession = JSON.parse(localStorage.getItem('lg_supabase_session') || 'null');
        if (typeof ownSession?.access_token === 'string' && ownSession.user?.id === currentUser.id) {
          accessToken = ownSession.access_token;
        }
        if (!accessToken) {
          for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
            const value = JSON.parse(localStorage.getItem(key) || '{}');
            const session = value?.currentSession || value?.session || value;
            if (typeof session?.access_token === 'string' && session.user?.id === currentUser.id) {
              accessToken = session.access_token;
              break;
            }
          }
        }
      } catch {
        accessToken = null;
      }
      if (!accessToken) {
        setSessionInvoices([]);
        setSessionDebtPayments([]);
        setFinanceReportError('سجّل الدخول بالحساب السحابي لإظهار التقرير المالي المؤكد من الخادم.');
        return;
      }

      setFinanceReportLoading(true);
      setFinanceReportError('');
      try {
        const params = new URLSearchParams();
        if (activeBranch?.id) params.set('branchId', activeBranch.id);
        const headers = { Accept: 'application/json', Authorization: `Bearer ${accessToken}` };
        const [invoiceResponse, debtResponse] = await Promise.all([
          fetch(`/api/finance/session-invoices?${params.toString()}`, { headers, cache: 'no-store' }),
          fetch(`/api/finance/session-debt-payments?${params.toString()}`, { headers, cache: 'no-store' }),
        ]);
        const [invoicePayload, debtPayload] = await Promise.all([
          invoiceResponse.json().catch(() => ({})),
          debtResponse.json().catch(() => ({})),
        ]);
        if (!invoiceResponse.ok || invoicePayload.ok !== true) {
          throw new Error(invoicePayload?.error?.message || 'تعذر تحميل فواتير الجلسات من الخادم.');
        }
        if (!debtResponse.ok || debtPayload.ok !== true) {
          throw new Error(debtPayload?.error?.message || 'تعذر تحميل سجل تحصيل المديونيات من الخادم.');
        }
        if (cancelled) return;
        setSessionInvoices(Array.isArray(invoicePayload.invoices) ? invoicePayload.invoices : []);
        setSessionDebtPayments(Array.isArray(debtPayload.payments) ? debtPayload.payments : []);
      } catch (error) {
        if (!cancelled) {
          setSessionInvoices([]);
          setSessionDebtPayments([]);
          setFinanceReportError(error instanceof Error ? error.message : 'تعذر تحميل التقارير المالية.');
        }
      } finally {
        if (!cancelled) setFinanceReportLoading(false);
      }
    };
    void loadFinancialReports();
    return () => { cancelled = true; };
  }, [currentUser, activeBranch?.id]);

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
          { id: 'finance', label: 'الفواتير والمديونيات السحابية' },
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

      {activeTab === 'finance' && (
        <div className="space-y-6">
          <section className="bg-[#14151e] border border-[#232535] rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 bg-[#171824] border-b border-[#202232] flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">فواتير جلسات اللعب المسجلة على الخادم</h3>
                <p className="text-xs text-gray-400 mt-1">يعرض هذا التقرير الفواتير المؤكدة في قاعدة البيانات، وليس مجرد الحالة المحلية للمتصفح.</p>
              </div>
              <button onClick={() => { playClickSound(); setActiveTab('finance'); }} className="text-xs text-red-300 font-bold">تحديث عند إعادة فتح التقرير</button>
            </div>
            {financeReportLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">جارٍ تحميل الفواتير والمديونيات...</div>
            ) : financeReportError ? (
              <div className="p-6 text-sm text-amber-200">{financeReportError}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs min-w-[1050px]">
                  <thead><tr className="border-b border-[#202232] text-gray-400">
                    <th className="p-3">التاريخ</th><th className="p-3">رقم الجلسة</th><th className="p-3">العميل</th>
                    <th className="p-3 text-left">الألعاب</th><th className="p-3 text-left">المنتجات</th><th className="p-3 text-left">الخصم</th>
                    <th className="p-3 text-left">الإجمالي</th><th className="p-3 text-left">المحصّل</th><th className="p-3 text-left">المتبقي</th><th className="p-3">الدفع</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#1b1c28]">
                    {sessionInvoices.length === 0 ? (
                      <tr><td colSpan={10} className="p-8 text-center text-gray-500">لا توجد فواتير جلسات مسجلة في الفترة المتاحة.</td></tr>
                    ) : sessionInvoices.map(invoice => (
                      <tr key={invoice.id} className="text-gray-200 hover:bg-[#181926]">
                        <td className="p-3 whitespace-nowrap">{new Date(invoice.created_at).toLocaleString('ar-EG')}</td>
                        <td className="p-3 font-mono">{invoice.session_number}</td>
                        <td className="p-3">{invoice.customer_name}</td>
                        <td className="p-3 text-left font-mono">{invoice.gaming_total.toFixed(2)}</td>
                        <td className="p-3 text-left font-mono">{invoice.billable_products_total.toFixed(2)}</td>
                        <td className="p-3 text-left font-mono">{invoice.discount_amount.toFixed(2)}</td>
                        <td className="p-3 text-left font-mono font-bold">{invoice.grand_total.toFixed(2)}</td>
                        <td className="p-3 text-left font-mono text-emerald-300">{invoice.collected_amount.toFixed(2)}</td>
                        <td className={`p-3 text-left font-mono ${invoice.remaining_debt > 0 ? 'text-amber-300 font-bold' : 'text-gray-400'}`}>{invoice.remaining_debt.toFixed(2)}</td>
                        <td className="p-3">{invoice.payment_method === 'split' ? 'متعدد' : invoice.payment_method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="bg-[#14151e] border border-[#232535] rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 bg-[#171824] border-b border-[#202232]">
              <h3 className="text-sm font-bold text-white">سجل تحصيل المديونيات</h3>
              <p className="text-xs text-gray-400 mt-1">كل دفعة مسجلة بمعرّف مستقل لمنع تكرار التحصيل.</p>
            </div>
            {financeReportLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">جارٍ تحميل سجل التحصيل...</div>
            ) : financeReportError ? (
              <div className="p-6 text-sm text-amber-200">{financeReportError}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs min-w-[700px]">
                  <thead><tr className="border-b border-[#202232] text-gray-400">
                    <th className="p-3">التاريخ</th><th className="p-3">معرّف الجلسة</th><th className="p-3">المبلغ</th><th className="p-3">طريقة الدفع</th><th className="p-3">المستخدم</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#1b1c28]">
                    {sessionDebtPayments.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا توجد دفعات مديونية مسجلة.</td></tr>
                    ) : sessionDebtPayments.map(payment => (
                      <tr key={payment.id} className="text-gray-200 hover:bg-[#181926]">
                        <td className="p-3 whitespace-nowrap">{new Date(payment.created_at).toLocaleString('ar-EG')}</td>
                        <td className="p-3 font-mono">{payment.session_id}</td>
                        <td className="p-3 font-mono text-emerald-300">{payment.amount.toFixed(2)} EGP</td>
                        <td className="p-3">{payment.payment_method}</td>
                        <td className="p-3 font-mono">{payment.received_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

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
