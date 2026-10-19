/**
 * Liverpool Gaming - PlayStation Gaming Center Management OS
 * Main App Container
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { BranchesView } from './components/BranchesView';
import { DevicesView } from './components/DevicesView';
import { CashierView } from './components/CashierView';
import { BarPOSView } from './components/BarPOSView';
import { InventoryView } from './components/InventoryView';
import { ShiftHandoverView } from './components/ShiftHandoverView';
import { EmployeesView } from './components/EmployeesView';
import { ReportsView } from './components/ReportsView';
import { PricingSettingsView } from './components/PricingSettingsView';
import { BranchAccessView } from './components/BranchAccessView';
import { StartSessionModal } from './components/StartSessionModal';
import { SessionDetailModal } from './components/SessionDetailModal';
import { TransferSessionModal } from './components/TransferSessionModal';
import { NotificationsModal } from './components/NotificationsModal';
import { OwnerSetupModal } from './components/OwnerSetupModal';
import { QuickStartGuideModal } from './components/QuickStartGuideModal';
import { ExpenseModal } from './components/ExpenseModal';
import { Device, GameSession } from './types';
import { ShieldCheck, HelpCircle } from 'lucide-react';
import { playClickSound } from './utils/sound';

const MainLayout: React.FC = () => {
  const {
    activeView,
    setActiveView,
    ownerProfile,
    themeAccent,
    sessions,
    devices,
  } = useApp();

  // Modals state
  const [isOwnerSetupOpen, setIsOwnerSetupOpen] = useState(!ownerProfile);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isQuickGuideOpen, setIsQuickGuideOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedDeviceForStart, setSelectedDeviceForStart] = useState<Device | null>(null);
  const [selectedSessionForDetails, setSelectedSessionForDetails] = useState<{
    session: GameSession;
    device: Device;
  } | null>(null);
  const [selectedDeviceForTransfer, setSelectedDeviceForTransfer] = useState<Device | null>(null);
  const [sessionToCheckoutAtCashier, setSessionToCheckoutAtCashier] = useState<GameSession | null>(null);

  const handleStartSessionClick = (device: Device) => {
    playClickSound();
    setSelectedDeviceForStart(device);
  };

  const handleOpenSessionDetails = (session: GameSession, device: Device) => {
    playClickSound();
    setSelectedSessionForDetails({ session, device });
  };

  const handleTransferClick = (device: Device) => {
    playClickSound();
    setSelectedDeviceForTransfer(device);
  };

  const handleCheckoutFromDetails = (session: GameSession) => {
    setSelectedSessionForDetails(null);
    setSessionToCheckoutAtCashier(session);
    setActiveView('cashier');
  };

  return (
    <div className={`min-h-screen bg-[#0d0e14] text-[#e0e2ec] flex flex-col font-['Cairo',sans-serif] theme-${themeAccent}`}>
      {/* Top Header */}
      <Header
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenOwnerSetup={() => setIsOwnerSetupOpen(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onOpenGuide={() => setIsQuickGuideOpen(true)}
        onOpenExpense={() => setIsExpenseModalOpen(true)}
      />

      {/* Main Container with Sidebar + View */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Right Sidebar (RTL) */}
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogoutClick={() => setIsOwnerSetupOpen(true)}
        />

        {/* Dynamic Main View Area */}
        <main className="flex-1 overflow-y-auto bg-[#0d0e14]">
          {/* Welcome Alert for initial setup if no owner yet */}
          {!ownerProfile && (
            <div className="m-4 md:m-8 p-6 bg-gradient-to-r from-red-950/60 via-red-900/30 to-[#14151f] border-2 border-red-600 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-950/80 shrink-0">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">مرحباً بك في منظومة Liverpool Gaming</h3>
                  <p className="text-xs text-red-200 mt-1 max-w-xl leading-relaxed">
                    النظام جاهز للتشغيل. يرجى تهيئة المالك الرئيسي لتفعيل الأمان والصلاحيات وإدارة الشاشات والفروع والورديات.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    playClickSound();
                    setIsQuickGuideOpen(true);
                  }}
                  className="px-5 py-3 bg-[#1d1f2e] hover:bg-[#282a3e] text-white font-bold text-xs rounded-2xl transition border border-red-500/40 flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <HelpCircle className="w-4 h-4 text-red-400" />
                  <span>دليل البدء السريع</span>
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    setIsOwnerSetupOpen(true);
                  }}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-2xl transition shadow-xl shadow-red-950/80 cursor-pointer shrink-0"
                >
                  تهيئة المالك والبدء الآن
                </button>
              </div>
            </div>
          )}

          {/* View Routing */}
          {activeView === 'dashboard' && (
            <DashboardView
              onSelectDeviceForSession={handleStartSessionClick}
              onOpenSessionDetails={handleOpenSessionDetails}
              onTransferDevice={handleTransferClick}
            />
          )}

          {activeView === 'branches' && <BranchesView />}
          {activeView === 'devices' && <DevicesView />}
          {activeView === 'cashier' && (
            <CashierView
              initialSessionToCheckout={sessionToCheckoutAtCashier}
              onCheckoutComplete={() => setSessionToCheckoutAtCashier(null)}
            />
          )}
          {activeView === 'bar' && <BarPOSView />}
          {activeView === 'inventory' && <InventoryView />}
          {activeView === 'shifts' && <ShiftHandoverView />}
          {activeView === 'employees' && <EmployeesView />}
          {activeView === 'reports' && <ReportsView />}
          {activeView === 'settings' && <PricingSettingsView />}
          {activeView === 'branchAccess' && <BranchAccessView />}
        </main>
      </div>

      {/* Global Modals */}
      {selectedDeviceForStart && (
        <StartSessionModal
          device={selectedDeviceForStart}
          isOpen={Boolean(selectedDeviceForStart)}
          onClose={() => setSelectedDeviceForStart(null)}
          onStarted={() => {
            setSelectedDeviceForStart(null);
          }}
        />
      )}

      {selectedSessionForDetails && (
        <SessionDetailModal
          session={sessions.find(s => s.id === selectedSessionForDetails.session.id) || selectedSessionForDetails.session}
          device={devices.find(d => d.id === selectedSessionForDetails.device.id) || selectedSessionForDetails.device}
          isOpen={Boolean(selectedSessionForDetails)}
          onClose={() => setSelectedSessionForDetails(null)}
          onCheckout={handleCheckoutFromDetails}
          onTransfer={device => {
            setSelectedSessionForDetails(null);
            setSelectedDeviceForTransfer(device);
          }}
        />
      )}

      {selectedDeviceForTransfer && (
        <TransferSessionModal
          fromDevice={selectedDeviceForTransfer}
          isOpen={Boolean(selectedDeviceForTransfer)}
          onClose={() => setSelectedDeviceForTransfer(null)}
          onSuccess={() => setSelectedDeviceForTransfer(null)}
        />
      )}

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      <OwnerSetupModal
        isOpen={isOwnerSetupOpen}
        onClose={() => setIsOwnerSetupOpen(false)}
      />

      <QuickStartGuideModal
        isOpen={isQuickGuideOpen}
        onClose={() => setIsQuickGuideOpen(false)}
        onNavigate={view => {
          setIsQuickGuideOpen(false);
          setActiveView(view);
        }}
      />

      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
