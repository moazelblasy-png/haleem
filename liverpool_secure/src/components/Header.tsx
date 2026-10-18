import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Building2,
  Calendar,
  Clock,
  User,
  Bell,
  Wifi,
  WifiOff,
  ChevronDown,
  ShieldAlert,
  LogOut,
  RefreshCw,
  HelpCircle,
  Volume2,
  VolumeX,
  Palette,
  Globe,
  Sliders,
  DollarSign
} from 'lucide-react';
import { toggleAudioMute, getIsMuted, playClickSound, playFiveMinuteWarningSound } from '../utils/sound';
import { ClubLogo } from './ClubLogo';

interface HeaderProps {
  onOpenNotifications: () => void;
  onOpenOwnerSetup: () => void;
  onToggleMobileMenu: () => void;
  onOpenGuide?: () => void;
  onOpenExpense?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  onOpenOwnerSetup,
  onToggleMobileMenu,
  onOpenGuide,
  onOpenExpense,
}) => {
  const {
    ownerProfile,
    currentUser,
    branches,
    activeBranch,
    setActiveBranchId,
    logoutUser,
    isOnline,
    offlineQueue,
    syncOfflineQueue,
    notifications,
    setActiveView,
    appLang,
    setAppLang,
    themeAccent,
    setThemeAccent,
    activeShift,
  } = useApp();

  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(getIsMuted());

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const day = now.getDate();
      const month = appLang === 'ar' ? monthsAr[now.getMonth()] : monthsEn[now.getMonth()];
      const year = now.getFullYear();
      setCurrentDateStr(`${day} ${month} ${year}`);

      const hours = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, '0');
      const secs = now.getSeconds().toString().padStart(2, '0');
      const ampm = appLang === 'ar' ? (hours >= 12 ? 'م' : 'ص') : (hours >= 12 ? 'PM' : 'AM');
      const h12 = (hours % 12 || 12).toString().padStart(2, '0');
      setCurrentTimeStr(`${h12}:${mins}:${secs} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [appLang]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <header className="h-20 bg-[#12131a] border-b border-[#202230] px-3 md:px-8 flex items-center justify-between text-white select-none z-30 sticky top-0 shadow-lg">
      {/* Right / Start (in RTL): Hamburger, Branch Switcher, Clock, Online Status */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile Hamburger */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden w-10 h-10 rounded-xl bg-[#181924] border border-[#2b2d3f] flex items-center justify-center text-gray-300 hover:text-white"
          aria-label="القائمة"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Branch Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowBranchMenu(!showBranchMenu)}
            className="flex items-center gap-3 bg-[#181924] hover:bg-[#202232] border border-[#2b2d3f] rounded-2xl px-3.5 py-2 transition text-right cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-[#14151e] border border-red-500/30 flex items-center justify-center overflow-hidden p-1 shadow">
              <ClubLogo branchId={activeBranch?.id || 'liverpool'} size="sm" />
            </div>
            <div>
              <div className="text-[10px] text-gray-400 font-medium">الفرع الحالي</div>
              <div className="text-sm font-black text-red-500 flex items-center gap-1.5">
                {activeBranch?.nameAr || 'ليفربول'}
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>
          </button>

          {showBranchMenu && (
            <div className="absolute top-full mt-2 right-0 w-60 bg-[#161722] border border-[#2d3045] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2 text-xs text-gray-400 font-bold border-b border-[#252839]">
                فروع ليفربول جيمينج
              </div>
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={() => {
                    setActiveBranchId(b.id);
                    setShowBranchMenu(false);
                    playClickSound();
                  }}
                  className={`w-full text-right px-4 py-2.5 flex items-center justify-between hover:bg-red-950/30 transition text-sm ${
                    b.id === activeBranch?.id ? 'text-red-500 font-bold bg-red-600/10' : 'text-gray-200'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <ClubLogo branchId={b.id} size="sm" className="w-6 h-6" />
                    <span>{b.nameAr}</span>
                  </span>
                  <span className="text-[11px] text-gray-400 font-mono font-bold bg-[#1d1f2e] px-2 py-0.5 rounded">
                    {b.code}
                  </span>
                </button>
              ))}
              <div className="p-2 border-t border-[#252839]">
                <button
                  onClick={() => {
                    setActiveView('branches');
                    setShowBranchMenu(false);
                  }}
                  className="w-full text-center text-xs text-red-400 hover:text-red-300 font-bold py-1.5"
                >
                  إدارة كافة الفروع وتفاصيلها ←
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Date & Time Widget */}
        <div className="hidden lg:flex items-center gap-3 bg-[#181924] border border-[#262838] px-4 py-2 rounded-2xl">
          <div className="flex items-center gap-2 border-l border-[#2e3144] pl-3">
            <Calendar className="w-4 h-4 text-red-500" />
            <div className="text-right">
              <span className="text-[9px] text-gray-400 block leading-none">التاريخ</span>
              <span className="text-xs font-semibold text-gray-200">{currentDateStr}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-500" />
            <div className="text-right">
              <span className="text-[9px] text-gray-400 block leading-none">الوقت الحي</span>
              <span className="text-xs font-mono font-bold text-gray-100">{currentTimeStr}</span>
            </div>
          </div>
        </div>

        {/* Network & Offline Status */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">أونلاين</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/60 border border-amber-500/50 text-amber-300 text-xs animate-pulse font-bold">
              <WifiOff className="w-3.5 h-3.5" />
              <span>أوفلاين (محلي)</span>
              {offlineQueue.length > 0 && (
                <span className="bg-amber-500 text-black px-1.5 py-0.2 rounded-full font-bold text-[10px]">
                  {offlineQueue.length}
                </span>
              )}
            </div>
          )}

          {isOnline && offlineQueue.length > 0 && (
            <button
              onClick={syncOfflineQueue}
              className="flex items-center gap-1.5 bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition border border-red-500/40 cursor-pointer"
              title="مزامنة العمليات المعلقة"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>مزامنة ({offlineQueue.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Left Side: Actions, Theme, Sound, Notifications, User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Guide Button */}
        {onOpenGuide && (
          <button
            onClick={() => {
              playClickSound();
              onOpenGuide();
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#181924] hover:bg-[#222438] text-gray-300 hover:text-white border border-[#2b2d40] text-xs font-bold transition cursor-pointer"
            title="دليل التشغيل السريع"
          >
            <HelpCircle className="w-4 h-4 text-red-400" />
            <span className="hidden md:inline">دليل التشغيل</span>
          </button>
        )}

        {/* Expense Quick Button */}
        {onOpenExpense && (
          <button
            onClick={() => {
              playClickSound();
              onOpenExpense();
            }}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/40 text-xs font-bold transition cursor-pointer"
            title="تسجيل سلفة أو مصروف"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>+ سلفة / مصروف</span>
          </button>
        )}

        {/* Audio Sound Mute Toggle with Pre-Alert test */}
        <button
          onClick={() => {
            const muted = toggleAudioMute();
            setIsMuted(muted);
            if (!muted) playFiveMinuteWarningSound();
          }}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition cursor-pointer ${
            isMuted
              ? 'bg-[#181924] border-[#2b2d3f] text-gray-500'
              : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400 shadow-md'
          }`}
          title={isMuted ? 'الصوت مكتوم - اضغط للتشغيل' : 'الصوت مفعل (منبه 5 دقائق + انتهاء الوقت)'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Notifications Icon Button */}
        <button
          onClick={onOpenNotifications}
          className="relative w-10 h-10 rounded-xl bg-[#181924] hover:bg-[#202232] border border-[#2b2d3f] flex items-center justify-center text-gray-300 hover:text-white transition cursor-pointer"
          title="الإشعارات والتنبيهات"
        >
          <Bell className="w-4 h-4 text-gray-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#12131a] shadow-lg animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => {
            playClickSound();
            setAppLang(appLang === 'ar' ? 'en' : 'ar');
          }}
          className="w-10 h-10 rounded-xl bg-[#181924] hover:bg-[#202232] border border-[#2b2d3f] flex items-center justify-center text-gray-300 hover:text-white transition cursor-pointer font-bold text-xs"
          title="تغيير اللغة (العربية / English)"
        >
          {appLang === 'ar' ? 'EN' : 'عربي'}
        </button>

        {/* Theme Accent Customization */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="w-10 h-10 rounded-xl bg-[#181924] hover:bg-[#202232] border border-[#2b2d3f] flex items-center justify-center text-gray-300 hover:text-white transition cursor-pointer"
            title="تخصيص اللون الرئيسي"
          >
            <Palette className="w-4 h-4 text-red-500" />
          </button>
          {showThemeMenu && (
            <div className="absolute top-full mt-2 left-0 w-44 bg-[#161722] border border-[#2d3045] rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 space-y-1.5 text-xs font-bold">
              <div className="text-[10px] text-gray-400 px-2 pb-1 border-b border-[#252839]">الألوان المخصصة</div>
              {[
                { id: 'red', name: 'ليفربول أحمر', color: 'bg-red-600' },
                { id: 'blue', name: 'تشيلسي أزرق', color: 'bg-blue-600' },
                { id: 'emerald', name: 'أخضر نيون', color: 'bg-emerald-500' },
                { id: 'purple', name: 'بنفسجي ملكي', color: 'bg-purple-600' },
                { id: 'amber', name: 'ذهبي كلاسيكي', color: 'bg-amber-500' },
              ].map(th => (
                <button
                  key={th.id}
                  onClick={() => {
                    setThemeAccent(th.id as any);
                    setShowThemeMenu(false);
                    playClickSound();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[#222438] transition ${
                    themeAccent === th.id ? 'text-white bg-[#222438]' : 'text-gray-300'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${th.color}`}></span>
                  <span>{th.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Account / Profile Button */}
        <div className="relative">
          {currentUser ? (
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 bg-[#181924] hover:bg-[#202232] border border-[#2b2d3f] rounded-2xl px-3 py-1.5 transition cursor-pointer"
            >
              <div className="text-right hidden sm:block">
                <div className="text-xs font-black text-white flex items-center gap-1">
                  {currentUser.name}
                  {currentUser.isOwner && (
                    <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded">
                      المالك
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400">
                  {currentUser.isOwner ? 'كامل الصلاحيات' : currentUser.role === 'cashier' ? 'كاشير' : currentUser.role}
                </div>
              </div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-700 to-red-500 flex items-center justify-center font-bold text-white shadow-md border border-red-400/30">
                <User className="w-4 h-4" />
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          ) : (
            <button
              onClick={onOpenOwnerSetup}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition shadow-lg shadow-red-900/30 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>تسجيل الدخول</span>
            </button>
          )}

          {showUserMenu && currentUser && (
            <div className="absolute top-full mt-2 left-0 w-56 bg-[#161722] border border-[#2d3045] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2 border-b border-[#252839]">
                <div className="font-bold text-sm text-white">{currentUser.name}</div>
                <div className="text-xs text-gray-400 font-mono">{currentUser.phone}</div>
                <div className="text-[10px] text-red-400 mt-0.5">
                  {currentUser.isOwner ? 'المالك (وصول غير مقيد)' : `موظف: ${currentUser.role}`}
                </div>
              </div>

              {!currentUser.isOwner && (
                <button
                  onClick={() => {
                    setActiveView('employees');
                    setShowUserMenu(false);
                  }}
                  className="w-full text-right px-4 py-2 text-xs text-gray-300 hover:bg-red-950/30 hover:text-white"
                >
                  بوابتي الشخصية (راتبي، الأوفرتايم، الإجازات)
                </button>
              )}

              {currentUser.isOwner && (
                <button
                  onClick={() => {
                    setActiveView('settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full text-right px-4 py-2 text-xs text-gray-300 hover:bg-red-950/30 hover:text-white"
                >
                  إعدادات الأسعار والأمان
                </button>
              )}

              <button
                onClick={() => {
                  logoutUser();
                  setShowUserMenu(false);
                }}
                className="w-full text-right px-4 py-2 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 flex items-center gap-2 border-t border-[#252839] mt-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
