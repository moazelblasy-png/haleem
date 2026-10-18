import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Device, GameSession } from '../types';
import {
  Gamepad2,
  Tv,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Plus,
  Grid,
  List,
  Filter,
  Sparkles,
  AlertTriangle,
  MoreVertical,
  Coffee,
  Receipt,
  User,
  ShoppingBag,
  Sliders,
  ChevronDown,
  BellRing,
  Volume2
} from 'lucide-react';
import { ConsoleIcon } from './ConsoleIcon';
import { playClickSound, playFiveMinuteWarningSound } from '../utils/sound';
import { calculateSessionGamingCost } from '../logic/pricing';

interface DashboardViewProps {
  onSelectDeviceForSession: (device: Device) => void;
  onOpenSessionDetails: (session: GameSession, device: Device) => void;
  onTransferDevice: (device: Device) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectDeviceForSession,
  onOpenSessionDetails,
  onTransferDevice,
}) => {
  const {
    devices,
    sessions,
    activeBranch,
    populateDefaultBranchDevices,
    activeShift,
    currentUser,
    setActiveView,
    changeSessionControllers,
    addSessionProduct,
    inventory,
    switchSessionDeviceType,
    pricingTiers,
    roundingPolicy,
  } = useApp();

  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [openMenuDeviceId, setOpenMenuDeviceId] = useState<string | null>(null);

  // Quick Bar Order Modal
  const [quickOrderSession, setQuickOrderSession] = useState<{ session: GameSession; device: Device } | null>(null);
  const [quickOrderProductId, setQuickOrderProductId] = useState<string>('');
  const [quickOrderQty, setQuickOrderQty] = useState<number>(1);

  // Real-time ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close actions menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setOpenMenuDeviceId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const branchDevices = devices.filter(d => d.branchId === activeBranch?.id);

  // Map active sessions
  const activeSessionsMap = new Map<string, GameSession>();
  sessions.forEach(s => {
    if (s.branchId === activeBranch?.id && s.status === 'active') {
      activeSessionsMap.set(s.deviceId, s);
    }
  });

  // Calculate dynamic status
  const getDeviceDynamicStatus = (device: Device) => {
    if (device.status === 'maintenance') {
      return {
        status: 'maintenance' as const,
        label: 'تحت الصيانة',
        elapsedSeconds: 0,
        gameTitle: 'صيانة وتحديث',
        isNearEnd: false,
      };
    }

    const session = activeSessionsMap.get(device.id);
    if (!session) {
      return {
        status: 'available' as const,
        label: 'متاحة',
        elapsedSeconds: 0,
        gameTitle: 'جاهزة للتشغيل',
        isNearEnd: false,
      };
    }

    const elapsedSeconds = Math.max(0, Math.floor((nowMs - session.startTime) / 1000));
    let remainingSeconds: number | undefined = undefined;
    let isNearEnd = false;

    // Gaming cost calculation
    const { totalCost: liveCost } = calculateSessionGamingCost(
      session.segments,
      nowMs,
      pricingTiers,
      roundingPolicy
    );

    if (session.sessionType === 'timed' && session.plannedDurationMinutes) {
      const plannedSeconds = session.plannedDurationMinutes * 60;
      remainingSeconds = plannedSeconds - elapsedSeconds;
      if (remainingSeconds <= 300 && remainingSeconds > 0) {
        isNearEnd = true;
      }
      if (remainingSeconds <= 0) {
        return {
          status: 'overdue' as const,
          label: 'انتهى الوقت!',
          elapsedSeconds,
          remainingSeconds,
          gameTitle: session.gameName || 'FIFA / FC 24',
          session,
          liveCost,
          isNearEnd: false,
        };
      }
    } else if (session.sessionType === 'budget' && session.budgetEgp) {
      const remainingBudget = session.budgetEgp - liveCost;
      if (remainingBudget <= 5 && remainingBudget > 0) {
        isNearEnd = true;
      }
      if (remainingBudget <= 0) {
        return {
          status: 'overdue' as const,
          label: 'استنفذت الميزانية!',
          elapsedSeconds,
          remainingBudget,
          gameTitle: session.gameName || 'FIFA / FC 24',
          session,
          liveCost,
          isNearEnd: false,
        };
      }
    }

    return {
      status: 'busy' as const,
      label: 'مشغولة',
      elapsedSeconds,
      remainingSeconds,
      gameTitle: session.gameName || 'FIFA / FC 24',
      session,
      liveCost,
      isNearEnd,
    };
  };

  const devicesWithStatus = branchDevices.map(dev => ({
    ...dev,
    dynamic: getDeviceDynamicStatus(dev),
  }));

  const totalCount = devicesWithStatus.length;
  const availableCount = devicesWithStatus.filter(d => d.dynamic.status === 'available').length;
  const busyCount = devicesWithStatus.filter(d => d.dynamic.status === 'busy').length;
  const overdueCount = devicesWithStatus.filter(d => d.dynamic.status === 'overdue').length;
  const nearEndDevices = devicesWithStatus.filter(d => d.dynamic.isNearEnd);

  const filteredDevices = devicesWithStatus.filter(d => {
    if (filterType === 'ps5') return d.type === 'PS5';
    if (filterType === 'ps4') return d.type === 'PS4';
    if (filterType === 'available') return d.dynamic.status === 'available';
    if (filterType === 'busy') return d.dynamic.status === 'busy';
    if (filterType === 'overdue') return d.dynamic.status === 'overdue';
    return true;
  });

  const formatTimer = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const handleQuickAddOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickOrderSession || !quickOrderProductId) return;
    addSessionProduct(quickOrderSession.session.id, quickOrderProductId, quickOrderQty, false);
    setQuickOrderSession(null);
    setQuickOrderProductId('');
    setQuickOrderQty(1);
    playClickSound();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Shift Alert Notice if not open */}
      {!activeShift && !currentUser?.isOwner && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-200 shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-sm">تنبيه الشفت: لم يتم استلام الوردية بعد</div>
              <div className="text-xs text-amber-300/80">
                يجب استلام الوردية وإجراء الجرد لفتح التحكم بالجلسات أو ترحيل الجلسات المفتوحة.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveView('shifts')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl transition cursor-pointer"
          >
            استلام الوردية الآن ←
          </button>
        </div>
      )}

      {/* Critical Audio Alerts Banner (5 minutes left or Overdue) */}
      {(overdueCount > 0 || nearEndDevices.length > 0) && (
        <div className="p-4 bg-gradient-to-r from-red-950/70 via-red-900/40 to-[#171825] border-2 border-red-500 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-3 text-white shadow-2xl animate-pulse">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-950/80 shrink-0">
              <BellRing className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="text-sm font-black flex items-center gap-2">
                <span>تنبيه المواعيد التلقائي (منبه الجلسات الصوتي)</span>
                {overdueCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {overdueCount} جهاز انتهى وقته!
                  </span>
                )}
                {nearEndDevices.length > 0 && (
                  <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                    {nearEndDevices.length} جهاز متبقي أقل من 5 دقائق!
                  </span>
                )}
              </div>
              <p className="text-xs text-red-200 mt-0.5">
                النظام يطلق تنبيهاً صوتياً تلقائياً قبل 5 دقائق من انتهاء الجلسة، وعند الانتهاء بالضبط، وتذكيراً دورياً للأجهزة المتأخرة.
              </p>
            </div>
          </div>
          <button
            onClick={() => playFiveMinuteWarningSound()}
            className="px-3.5 py-2 bg-[#202235] hover:bg-[#2b2d45] border border-red-500/40 text-red-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>تجربة المنبه الصوتي</span>
          </button>
        </div>
      )}

      {/* Header Bar with Title and Status Badges */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center shadow">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">حالة الأجهزة والشاشات</h1>
            <p className="text-xs text-gray-400">فرع {activeBranch?.nameAr} - تحكم فوري بالوقت والميزانية والأذرع</p>
          </div>
        </div>

        {/* Status Badges Row */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Total Devices */}
          <div className="bg-[#14151f] border border-[#232535] px-3.5 py-1.5 rounded-xl flex items-center gap-2.5">
            <div className="text-right">
              <span className="text-[9px] text-gray-400 block font-medium">إجمالي الأجهزة</span>
              <span className="text-sm font-black text-white font-mono">{totalCount}</span>
            </div>
            <Tv className="w-4 h-4 text-gray-400" />
          </div>

          {/* Available */}
          <div className="bg-[#14151f] border border-emerald-600/40 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <div className="text-right">
              <span className="text-[9px] text-gray-400 block">متاحة</span>
              <span className="text-xs font-black text-emerald-400 font-mono">{availableCount}</span>
            </div>
          </div>

          {/* Busy */}
          <div className="bg-[#14151f] border border-red-600/40 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <div className="text-right">
              <span className="text-[9px] text-gray-400 block">مشغولة</span>
              <span className="text-xs font-black text-red-400 font-mono">{busyCount}</span>
            </div>
          </div>

          {/* Overdue */}
          <div className="bg-[#14151f] border border-amber-500/40 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
            <div className="text-right">
              <span className="text-[9px] text-gray-400 block">متأخرة / انتهت</span>
              <span className="text-xs font-black text-amber-400 font-mono">{overdueCount}</span>
            </div>
          </div>

          {/* Filter Dropdown */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-[#14151f] border border-[#232535] text-gray-300 text-xs rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="all">كل الأجهزة</option>
            <option value="ps5">أجهزة PS5 فقط</option>
            <option value="ps4">أجهزة PS4 فقط</option>
            <option value="available">المتاحة فقط</option>
            <option value="busy">المشغولة فقط</option>
            <option value="overdue">المتأخرة فقط</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-[#14151f] border border-[#232535] rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {branchDevices.length === 0 ? (
        <div className="p-12 text-center bg-[#13141d] border border-[#222436] rounded-3xl max-w-2xl mx-auto my-12">
          <div className="w-20 h-20 rounded-3xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
            <Gamepad2 className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">لا توجد أجهزة مسجلة في هذا الفرع</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
            يمكنك تهيئة الأجهزة الافتراضية للفرع فوراً (7 أجهزة، أو 8 أجهزة لتشيلسي) مع تحديد PS4 وPS5 لكل شاشة.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => populateDefaultBranchDevices(activeBranch?.id || 'liverpool')}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-lg shadow-red-950/60 flex items-center gap-2 cursor-pointer text-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>تهيئة أجهزة فرع {activeBranch?.nameAr}</span>
            </button>
            <button
              onClick={() => setActiveView('devices')}
              className="px-5 py-3 bg-[#1d1f2d] hover:bg-[#25283b] text-gray-200 font-bold rounded-xl transition border border-[#2d3045] text-sm cursor-pointer"
            >
              + إضافة شاشة مخصصة
            </button>
          </div>
        </div>
      ) : (
        /* Device Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredDevices.map(device => {
            const { status, label, elapsedSeconds, remainingSeconds, gameTitle, session, liveCost, isNearEnd } = device.dynamic;

            // Card color styles: Prominent Yellow on last 5 minutes, Red when overdue/ended
            const cardBgAndBorderClass =
              status === 'overdue'
                ? 'bg-gradient-to-b from-red-950/85 via-[#2b0e14] to-[#150a0d] border-red-500 shadow-2xl shadow-red-950/80 ring-2 ring-red-500 animate-pulse text-white'
                : isNearEnd
                ? 'bg-gradient-to-b from-amber-950/75 via-[#2d220c] to-[#161208] border-amber-400 shadow-2xl shadow-amber-950/70 ring-2 ring-amber-400/90 animate-pulse text-white'
                : status === 'available'
                ? 'bg-[#13141d] border-emerald-600/60 hover:border-emerald-400 shadow-emerald-950/20'
                : 'bg-[#13141d] border-[#2d3045] hover:border-red-500 shadow-black/40';

            const dotClass =
              status === 'available'
                ? 'bg-emerald-500'
                : status === 'overdue'
                ? 'bg-red-500 animate-ping'
                : isNearEnd
                ? 'bg-amber-400 animate-pulse'
                : 'bg-red-500';

            const currentSeg = session?.segments[session.segments.length - 1];
            const activeDeviceType = currentSeg?.deviceType || device.type;
            const controllersCount = currentSeg?.controllers || 2;
            const ordersCount = session?.products.length || 0;
            const ordersTotal = session?.products.reduce((sum, p) => sum + (p.unitPrice * p.quantity), 0) || 0;
            const isMenuOpen = openMenuDeviceId === device.id;

            return (
              <div
                key={device.id}
                className={`rounded-2xl border-2 ${cardBgAndBorderClass} p-3.5 flex flex-col justify-between transition-all duration-300 relative group overflow-visible shadow-xl`}
              >
                {/* 5-Min Pre-Alert Tag */}
                {isNearEnd && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-md z-20 flex items-center gap-1">
                    <span>⚠️ متبقي أقل من 5 دقائق!</span>
                  </div>
                )}

                {/* Overdue Alert Tag */}
                {status === 'overdue' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-md z-20 flex items-center gap-1 animate-bounce">
                    <span>🚨 انتهى الوقت!</span>
                  </div>
                )}

                {/* Top Corner: Screen Number Badge & Actions Dropdown Button */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="bg-[#1b1d28] border border-[#292c3c] rounded-lg px-2.5 py-1 text-center">
                    <span className="text-[9px] text-gray-400 block leading-none">شاشة</span>
                    <span className="text-xs font-mono font-black text-gray-100">
                      {device.screenNumber.replace(/[^0-9]/g, '') || device.screenNumber}
                    </span>
                  </div>

                  {/* Actions Dropdown Button */}
                  <div className="relative">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setOpenMenuDeviceId(isMenuOpen ? null : device.id);
                        playClickSound();
                      }}
                      className="p-1.5 rounded-lg bg-[#1c1e2b] hover:bg-[#282a3d] text-gray-300 hover:text-white transition flex items-center gap-1 border border-[#2b2d42] cursor-pointer"
                      title="الإجراءات"
                    >
                      <span className="text-[10px] font-bold">الإجراءات</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {/* Actions Menu */}
                    {isMenuOpen && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="absolute left-0 top-8 z-50 w-52 bg-[#181927] border-2 border-[#2f3248] rounded-2xl shadow-2xl p-1.5 space-y-1 text-right text-xs font-bold animate-in fade-in zoom-in-95"
                      >
                        {status === 'available' ? (
                          <button
                            onClick={() => {
                              setOpenMenuDeviceId(null);
                              onSelectDeviceForSession(device);
                            }}
                            className="w-full px-3 py-2 rounded-xl text-emerald-400 hover:bg-[#222438] flex items-center gap-2 cursor-pointer"
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span>بدء جلسة جديدة</span>
                          </button>
                        ) : (
                          <>
                            {session && (
                              <button
                                onClick={() => {
                                  setOpenMenuDeviceId(null);
                                  onOpenSessionDetails(session, device);
                                }}
                                className="w-full px-3 py-2 rounded-xl text-gray-200 hover:bg-[#222438] flex items-center gap-2 cursor-pointer"
                              >
                                <Tv className="w-4 h-4 text-blue-400" />
                                <span>تفاصيل الجلسة والتحكم</span>
                              </button>
                            )}

                            {session && (
                              <button
                                onClick={() => {
                                  setOpenMenuDeviceId(null);
                                  setQuickOrderSession({ session, device });
                                }}
                                className="w-full px-3 py-2 rounded-xl text-amber-300 hover:bg-[#222438] flex items-center gap-2 cursor-pointer"
                              >
                                <Coffee className="w-4 h-4 text-amber-400" />
                                <span>+ إضافة طلب بوفيه</span>
                              </button>
                            )}

                            {session && (
                              <div className="px-3 py-1.5 border-t border-[#25283c]">
                                <div className="text-[10px] text-gray-400 mb-1">تعديل عدد الأذرع:</div>
                                <div className="grid grid-cols-3 gap-1">
                                  {[2, 3, 4].map(c => (
                                    <button
                                      key={c}
                                      onClick={() => {
                                        changeSessionControllers(session.id, c as any);
                                        setOpenMenuDeviceId(null);
                                        playClickSound();
                                      }}
                                      className={`py-1 rounded-lg text-center font-mono text-[11px] font-bold ${
                                        controllersCount === c ? 'bg-red-600 text-white' : 'bg-[#222438] text-gray-300 hover:bg-[#2b2e46]'
                                      }`}
                                    >
                                      {c}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Switch generation PS4 <-> PS5 */}
                            {session && (
                              <button
                                onClick={() => {
                                  const targetType = device.type === 'PS4' ? 'PS5' : 'PS4';
                                  switchSessionDeviceType(session.id, targetType);
                                  setOpenMenuDeviceId(null);
                                  playClickSound();
                                }}
                                className="w-full px-3 py-2 rounded-xl text-purple-300 hover:bg-[#222438] flex items-center gap-2 cursor-pointer border-t border-[#25283c]"
                              >
                                <Sliders className="w-4 h-4 text-purple-400" />
                                <span>
                                  {device.type === 'PS4' ? 'ترقية لحساب PS5' : 'تخفيض لحساب PS4'}
                                </span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setOpenMenuDeviceId(null);
                                onTransferDevice(device);
                              }}
                              className="w-full px-3 py-2 rounded-xl text-blue-300 hover:bg-[#222438] flex items-center gap-2 cursor-pointer"
                            >
                              <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                              <span>نقل / تبديل الشاشة</span>
                            </button>

                            {session && (
                              <button
                                onClick={() => {
                                  setOpenMenuDeviceId(null);
                                  onOpenSessionDetails(session, device);
                                }}
                                className="w-full px-3 py-2 rounded-xl text-red-400 hover:bg-red-950/40 flex items-center gap-2 cursor-pointer border-t border-[#25283c]"
                              >
                                <Receipt className="w-4 h-4" />
                                <span>المحاسبة والإغلاق</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Console Vector Graphics & Type Switcher */}
                <div className="flex flex-col items-center justify-center my-1">
                  <div className="flex items-center justify-center gap-2 h-14">
                    <ConsoleIcon type={activeDeviceType} size="md" />
                    <div className="text-right">
                      <span className="text-base font-black text-white font-mono tracking-wider block">
                        {activeDeviceType}
                      </span>
                      {status !== 'available' && (
                        <span className="text-[10px] font-mono text-gray-300 block">
                          {controllersCount} ذراع
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1-Click Generation Switch (PS4 ↔ PS5) without ending session */}
                  {session && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const targetType = activeDeviceType === 'PS4' ? 'PS5' : 'PS4';
                        switchSessionDeviceType(session.id, targetType);
                        playClickSound();
                      }}
                      className="mt-1 px-2.5 py-0.5 rounded-full bg-[#1b1c2b] hover:bg-purple-950/80 border border-purple-500/40 text-[10px] text-purple-300 font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                      title="تبديل نوع الحساب فوراً بين PS4 و PS5 دون إنهاء الجلسة"
                    >
                      <Sliders className="w-2.5 h-2.5 text-purple-400" />
                      <span>{activeDeviceType === 'PS4' ? 'تحويل لـ PS5' : 'تحويل لـ PS4'}</span>
                    </button>
                  )}
                </div>

                {/* Status Dot & Label */}
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold my-1">
                  <span className={`w-2 h-2 rounded-full ${dotClass}`}></span>
                  <span className="text-gray-200">{label}</span>
                </div>

                {/* Session Mode Pill (Open / Timed / Budget) */}
                {session ? (
                  <div className="text-center my-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      session.sessionType === 'timed'
                        ? 'bg-blue-950/60 border border-blue-500/40 text-blue-300'
                        : session.sessionType === 'budget'
                        ? 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
                        : 'bg-purple-950/60 border border-purple-500/40 text-purple-300'
                    }`}>
                      {session.sessionType === 'timed'
                        ? `جلسة بوقت (${session.plannedDurationMinutes} د)`
                        : session.sessionType === 'budget'
                        ? `ميزانية (${session.budgetEgp} ج.م)`
                        : 'جلسة مفتوحة'}
                    </span>

                    <div className="mt-1">
                      <div className="text-[11px] font-black text-white truncate px-1">
                        {session.customerName}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {gameTitle}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center my-1">
                    <span className="text-[10px] text-gray-500 block">الجهاز متاح</span>
                    <span className="text-xs font-bold text-emerald-400">جاهز للاستخدام</span>
                  </div>
                )}

                {/* Budget Progress Meter (If budget session) */}
                {session?.sessionType === 'budget' && session.budgetEgp && (
                  <div className="my-1 p-2 bg-[#191a27] border border-[#2b2d42] rounded-xl text-[10px] text-right space-y-1">
                    <div className="flex justify-between items-center font-mono">
                      <span className="text-gray-400">المستهلك: {liveCost} ج.م</span>
                      <span className="text-amber-400 font-bold">باقي: {Math.max(0, session.budgetEgp - (liveCost || 0))} ج.م</span>
                    </div>
                    <div className="w-full bg-[#11121a] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, ((liveCost || 0) / session.budgetEgp) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Orders Summary on Card Face */}
                {ordersCount > 0 && (
                  <div className="my-1 p-1.5 bg-[#191a27] border border-amber-500/30 rounded-xl text-[10px] text-right flex items-center justify-between text-amber-300 font-bold">
                    <span className="flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3" />
                      <span>طلبات ({ordersCount}):</span>
                    </span>
                    <span className="font-mono">{ordersTotal} ج.م</span>
                  </div>
                )}

                {/* Session Timer Display */}
                <div className="text-center my-1">
                  <span className="text-[10px] text-gray-400 block font-medium">
                    {session?.sessionType === 'timed'
                      ? remainingSeconds && remainingSeconds < 0
                        ? 'الوقت الزائد (متأخر)'
                        : 'المتبقي'
                      : 'الوقت المستغرق'}
                  </span>
                  <span
                    className={`text-sm font-mono font-black block tracking-wider ${
                      status === 'overdue'
                        ? 'text-red-500 animate-pulse'
                        : isNearEnd
                        ? 'text-amber-400'
                        : status === 'busy'
                        ? 'text-red-400'
                        : 'text-gray-500'
                    }`}
                  >
                    {status === 'available'
                      ? '00:00:00'
                      : session?.sessionType === 'timed' && remainingSeconds !== undefined
                      ? remainingSeconds < 0
                        ? `+${formatTimer(Math.abs(remainingSeconds))}`
                        : formatTimer(remainingSeconds)
                      : formatTimer(elapsedSeconds)}
                  </span>
                </div>

                {/* Primary Card Action Button */}
                <div className="mt-2 pt-2 border-t border-[#1e202d]">
                  {status === 'available' ? (
                    <button
                      onClick={() => onSelectDeviceForSession(device)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>بدء جلسة</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => session && onOpenSessionDetails(session, device)}
                      className="w-full py-2 bg-[#202230] hover:bg-red-600 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>لوحة التحكم</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Add Bar Order Modal */}
      {quickOrderSession && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141520] border-2 border-[#2b2d42] rounded-3xl w-full max-w-sm shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#242638]">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-black text-white">إضافة طلب كافتيريا</h4>
              </div>
              <button
                onClick={() => setQuickOrderSession(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300">
              إضافة طلب على {quickOrderSession.device.screenNumber} للعميل: {quickOrderSession.session.customerName}
            </p>

            <form onSubmit={handleQuickAddOrderSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اختر الصنف</label>
                <select
                  required
                  value={quickOrderProductId}
                  onChange={e => setQuickOrderProductId(e.target.value)}
                  className="w-full bg-[#1b1c28] border border-[#2b2d42] rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">-- اختر من القائمة --</option>
                  {inventory
                    .filter(i => i.branchId === activeBranch?.id)
                    .map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sellingPrice} EGP) - مخزون: {item.stockQuantity}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">الكمية</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={quickOrderQty}
                  onChange={e => setQuickOrderQty(Number(e.target.value))}
                  className="w-full bg-[#1b1c28] border border-[#2b2d42] rounded-xl px-3 py-2 text-xs text-white font-mono text-center"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickOrderSession(null)}
                  className="flex-1 py-2 bg-[#202232] text-gray-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-950/60"
                >
                  تأكيد الإضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
