import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Employee, RolePermissions } from '../types';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  Plus,
  ShieldCheck,
  Sun,
  Moon,
  MoreVertical,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Key,
  FileText,
  MinusCircle,
  HelpCircle,
  Lock,
  Download,
  LogIn,
  LogOut
} from 'lucide-react';
import { playClickSound } from '../utils/sound';
import { exportPayrollReportPDF } from '../utils/pdfExport';
import { localDateKey } from '../utils/runtime';

export const EmployeesView: React.FC = () => {
  const {
    employees,
    addEmployee,
    updateEmployee,
    updateEmployeePassword,
    addEmployeeDeduction,
    requestLeave,
    reviewLeaveRequest,
    rolePermissions,
    updateRolePermissions,
    branches,
    activeBranch,
    currentUser,
    requestOvertime,
    reviewOvertimeRequest,
    transferEmployeeBranch,
    clockInEmployee,
    clockOutEmployee
  } = useApp();

  const [activeTab, setActiveTab] = useState<'employees_list' | 'overtime_and_leaves' | 'my_portal'>(
    currentUser?.isOwner ? 'employees_list' : 'my_portal'
  );

  const [filterBranch, setFilterBranch] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showBranchTransferModal, setShowBranchTransferModal] = useState(false);
  const [targetBranchForTransfer, setTargetBranchForTransfer] = useState('');
  const [transferMessage, setTransferMessage] = useState('');

  // Password edit state
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Deduction state
  const [deductionAmount, setDeductionAmount] = useState(100);
  const [deductionReason, setDeductionReason] = useState('تأخير أو مخالفة سياسة العمل');

  // Leave request state
  const [leaveDays, setLeaveDays] = useState(2);
  const [leaveReason, setLeaveReason] = useState('ظرف عائلي طارئ');

  // Overtime state
  const [selectedEmpForOvertime, setSelectedEmpForOvertime] = useState<string>('');
  const [overtimeHours, setOvertimeHours] = useState(2);
  const [overtimeRate, setOvertimeRate] = useState(50);
  const [overtimeReason, setOvertimeReason] = useState('تغطية ساعات ذروة المساء');

  // New Employee state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [empPin, setEmpPin] = useState('1234');
  const [role, setRole] = useState<'cashier' | 'supervisor' | 'technician'>('cashier');
  const [branchId, setBranchId] = useState(activeBranch?.id || 'liverpool');
  const [shiftType, setShiftType] = useState<'morning' | 'night'>('morning');
  const [salaryMonthly, setSalaryMonthly] = useState(6000);
  const [dailyRate, setDailyRate] = useState(200);

  const isOwner = Boolean(currentUser?.isOwner);

  // Filter employees
  const filteredEmployees = employees.filter(e => {
    if (filterBranch === 'all') return true;
    return e.branchId === filterBranch;
  });

  // Dynamic counts
  const totalEmployeesCount = employees.length;
  const todayKey = localDateKey();
  const activeNowCount = employees.filter(e => {
    const todayLog = e.attendanceLogs.find(log => log.date === todayKey);
    return Boolean(todayLog && !todayLog.clockOut);
  }).length;
  const onLeaveCount = employees.filter(e => e.status === 'on_leave').length;
  const pendingCount = employees.filter(e =>
    e.overtimeRequests.some(r => r.status === 'pending') ||
    (e.leaveRequests || []).some(l => l.status === 'pending')
  ).length;

  const currentLoggedInEmp = employees.find(e => e.id === currentUser?.id || e.phone === currentUser?.phone);

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    addEmployee({
      name: name.trim(),
      phone: phone.trim(),
      pinOrPassword: empPin.trim() || '1234',
      role,
      branchId,
      shiftType,
      salaryMonthly: Number(salaryMonthly),
      dailyRate: Number(dailyRate),
      status: 'active',
    });
    setShowAddModal(false);
    setName('');
    setPhone('');
    setEmpPin('1234');
  };

  const handleUpdatePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployeeId || !newPasswordInput.trim()) return;
    updateEmployeePassword(targetEmployeeId, newPasswordInput.trim());
    setShowPasswordModal(false);
    setNewPasswordInput('');
  };

  const handleAddDeductionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployeeId || deductionAmount <= 0) return;
    addEmployeeDeduction(targetEmployeeId, deductionAmount, deductionReason.trim());
    setShowDeductionModal(false);
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const empId = currentLoggedInEmp?.id || targetEmployeeId;
    if (!empId) return;
    requestLeave(empId, leaveDays, leaveReason.trim());
    setShowLeaveModal(false);
  };

  const handleTogglePermission = (role: 'cashier' | 'supervisor' | 'technician', key: keyof RolePermissions) => {
    if (!isOwner) return;
    const current = rolePermissions[role];
    updateRolePermissions(role, {
      ...current,
      [key]: !current[key],
    });
  };

  const handleAddOvertimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForOvertime) return;
    requestOvertime(selectedEmpForOvertime, overtimeHours, overtimeRate, overtimeReason);
    setShowOvertimeModal(false);
  };

  const handleEmployeeBranchTransfer = () => {
    if (!targetEmployeeId || !targetBranchForTransfer) return;
    const result = transferEmployeeBranch(targetEmployeeId, targetBranchForTransfer);
    setTransferMessage(result.message);
    if (result.success) {
      setTimeout(() => {
        setShowBranchTransferModal(false);
        setTransferMessage('');
      }, 900);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Top Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">الموظفون والحضور والانصراف</h1>
            <div className="w-8 h-8 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            متابعة وقت الوصول والمغادرة لكل موظف مع إدارة الصلاحيات والبيانات المالية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Navigation Tabs */}
          {isOwner && (
            <button
              onClick={() => {
                playClickSound();
                setActiveTab('employees_list');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'employees_list'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-[#181926] text-gray-300 hover:bg-[#202235]'
              }`}
            >
              قائمة الموظفين
            </button>
          )}

          <button
            onClick={() => {
              playClickSound();
              setActiveTab('my_portal');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'my_portal'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-[#181926] text-gray-300 hover:bg-[#202235]'
            }`}
          >
            {isOwner ? 'معاينة بوابة الموظف' : 'بيانات راتبي وأجازاتي'}
          </button>

          {isOwner && (
            <>
              <button
                onClick={() => exportPayrollReportPDF(employees, activeBranch?.nameAr || 'الفرع')}
                className="px-3.5 py-2 bg-[#1b1c28] hover:bg-[#25283b] text-gray-200 border border-[#2b2d42] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="تصدير كشف الرواتب PDF"
              >
                <Download className="w-3.5 h-3.5 text-red-400" />
                <span>كشف الرواتب PDF</span>
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  setShowOvertimeModal(true);
                }}
                className="px-3.5 py-2 bg-[#1b1c28] hover:bg-[#25283b] text-gray-200 border border-[#2b2d42] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>تسجيل عمل إضافي</span>
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-950/60 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة موظف</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4 Stats Cards (Matching screenshot b0219b88ed0909c7ca2b093daf01ea9b) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-3xl font-black text-white font-mono">{totalEmployeesCount}</span>
            <span className="text-xs text-gray-400 block mt-1">إجمالي الموظفين</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Active Now */}
        <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-white font-mono">{activeNowCount}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <span className="text-xs text-gray-400 block mt-1">نشط الآن بالعمل</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* On Leave */}
        <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-3xl font-black text-white font-mono">{onLeaveCount}</span>
            <span className="text-xs text-gray-400 block mt-1">في إجازة حالياً</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-3xl font-black text-white font-mono">{pendingCount}</span>
            <span className="text-xs text-gray-400 block mt-1">طلبات قيد الموافقة</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: EMPLOYEE PERSONAL PORTAL (User requirement: employees only see their own data) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'my_portal' && (
        <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#202232]">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-red-500" />
                <span>بوابة بيانات الموظف الشخصية</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                تصفح الراتب، الأوفر تايم المعتمد، الخصومات المسجلة، وتقديم طلبات الإجازات مباشرة.
              </p>
            </div>
            <button
              onClick={() => {
                if (currentLoggedInEmp) setTargetEmployeeId(currentLoggedInEmp.id);
                setShowLeaveModal(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4" />
              <span>+ تقديم طلب إجازة</span>
            </button>
          </div>

          {currentLoggedInEmp ? (
            <div className="space-y-6">
              {/* Employee Summary Card */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#171825] p-5 rounded-2xl border border-[#25283c]">
                <div>
                  <span className="text-[11px] text-gray-400 block font-medium">اسم الموظف</span>
                  <span className="text-base font-black text-white block mt-0.5">{currentLoggedInEmp.name}</span>
                  <span className="text-[10px] text-red-400 font-bold block">{currentLoggedInEmp.role}</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block font-medium">الراتب الأساسي</span>
                  <span className="text-xl font-mono font-black text-emerald-400 block mt-0.5">
                    {currentLoggedInEmp.salaryMonthly} EGP
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">يومي: {currentLoggedInEmp.dailyRate} EGP</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block font-medium">الأوفر تايم المعتمد</span>
                  <span className="text-xl font-mono font-black text-amber-400 block mt-0.5">
                    +{currentLoggedInEmp.overtimeRequests
                      .filter(r => r.status === 'approved')
                      .reduce((sum, r) => sum + (r.hours * r.hourlyRate), 0)} EGP
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block font-medium">إجمالي الخصومات</span>
                  <span className="text-xl font-mono font-black text-red-400 block mt-0.5">
                    -{(currentLoggedInEmp.deductions || []).reduce((sum, d) => sum + d.amount, 0)} EGP
                  </span>
                </div>
              </div>

              {/* Deductions & Overtime Detailed List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Overtime List */}
                <div className="p-4 bg-[#181926] border border-[#25283b] rounded-2xl space-y-3">
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>سجل ساعات العمل الإضافية (Overtime):</span>
                  </h4>
                  {currentLoggedInEmp.overtimeRequests.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-xs">لا يوجد أوفر تايم مسجل حتى الآن</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {currentLoggedInEmp.overtimeRequests.map(r => (
                        <div key={r.id} className="p-2.5 bg-[#141520] rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-white">{r.hours} ساعات</span> • {r.reason}
                            <span className="text-[10px] text-gray-500 block font-mono">{r.date}</span>
                          </div>
                          <div className="text-left">
                            <span className="font-mono font-bold text-amber-400">+{r.hours * r.hourlyRate} EGP</span>
                            <span className={`block text-[10px] font-bold ${r.status === 'approved' ? 'text-emerald-400' : 'text-gray-400'}`}>
                              {r.status === 'approved' ? 'معتمد' : r.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Deductions List */}
                <div className="p-4 bg-[#181926] border border-[#25283b] rounded-2xl space-y-3">
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <MinusCircle className="w-4 h-4 text-red-400" />
                    <span>سجل الخصومات (الجزاءات):</span>
                  </h4>
                  {(currentLoggedInEmp.deductions || []).length === 0 ? (
                    <div className="py-6 text-center text-emerald-400 text-xs font-bold">
                      سجلك ممتاز! لا توجد أي خصومات مسجلة عليك.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(currentLoggedInEmp.deductions || []).map(d => (
                        <div key={d.id} className="p-2.5 bg-[#141520] rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-white">{d.reason}</span>
                            <span className="text-[10px] text-gray-500 block font-mono">{d.date}</span>
                          </div>
                          <span className="font-mono font-bold text-red-400">-{d.amount} EGP</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Leave Requests */}
              <div className="p-4 bg-[#181926] border border-[#25283b] rounded-2xl space-y-3">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>طلبات الإجازات المقدمة:</span>
                </h4>
                {(currentLoggedInEmp.leaveRequests || []).length === 0 ? (
                  <div className="py-4 text-center text-gray-500 text-xs">لم تقم بتقديم أي طلبات إجازة حتى الآن</div>
                ) : (
                  <div className="space-y-2">
                    {(currentLoggedInEmp.leaveRequests || []).map(l => (
                      <div key={l.id} className="p-2.5 bg-[#141520] rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-white">{l.daysCount} أيام إجازة</span> • {l.reason}
                          <span className="text-[10px] text-gray-500 block font-mono">{l.date}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          l.status === 'approved'
                            ? 'bg-emerald-950 text-emerald-300'
                            : l.status === 'rejected'
                            ? 'bg-red-950 text-red-300'
                            : 'bg-amber-950 text-amber-300'
                        }`}>
                          {l.status === 'approved' ? 'تمت الموافقة' : l.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-gray-400 text-sm">
              أنت مسجل حالياً كـ <b>المالك (Owner)</b> بكامل الصلاحيات. يمكنك الاطلاع على بيانات أي موظف من قائمة الموظفين وتعديل كلمات المرور والخصومات.
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: OWNER EMPLOYEES LIST & PASSWORD / DEDUCTION CONTROLS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'employees_list' && isOwner && (
        <div className="space-y-6">
          {/* Filter Row */}
          <div className="flex items-center justify-between bg-[#14151e] border border-[#232535] p-3 rounded-2xl shadow">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>تصفية حسب الفرع:</span>
              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                className="bg-[#1b1c28] border border-[#2b2d42] text-xs text-white rounded-xl px-3 py-1.5 font-bold"
              >
                <option value="all">كل الفروع</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.nameAr}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-gray-500 font-mono">
              عرض {filteredEmployees.length} من {employees.length} موظف
            </span>
          </div>

          {/* Employees Table (Exact columns matching screenshot b0219b88ed0909c7ca2b093daf01ea9b) */}
          <div className="bg-[#14151e] border border-[#232535] rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#202232] text-gray-400 bg-[#171824]">
                    <th className="py-4 px-4 font-bold">الاسم</th>
                    <th className="py-4 px-4 font-bold">الدور الوظيفي</th>
                    <th className="py-4 px-4 font-bold">الفرع</th>
                    <th className="py-4 px-4 font-bold">رقم الهاتف</th>
                    <th className="py-4 px-4 font-bold text-center">الوردية</th>
                    <th className="py-4 px-4 font-bold text-center">الوصول / المغادرة</th>
                    <th className="py-4 px-4 font-bold text-center">الراتب (ج.م)</th>
                    <th className="py-4 px-4 font-bold text-center">الحالة</th>
                    <th className="py-4 px-4 font-bold text-center">تحكم المالك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b1c28]">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-500 text-xs">
                        لا يوجد موظفين مسجلين حالياً. اضغط على "+ إضافة موظف" لإنشاء أول موظف وتعيين كلمة سره.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map(emp => {
                      const branchObj = branches.find(b => b.id === emp.branchId);
                      const todayLog = emp.attendanceLogs.find(log => log.date === todayKey);
                      const timeLabel = (timestamp?: number) => timestamp
                        ? new Date(timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                        : '—';
                      const roleLabel =
                        emp.role === 'cashier'
                          ? 'كاشير'
                          : emp.role === 'supervisor'
                          ? 'مشرف'
                          : 'فني أجهزة';

                      return (
                        <tr key={emp.id} className="hover:bg-[#181926] text-gray-200 transition">
                          <td className="py-3.5 px-4 font-bold text-white">{emp.name}</td>
                          <td className="py-3.5 px-4 text-gray-300">{roleLabel}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-red-400">{branchObj?.nameAr || 'غير محدد'}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-gray-400">{emp.phone}</td>
                          <td className="py-3.5 px-4 text-center">
                            {emp.shiftType === 'morning' ? (
                              <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                                <Sun className="w-3.5 h-3.5" /> صباحية
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-blue-400 font-bold">
                                <Moon className="w-3.5 h-3.5" /> ليلية
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center min-w-[190px]">
                            <div className="text-[10px] font-mono text-gray-300 whitespace-nowrap">
                              <span className="text-emerald-400">دخول {timeLabel(todayLog?.clockIn)}</span>
                              <span className="text-gray-500 mx-1">•</span>
                              <span className="text-amber-300">خروج {timeLabel(todayLog?.clockOut)}</span>
                            </div>
                            <div className="flex items-center justify-center gap-1 mt-1.5">
                              <button
                                onClick={() => clockInEmployee(emp.id)}
                                disabled={Boolean(todayLog && !todayLog.clockOut)}
                                className="px-2 py-1 rounded-lg bg-emerald-950/50 text-emerald-300 text-[10px] font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                                title="تسجيل وقت الوصول"
                              >
                                <LogIn className="w-3 h-3" /> دخول
                              </button>
                              <button
                                onClick={() => clockOutEmployee(emp.id)}
                                disabled={!todayLog || Boolean(todayLog.clockOut)}
                                className="px-2 py-1 rounded-lg bg-amber-950/50 text-amber-300 text-[10px] font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                                title="تسجيل وقت المغادرة"
                              >
                                <LogOut className="w-3 h-3" /> خروج
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                            {emp.salaryMonthly.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                                emp.status === 'active'
                                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                                  : emp.status === 'on_leave'
                                  ? 'bg-blue-950/60 text-blue-400 border border-blue-500/30'
                                  : 'bg-gray-800 text-gray-400'
                              }`}
                            >
                              {emp.status === 'active' ? 'نشط' : emp.status === 'on_leave' ? 'في إجازة' : 'غير نشط'}
                            </span>
                          </td>

                          {/* Owner Action Buttons: Password, Branch Transfer & Deduction */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Change Password */}
                              <button
                                onClick={() => {
                                  setTargetEmployeeId(emp.id);
                                  setNewPasswordInput(emp.pinOrPassword || '');
                                  setShowPasswordModal(true);
                                }}
                                className="px-2 py-1 rounded-lg bg-[#202235] hover:bg-red-600 hover:text-white text-gray-300 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="تغيير كلمة المرور / PIN"
                              >
                                <Key className="w-3 h-3 text-amber-400" />
                                <span>باسورد</span>
                              </button>

                              {/* Apply Deduction */}
                              <button
                                onClick={() => {
                                  setTargetEmployeeId(emp.id);
                                  setShowDeductionModal(true);
                                }}
                                className="px-2 py-1 rounded-lg bg-[#202235] hover:bg-red-950 text-red-300 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="تطبيق خصم مالي"
                              >
                                <MinusCircle className="w-3 h-3 text-red-500" />
                                <span>خصم</span>
                              </button>

                              <button
                                onClick={() => {
                                  setTargetEmployeeId(emp.id);
                                  setTargetBranchForTransfer(emp.branchId);
                                  setTransferMessage('');
                                  setShowBranchTransferModal(true);
                                }}
                                className="px-2 py-1 rounded-lg bg-[#202235] hover:bg-blue-600 hover:text-white text-gray-300 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="نقل الموظف إلى فرع آخر"
                              >
                                <Users className="w-3 h-3 text-blue-400" />
                                <span>نقل فرع</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Overtime & Leaves Approvals Panel */}
          {employees.some(e => e.overtimeRequests.length > 0 || (e.leaveRequests || []).length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Overtime Approvals */}
              <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-5 shadow-xl space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>طلبات العمل الإضافي (الأوفر تايم)</span>
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {employees.flatMap(e =>
                    e.overtimeRequests.map(req => ({ ...req, employeeName: e.name, empId: e.id }))
                  ).map(req => (
                    <div
                      key={req.id}
                      className="p-3 bg-[#181926] border border-[#242638] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{req.employeeName}</span>: {req.hours} ساعات (@ {req.hourlyRate} ج.م/س)
                        <div className="text-[10px] text-gray-400 mt-0.5">سبب: {req.reason}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => reviewOvertimeRequest(req.empId, req.id, true)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              موافقة
                            </button>
                            <button
                              onClick={() => reviewOvertimeRequest(req.empId, req.id, false)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              رفض
                            </button>
                          </>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${req.status === 'approved' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
                            {req.status === 'approved' ? 'تم القبول' : 'مرفوض'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leave Requests Approvals */}
              <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-5 shadow-xl space-y-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>طلبات الإجازات للمراجعة</span>
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {employees.flatMap(e =>
                    (e.leaveRequests || []).map(l => ({ ...l, employeeName: e.name, empId: e.id }))
                  ).map(l => (
                    <div
                      key={l.id}
                      className="p-3 bg-[#181926] border border-[#242638] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{l.employeeName}</span>: {l.daysCount} أيام
                        <div className="text-[10px] text-gray-400 mt-0.5">السبب: {l.reason}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {l.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => reviewLeaveRequest(l.empId, l.id, true)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              موافقة
                            </button>
                            <button
                              onClick={() => reviewLeaveRequest(l.empId, l.id, false)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              رفض
                            </button>
                          </>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.status === 'approved' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
                            {l.status === 'approved' ? 'تمت الموافقة' : 'مرفوض'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* الصلاحيات حسب الدور الوظيفي (Matrix Table matching screenshot) */}
          <div className="bg-[#14151e] border border-[#232535] rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#202232]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-red-500" />
                <div>
                  <h3 className="text-base font-black text-white">الصلاحيات حسب الدور الوظيفي</h3>
                  <p className="text-xs text-gray-400">تحديد الصلاحيات المتاحة لكل دور</p>
                </div>
              </div>
            </div>

            {/* Matrix table */}
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="border-b border-[#202232] text-gray-400 bg-[#171824]">
                    <th className="py-3 px-4 text-right">الدور الوظيفي</th>
                    <th className="py-3 px-3">لوحة التحكم</th>
                    <th className="py-3 px-3">الكاشير</th>
                    <th className="py-3 px-3">الأجهزة</th>
                    <th className="py-3 px-3">المخزون</th>
                    <th className="py-3 px-3">التقارير</th>
                    <th className="py-3 px-3">الإعدادات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b1c28]">
                  {(['cashier', 'supervisor', 'technician'] as const).map(roleKey => {
                    const perms = rolePermissions[roleKey];
                    const label = roleKey === 'cashier' ? 'كاشير' : roleKey === 'supervisor' ? 'مشرف' : 'فني أجهزة';
                    return (
                      <tr key={roleKey} className="hover:bg-[#181926]">
                        <td className="py-3 px-4 font-bold text-white text-right">{label}</td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleTogglePermission(roleKey, 'dashboard')}
                            className={`w-10 h-6 rounded-full transition-colors relative mx-auto cursor-pointer ${
                              perms.dashboard ? 'bg-red-600' : 'bg-gray-700'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                                perms.dashboard ? 'right-1' : 'right-5'
                              }`}
                            ></span>
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleTogglePermission(roleKey, 'cashier')}
                            className={`w-10 h-6 rounded-full transition-colors relative mx-auto cursor-pointer ${
                              perms.cashier ? 'bg-red-600' : 'bg-gray-700'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                                perms.cashier ? 'right-1' : 'right-5'
                              }`}
                            ></span>
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleTogglePermission(roleKey, 'devices')}
                            className={`w-10 h-6 rounded-full transition-colors relative mx-auto cursor-pointer ${
                              perms.devices ? 'bg-red-600' : 'bg-gray-700'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                                perms.devices ? 'right-1' : 'right-5'
                              }`}
                            ></span>
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleTogglePermission(roleKey, 'inventory')}
                            className={`w-10 h-6 rounded-full transition-colors relative mx-auto cursor-pointer ${
                              perms.inventory ? 'bg-red-600' : 'bg-gray-700'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                                perms.inventory ? 'right-1' : 'right-5'
                              }`}
                            ></span>
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleTogglePermission(roleKey, 'reports')}
                            className={`w-10 h-6 rounded-full transition-colors relative mx-auto cursor-pointer ${
                              perms.reports ? 'bg-red-600' : 'bg-gray-700'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                                perms.reports ? 'right-1' : 'right-5'
                              }`}
                            ></span>
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleTogglePermission(roleKey, 'settings')}
                            className={`w-10 h-6 rounded-full transition-colors relative mx-auto cursor-pointer ${
                              perms.settings ? 'bg-red-600' : 'bg-gray-700'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                                perms.settings ? 'right-1' : 'right-5'
                              }`}
                            ></span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALS */}
      {/* ------------------------------------------------------------- */}

      {/* 1. Change Employee Password Modal (User requested: "خاصية اني اتحكم بي باسورد الموظفين") */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-black text-white mb-2 flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              <span>تعديل كلمة سر / PIN الموظف</span>
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              يمكن للمالك فقط تعيين كلمة سر جديدة أو رمز PIN للموظف لاستخدامه في تسجيل الدخول.
            </p>
            <form onSubmit={handleUpdatePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">كلمة السر الجديدة (أو PIN)</label>
                <input
                  type="text"
                  required
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  placeholder="مثال: 5678"
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2 text-sm text-white font-mono text-center focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 bg-[#202232] text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  حفظ كلمة السر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Employee Deduction Modal (User requested: "التحكم بالخصومات") */}
      {showDeductionModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-black text-white mb-2 flex items-center gap-2">
              <MinusCircle className="w-5 h-5 text-red-500" />
              <span>تطبيق خصم مالي على الموظف</span>
            </h3>
            <form onSubmit={handleAddDeductionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">المبلغ المخصوم (EGP)</label>
                <input
                  type="number"
                  min="10"
                  step="10"
                  required
                  value={deductionAmount}
                  onChange={e => setDeductionAmount(Number(e.target.value))}
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2 text-sm text-white font-mono text-center focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">سبب الخصم</label>
                <input
                  type="text"
                  required
                  value={deductionReason}
                  onChange={e => setDeductionReason(e.target.value)}
                  placeholder="سبب الجزاء..."
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeductionModal(false)}
                  className="flex-1 py-2.5 bg-[#202232] text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  اعتماد الخصم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Leave Request Modal (User requested: "الاجازات هي اللي تتطلب بس") */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-black text-white mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <span>تقديم طلب إجازة</span>
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              سيتم إرسال الطلب للمالك لمراجعته والموافقة عليه أو رفضه.
            </p>
            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">عدد أيام الإجازة</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  required
                  value={leaveDays}
                  onChange={e => setLeaveDays(Number(e.target.value))}
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2 text-sm text-white font-mono text-center focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">سبب طلب الإجازة</label>
                <textarea
                  rows={2}
                  required
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  placeholder="سبب الإجازة..."
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                ></textarea>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 py-2.5 bg-[#202232] text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  إرسال الطلب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-red-500" />
              <span>إضافة موظف جديد وتعيين كلمة المرور</span>
            </h3>
            <form onSubmit={handleCreateEmployee} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اسم الموظف</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">رقم الهاتف (اسم المستخدم)</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="010..."
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">كلمة السر / PIN</label>
                  <input
                    type="text"
                    required
                    value={empPin}
                    onChange={e => setEmpPin(e.target.value)}
                    placeholder="1234"
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-mono text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">الدور الوظيفي</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="cashier">كاشير</option>
                    <option value="supervisor">مشرف</option>
                    <option value="technician">فني أجهزة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">الفرع المخصص</label>
                  <select
                    value={branchId}
                    onChange={e => setBranchId(e.target.value)}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.nameAr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">الوردية</label>
                  <select
                    value={shiftType}
                    onChange={e => setShiftType(e.target.value as any)}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="morning">صباحية</option>
                    <option value="night">ليلية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">الراتب الشهري (EGP)</label>
                  <input
                    type="number"
                    value={salaryMonthly}
                    onChange={e => setSalaryMonthly(Number(e.target.value))}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  حفظ الموظف وتفعيل الحساب
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

      {/* 5. Overtime Request Modal */}
      {showOvertimeModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span>تسجيل ساعات عمل إضافية (أوفر تايم)</span>
            </h3>
            <form onSubmit={handleAddOvertimeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">الموظف</label>
                <select
                  required
                  value={selectedEmpForOvertime}
                  onChange={e => setSelectedEmpForOvertime(e.target.value)}
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">-- اختر الموظف --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">عدد الساعات الإضافية</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={overtimeHours}
                    onChange={e => setOvertimeHours(Number(e.target.value))}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">أجر الساعة (EGP)</label>
                  <input
                    type="number"
                    min="10"
                    value={overtimeRate}
                    onChange={e => setOvertimeRate(Number(e.target.value))}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">سبب العمل الإضافي</label>
                <input
                  type="text"
                  required
                  value={overtimeReason}
                  onChange={e => setOvertimeReason(e.target.value)}
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!selectedEmpForOvertime}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  حفظ واعتماد الأوفر تايم
                </button>
                <button
                  type="button"
                  onClick={() => setShowOvertimeModal(false)}
                  className="px-4 py-2.5 bg-[#1f212f] text-gray-400 hover:text-white rounded-xl text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBranchTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-2">نقل الموظف بين الفروع</h3>
            <p className="text-xs text-gray-400 mb-4">اختر الفرع الجديد، وسيتم تسجيل العملية في سجل المراجعة.</p>
            <select
              value={targetBranchForTransfer}
              onChange={e => setTargetBranchForTransfer(e.target.value)}
              className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="">-- اختر الفرع --</option>
              {branches.filter(b => b.isActive).map(b => (
                <option key={b.id} value={b.id}>{b.nameAr}</option>
              ))}
            </select>
            {transferMessage && <div className="mt-3 text-xs text-emerald-300">{transferMessage}</div>}
            <div className="flex items-center gap-3 pt-5">
              <button
                type="button"
                onClick={handleEmployeeBranchTransfer}
                disabled={!targetBranchForTransfer}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                تأكيد نقل الموظف
              </button>
              <button
                type="button"
                onClick={() => setShowBranchTransferModal(false)}
                className="px-4 py-2.5 bg-[#1f212f] text-gray-400 hover:text-white rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
