import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Gauge,
  Gamepad2,
  Building2,
  Receipt,
  Coffee,
  Package,
  Users,
  CalendarCheck2,
  BarChart3,
  Settings,
  Power,
  Lock,
  KeyRound
} from 'lucide-react';
import { playClickSound } from '../utils/sound';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  onLogoutClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onLogoutClick }) => {
  const { activeView, setActiveView, currentUser, logoutUser, rolePermissions } = useApp();

  const isOwner = Boolean(currentUser?.isOwner);
  const employeeRole = currentUser?.role || 'cashier';
  const perms = isOwner ? null : rolePermissions[employeeRole as 'cashier' | 'supervisor' | 'technician'];

  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: Gauge, allowed: true },
    { id: 'branches', label: 'الفروع', icon: Building2, allowed: isOwner || perms?.dashboard },
    { id: 'devices', label: 'الأجهزة والشاشات', icon: Gamepad2, allowed: isOwner || perms?.devices },
    { id: 'cashier', label: 'الكاشير والفواتير', icon: Receipt, allowed: isOwner || perms?.cashier },
    { id: 'bar', label: 'البوفيه والكافتيريا', icon: Coffee, allowed: isOwner || perms?.cashier },
    { id: 'inventory', label: 'المخزون والمنتجات', icon: Package, allowed: isOwner || perms?.inventory },
    { id: 'employees', label: 'الموظفين والرواتب', icon: Users, allowed: true },
    { id: 'shifts', label: 'الورديات والتسليم', icon: CalendarCheck2, allowed: true },
    { id: 'reports', label: 'التقارير وتصدير PDF', icon: BarChart3, allowed: isOwner || perms?.reports },
    { id: 'settings', label: 'الأسعار وقاعدة البيانات', icon: Settings, allowed: isOwner || perms?.settings },
    { id: 'branchAccess', label: 'صلاحيات حسابات الفروع', icon: KeyRound, allowed: isOwner },
  ];

  const handleNavClick = (viewId: string) => {
    playClickSound();
    setActiveView(viewId);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static top-0 right-0 h-full w-64 bg-[#101117] border-l border-[#202230] flex flex-col justify-between shrink-0 select-none z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div>
          <div className="p-5 border-b border-[#1c1d28] flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-950/60 border border-red-500/40">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 6C4.24 6 2 8.24 2 11c0 2.22 1.45 4.1 3.47 4.74l1.37 4.09C7.14 20.72 8 21 8.8 21c1.07 0 1.95-.57 2.45-1.45L13.1 16h-2.2l-1.3-3H7v-2h2.6l1-2H7V7h4.4l1-1H7zm10 0h-4.4l-1 1H17v2h-2.6l-1 2H17v2h-2.6l1.3 3h-2.2l1.85 3.55C15.85 20.43 16.73 21 17.8 21c.8 0 1.66-.28 1.96-1.17l1.37-4.09C23.15 15.1 24.6 13.22 24.6 11c0-2.76-2.24-5-5-5h-2.6zM6 10a1 1 0 110 2 1 1 0 010-2zm12 0a1 1 0 110 2 1 1 0 010-2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black text-white tracking-wider">LIVERPOOL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-red-500 tracking-widest">GAMING</span>
                <span className="text-[10px] text-gray-400 font-medium font-mono">| PS CENTER</span>
              </div>
            </div>
          </div>

          {/* PlayStation Symbols Accent Row */}
          <div className="flex items-center justify-center gap-3 py-2 border-b border-[#181924] text-xs font-black text-gray-500 font-mono">
            <span className="text-emerald-400">▲</span>
            <span className="text-red-500">●</span>
            <span className="text-blue-400">✖</span>
            <span className="text-purple-400">■</span>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 mt-1 max-h-[calc(100vh-230px)] overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              const isAllowed = item.allowed;

              if (!isAllowed) {
                return (
                  <div
                    key={item.id}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-gray-600 text-xs font-semibold cursor-not-allowed opacity-50"
                    title="غير مصرح لهذا الدور"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <Lock className="w-3 h-3 text-gray-600" />
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition text-right cursor-pointer group ${
                    isActive
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-900/40 border-r-4 border-white'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-[#181924]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-gray-400 group-hover:text-red-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-[#1c1d28] bg-[#0e0f15]">
          {currentUser ? (
            <div className="mb-2 p-2.5 bg-[#161722] rounded-xl border border-[#232535] text-xs">
              <div className="text-[10px] text-gray-400 font-medium">المستخدم الحالي:</div>
              <div className="text-white font-bold truncate flex items-center justify-between">
                <span>{currentUser.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-600 text-white font-mono">
                  {currentUser.isOwner ? 'المالك' : currentUser.role}
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-2 p-2 bg-red-950/40 rounded-xl border border-red-500/30 text-[11px] text-red-300 text-center font-bold">
              يرجى تسجيل الدخول
            </div>
          )}

          <button
            onClick={() => {
              playClickSound();
              if (onLogoutClick) {
                onLogoutClick();
              } else {
                logoutUser();
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-950/30 transition text-xs font-bold border border-transparent hover:border-red-900/40 cursor-pointer"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{currentUser ? 'تسجيل الخروج' : 'تسجيل الدخول / مالك'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
