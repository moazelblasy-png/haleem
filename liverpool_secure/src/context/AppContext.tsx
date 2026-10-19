/**
 * Liverpool Gaming - Global Application State Context
 * Handles persistence, offline queue, authentication, multi-branch, real-time session monitor,
 * audio alarm triggers (5-min warning, session-end, periodic overdue), employee passwords, deductions, and shift carry-overs.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  User,
  OwnerProfile,
  Branch,
  Device,
  GameSession,
  WaitlistItem,
  InventoryItem,
  Shift,
  SafeTransaction,
  Employee,
  RolePermissions,
  AuditLogEntry,
  OfflineAction,
  SystemNotification,
  DeviceType,
  ControllersCount,
  Deduction,
  LeaveRequest,
  PriceTier,
  SplitPaymentPortion
} from '../types';
import {
  DEFAULT_PRICE_TIERS,
  RoundingPolicy,
  calculateSessionGamingCost,
  calculatePaymentBalance,
  calculateInvoiceTotals
} from '../logic/pricing';
import { calculateInvoice, settleDebtPayment } from '../logic/invoicing';
import { validateSessionTransfer, executeSessionTransfer } from '../logic/transfer';
import { hashPinOrPassword, verifyPinOrPassword } from '../utils/security';
import { calculateShiftClosing, HandoverChecklist } from '../logic/shift';
import {
  playFiveMinuteWarningSound,
  playSessionFinishedAlarm,
  playOverdueReminderBeep,
  playClickSound,
  playCashSound
} from '../utils/sound';

const STORAGE_KEYS = {
  OWNER: 'lg_owner_profile',
  BRANCHES: 'lg_branches',
  ACTIVE_BRANCH: 'lg_active_branch_id',
  CURRENT_USER: 'lg_current_user',
  DEVICES: 'lg_devices',
  SESSIONS: 'lg_sessions',
  WAITLIST: 'lg_waitlist',
  INVENTORY: 'lg_inventory',
  SHIFTS: 'lg_shifts',
  ACTIVE_SHIFT: 'lg_active_shift_id',
  SAFE_TXS: 'lg_safe_txs',
  EMPLOYEES: 'lg_employees',
  PERMISSIONS: 'lg_role_permissions',
  AUDIT_LOG: 'lg_audit_log',
  OFFLINE_QUEUE: 'lg_offline_queue',
  PRICING_TIERS: 'lg_pricing_tiers',
  ROUNDING_POLICY: 'lg_rounding_policy',
  NOTIFICATIONS: 'lg_notifications',
  APP_LANG: 'lg_app_language',
  THEME_ACCENT: 'lg_theme_accent',
  SUPABASE_CONFIG: 'lg_supabase_config',
};

const CLOUD_STATE_KEYS = [
  STORAGE_KEYS.BRANCHES,
  STORAGE_KEYS.ACTIVE_BRANCH,
  STORAGE_KEYS.DEVICES,
  STORAGE_KEYS.SESSIONS,
  STORAGE_KEYS.WAITLIST,
  STORAGE_KEYS.SHIFTS,
  STORAGE_KEYS.ACTIVE_SHIFT,
  STORAGE_KEYS.SAFE_TXS,
  STORAGE_KEYS.EMPLOYEES,
  STORAGE_KEYS.PERMISSIONS,
  STORAGE_KEYS.AUDIT_LOG,
  STORAGE_KEYS.OFFLINE_QUEUE,
  STORAGE_KEYS.PRICING_TIERS,
  STORAGE_KEYS.ROUNDING_POLICY,
  STORAGE_KEYS.NOTIFICATIONS,
] as const;

// 3 Default branches: Liverpool, Chelsea, Anfield (replacing Arsenal per User request!)
const DEFAULT_BRANCHES: Branch[] = [
  {
    id: 'liverpool',
    name: 'Liverpool',
    nameAr: 'ليفربول',
    code: 'LIV',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/300px-Liverpool_FC.svg.png',
    address: 'الفرع الرئيسي - شارع النصر',
    phone: '01012345678',
    isActive: true,
  },
  {
    id: 'chelsea',
    name: 'Chelsea',
    nameAr: 'تشيلسي',
    code: 'CHE',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/300px-Chelsea_FC.svg.png',
    address: 'فرع تشيلسي - شارع الثورة',
    phone: '01123456789',
    isActive: true,
  },
  {
    id: 'anfield',
    name: 'Anfield',
    nameAr: 'أنفيلد',
    code: 'ANF',
    logo: 'https://i.pinimg.com/736x/12/5e/e4/125ee4a892bbd044702b0268262b3a8d.jpg',
    address: 'فرع أنفيلد - ميدان الساعة',
    phone: '01234567890',
    isActive: true,
  },
];

const DEFAULT_ROLE_PERMISSIONS: Record<'cashier' | 'supervisor' | 'technician', RolePermissions> = {
  cashier: {
    dashboard: true,
    cashier: true,
    devices: false,
    inventory: false,
    reports: false,
    settings: false,
    viewProfits: false,
    editPrices: false,
    approveOvertime: false,
    manageEmployees: false,
    recordExpenses: true,
  },
  supervisor: {
    dashboard: true,
    cashier: true,
    devices: true,
    inventory: true,
    reports: true,
    settings: false,
    viewProfits: false,
    editPrices: false,
    approveOvertime: false,
    manageEmployees: false,
    recordExpenses: true,
  },
  technician: {
    dashboard: true,
    cashier: false,
    devices: true,
    inventory: true,
    reports: false,
    settings: false,
    viewProfits: false,
    editPrices: false,
    approveOvertime: false,
    manageEmployees: false,
    recordExpenses: false,
  },
};

const DEFAULT_CATALOGUE_ITEMS: Omit<InventoryItem, 'id' | 'branchId'>[] = [
  { name: 'إندومي بالخضار', category: 'food', sellingPrice: 15, costPrice: 8, stockQuantity: 25, minStockThreshold: 10 },
  { name: 'إندومي باللحم', category: 'food', sellingPrice: 20, costPrice: 11, stockQuantity: 25, minStockThreshold: 10 },
  { name: 'شاي أحمر كلاسيك', category: 'hot_drinks', sellingPrice: 10, costPrice: 2, stockQuantity: 40, minStockThreshold: 15 },
  { name: 'قهوة تركي مخصوص', category: 'hot_drinks', sellingPrice: 15, costPrice: 4, stockQuantity: 35, minStockThreshold: 15 },
  { name: 'نسكافيه 3 في 1', category: 'hot_drinks', sellingPrice: 20, costPrice: 6, stockQuantity: 30, minStockThreshold: 10 },
  { name: 'بيبسي كانز 330 مل', category: 'cold_drinks', sellingPrice: 20, costPrice: 12, stockQuantity: 50, minStockThreshold: 20 },
  { name: 'شيبسي عائلي', category: 'snacks', sellingPrice: 20, costPrice: 13, stockQuantity: 30, minStockThreshold: 15 },
];

const DEFAULT_INSTALLED_GAMES = ['FC 24', 'GTA V', 'Call of Duty: MW III', 'eFootball 2024'];

function createDefaultDevicesForBranch(branchId: string): Device[] {
  const deviceCount = branchId === 'chelsea' ? 8 : 7;
  const types: DeviceType[] = ['PS4', 'PS5', 'PS4', 'PS5', 'PS4', 'PS5', 'PS4', 'PS5'];
  return Array.from({ length: deviceCount }, (_, index) => {
    const number = index + 1;
    const type = types[index];
    return {
      id: `${branchId}-dev-${String(number).padStart(2, '0')}`,
      screenNumber: `شاشة ${String(number).padStart(2, '0')}`,
      name: `${type} - شاشة ${String(number).padStart(2, '0')}`,
      branchId,
      type,
      status: 'available' as const,
      installedGames: DEFAULT_INSTALLED_GAMES,
    };
  });
}

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (err) {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastSyncTime?: number;
}

interface AppContextType {
  // State
  ownerProfile: OwnerProfile | null;
  currentUser: User | null;
  branches: Branch[];
  activeBranch: Branch | null;
  devices: Device[];
  sessions: GameSession[];
  waitlist: WaitlistItem[];
  inventory: InventoryItem[];
  shifts: Shift[];
  activeShift: Shift | null;
  safeTransactions: SafeTransaction[];
  employees: Employee[];
  rolePermissions: Record<'cashier' | 'supervisor' | 'technician', RolePermissions>;
  auditLog: AuditLogEntry[];
  offlineQueue: OfflineAction[];
  pricingTiers: PriceTier[];
  roundingPolicy: RoundingPolicy;
  notifications: SystemNotification[];
  isOnline: boolean;
  activeView: string;
  appLang: 'ar' | 'en';
  themeAccent: 'red' | 'blue' | 'emerald' | 'purple' | 'amber';
  supabaseConfig: SupabaseConfig;

  // Actions
  setActiveView: (view: string) => void;
  setActiveBranchId: (id: string) => void;
  setAppLang: (lang: 'ar' | 'en') => void;
  setThemeAccent: (theme: 'red' | 'blue' | 'emerald' | 'purple' | 'amber') => void;
  updateSupabaseConfig: (config: Partial<SupabaseConfig>) => void;
  setupPrimaryOwner: (ownerData: { name: string; phone: string; pinOrPassword: string; enable2FA?: boolean }) => boolean;
  registerOwnerAccount: (data: { name: string; phone: string; email: string; password: string; bootstrapCode: string }) => Promise<{ success: boolean; message: string; requiresEmailConfirmation?: boolean }>;
  resendOwnerConfirmation: (email: string) => Promise<{ success: boolean; message: string }>;
  loginWithSupabase: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  loginUser: (phone: string, pin: string) => { success: boolean; message: string; requires2FA?: boolean };
  verify2FACode: (code: string) => boolean;
  logoutUser: () => void;
  verifyOwnerPin: (pin: string) => boolean;

  // Branches
  addBranch: (branchData: Omit<Branch, 'id' | 'isActive'>) => Branch;
  updateBranch: (id: string, updates: Partial<Branch>) => void;

  // Devices & Sessions
  addDevice: (device: Omit<Device, 'id' | 'status'>) => Device;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  deleteDevice: (id: string) => void;
  populateDefaultBranchDevices: (branchId: string) => void;
  startSession: (data: {
    deviceId: string;
    customerName: string;
    customerPhone?: string;
    gameName: string;
    sessionType: 'open' | 'timed' | 'budget';
    controllers: ControllersCount;
    plannedDurationMinutes?: number;
    budgetEgp?: number;
    isPrepaid?: boolean;
    paidAmount?: number;
    paymentMethod?: 'cash' | 'instapay' | 'vodafone' | 'card';
  }) => Promise<GameSession>;
  changeSessionControllers: (sessionId: string, newCount: ControllersCount) => void;
  addSessionProduct: (sessionId: string, productId: string, quantity: number, isPaid: boolean) => void;
  markProductPaid: (sessionId: string, sessionProductId: string) => void;
  transferSession: (fromDeviceId: string, toDeviceId: string, reason?: string) => { success: boolean; message: string };
  switchSessionDeviceType: (sessionId: string, newType: DeviceType) => void;
  completeSession: (sessionId: string, checkoutData: {
    discountType: 'none' | 'fixed' | 'percent';
    discountValue: number;
    paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card' | 'split';
    amountReceived: number;
    splitPayments?: SplitPaymentPortion[];
  }) => Promise<{ success: boolean; invoice: GameSession }>;
  collectSessionDebt: (sessionId: string, amount: number, paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card') => Promise<{ success: boolean; message: string; remainingDebt: number }>;
  updateEmployeePermissions: (employeeId: string, permissions: RolePermissions) => void;

  // Waitlist
  addToWaitlist: (item: Omit<WaitlistItem, 'id' | 'createdAt' | 'status'>) => WaitlistItem;
  updateWaitlistItemStatus: (id: string, status: WaitlistItem['status']) => void;

  // Inventory / Bar
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<InventoryItem>;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  sellBarItemDirect: (productId: string, quantity: number, paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card') => Promise<boolean>;
  sellBarItems: (items: Array<{ productId: string; quantity: number }>, paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card') => Promise<{ success: boolean; total?: number; message?: string }>; 
  initializeDefaultCatalogueForBranch: (branchId: string) => Promise<void>;

  // Shifts & Safe
  startShiftHandover: (openingCash: number, checklist: HandoverChecklist, notes?: string) => Shift;
  closeShift: (actualClosingCash: number, ownerPin: string, notes?: string) => { success: boolean; message: string; discrepancy?: number };
  recordSafeTransaction: (data: Omit<SafeTransaction, 'id' | 'shiftId' | 'branchId' | 'timestamp' | 'performedBy'>) => Promise<void>;

  // Staff & HR & Password Control
  addEmployee: (employee: Omit<Employee, 'id' | 'joinedDate' | 'overtimeRequests' | 'advanceRequests' | 'attendanceLogs' | 'deductions' | 'leaveRequests'>) => Employee;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  transferEmployeeBranch: (employeeId: string, targetBranchId: string) => { success: boolean; message: string };
  updateEmployeePassword: (employeeId: string, newPin: string) => void;
  addEmployeeDeduction: (employeeId: string, amount: number, reason: string) => void;
  requestLeave: (employeeId: string, daysCount: number, reason: string) => void;
  reviewLeaveRequest: (employeeId: string, requestId: string, approve: boolean) => void;
  requestOvertime: (employeeId: string, hours: number, hourlyRate: number, reason: string) => void;
  reviewOvertimeRequest: (employeeId: string, requestId: string, approve: boolean) => void;
  recordAttendance: (employeeId: string, status: 'present' | 'absent' | 'late' | 'excused', delayMinutes?: number) => void;
  clockInEmployee: (employeeId: string) => void;
  clockOutEmployee: (employeeId: string) => void;

  // Pricing & Settings
  updatePricingTier: (tierId: string, newPriceEgp: number) => void;
  setRoundingPolicy: (policy: RoundingPolicy) => void;
  updateRolePermissions: (role: 'cashier' | 'supervisor' | 'technician', permissions: RolePermissions) => void;

  // Offline & Audit
  syncOfflineQueue: () => void;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
  addNotification: (notification: Omit<SystemNotification, 'id' | 'timestamp' | 'isRead'>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State loaders
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(() => loadLocal(STORAGE_KEYS.OWNER, null));
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadLocal(STORAGE_KEYS.CURRENT_USER, null));
  const [branches, setBranches] = useState<Branch[]>(() => loadLocal(STORAGE_KEYS.BRANCHES, DEFAULT_BRANCHES));
  const [activeBranchId, setActiveBranchIdState] = useState<string>(() => loadLocal(STORAGE_KEYS.ACTIVE_BRANCH, 'liverpool'));
  const [devices, setDevices] = useState<Device[]>(() => loadLocal(STORAGE_KEYS.DEVICES, []));
  const [sessions, setSessions] = useState<GameSession[]>(() => loadLocal(STORAGE_KEYS.SESSIONS, []));
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>(() => loadLocal(STORAGE_KEYS.WAITLIST, []));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadLocal(STORAGE_KEYS.INVENTORY, []));
  const [shifts, setShifts] = useState<Shift[]>(() => loadLocal(STORAGE_KEYS.SHIFTS, []));
  const [activeShiftId, setActiveShiftId] = useState<string | null>(() => loadLocal(STORAGE_KEYS.ACTIVE_SHIFT, null));
  const [safeTransactions, setSafeTransactions] = useState<SafeTransaction[]>(() => loadLocal(STORAGE_KEYS.SAFE_TXS, []));
  const [employees, setEmployees] = useState<Employee[]>(() => loadLocal(STORAGE_KEYS.EMPLOYEES, []));
  const [rolePermissions, setRolePermissions] = useState<Record<'cashier' | 'supervisor' | 'technician', RolePermissions>>(
    () => loadLocal(STORAGE_KEYS.PERMISSIONS, DEFAULT_ROLE_PERMISSIONS)
  );
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => loadLocal(STORAGE_KEYS.AUDIT_LOG, []));
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>(() => loadLocal(STORAGE_KEYS.OFFLINE_QUEUE, []));
  const [pricingTiers, setPricingTiers] = useState<PriceTier[]>(() => loadLocal(STORAGE_KEYS.PRICING_TIERS, DEFAULT_PRICE_TIERS));
  const [roundingPolicy, setRoundingPolicyState] = useState<RoundingPolicy>(() => loadLocal(STORAGE_KEYS.ROUNDING_POLICY, 'ceil_quarter'));
  const [notifications, setNotifications] = useState<SystemNotification[]>(() => loadLocal(STORAGE_KEYS.NOTIFICATIONS, []));
  const [appLang, setAppLangState] = useState<'ar' | 'en'>(() => loadLocal(STORAGE_KEYS.APP_LANG, 'ar'));
  const [themeAccent, setThemeAccentState] = useState<'red' | 'blue' | 'emerald' | 'purple' | 'amber'>(
    () => loadLocal(STORAGE_KEYS.THEME_ACCENT, 'red')
  );
  const [supabaseConfig, setSupabaseConfigState] = useState<SupabaseConfig>(() =>
    loadLocal(STORAGE_KEYS.SUPABASE_CONFIG, {
      url: '',
      anonKey: '',
      isConnected: false,
    })
  );

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [activeView, setActiveView] = useState<string>('dashboard');
  const completedSessionIds = useRef(new Set<string>());
  const cloudHydratedRef = useRef(false);
  const cloudVersionsRef = useRef<Record<string, number>>({});
  const cloudSaveQueuesRef = useRef<Record<string, Promise<void>>>({});
  const saleIdempotencyKeyRef = useRef<string | null>(null);

  // Read only the token belonging to the identity currently signed in through Supabase Auth.
  // A local employee PIN must never inherit a previous owner's browser token.
  const cloudAuthUserIdRef = useRef<string | null>(null);
  const getSupabaseAccessToken = useCallback((): string | null => {
    try {
      const expectedUserId = cloudAuthUserIdRef.current || currentUser?.id;
      if (!expectedUserId) return null;

      const ownSession = JSON.parse(localStorage.getItem('lg_supabase_session') || 'null');
      if (typeof ownSession?.access_token === 'string' &&
          ownSession.access_token.length > 20 &&
          ownSession.user?.id === expectedUserId) {
        return ownSession.access_token;
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        const session = value?.currentSession || value?.session || value;
        if (typeof session?.access_token === 'string' &&
            session.access_token.length > 20 &&
            session.user?.id === expectedUserId) return session.access_token;
      }
    } catch {}
    return null;
  }, [currentUser]);

  const apiHeaders = useCallback((extra: Record<string, string> = {}): Record<string, string> => {
    const token = getSupabaseAccessToken();
    return { Accept: 'application/json', ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }, [getSupabaseAccessToken]);

  const supabaseAuthRequest = useCallback(async (path: string, body: unknown) => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!url || !key) throw new Error('إعدادات Supabase غير موجودة في ملف .env');
    const response = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/${path}`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    const rawMessage = payload.msg || payload.message || payload.error_description || payload.error || '';
    const authMessage = typeof rawMessage === 'string' ? rawMessage : String(rawMessage?.message || '');
    const authCode = String(payload.error_code || payload.code || payload.error?.code || '').toLowerCase();
    if (!response.ok) {
      if (authCode === 'over_email_send_rate_limit' || /email rate limit exceeded|over_email_send_rate_limit/i.test(authMessage)) {
        throw new Error('وصلنا للحد المؤقت لإرسال رسائل التأكيد. لا تعِد إنشاء الحساب؛ افتح رسالة التأكيد الموجودة في بريدك الوارد أو مجلد Spam، ثم جرّب الدخول بعد تأكيد البريد.');
      }
      if (authCode === 'email_not_confirmed' || /email not confirmed/i.test(authMessage)) {
        throw new Error('الحساب اتعمل بالفعل لكن البريد الإلكتروني لم يتم تأكيده. افتح رسالة التأكيد في البريد الوارد أو Spam، ثم حاول تسجيل الدخول.');
      }
      if (authCode === 'invalid_credentials' || /invalid login credentials/i.test(authMessage)) {
        throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة. لو أنشأت الحساب للتو، أكّد البريد الإلكتروني من رسالة التأكيد أولًا.');
      }
      throw new Error(authMessage || 'فشل تسجيل الدخول');
    }
    return payload;
  }, []);

  const resendOwnerConfirmation = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return { success: false, message: 'أدخل البريد الإلكتروني أولًا.' };
    try {
      await supabaseAuthRequest('resend', { type: 'signup', email: normalizedEmail });
      return { success: true, message: 'تم طلب إعادة إرسال رسالة التأكيد. راجع البريد الوارد ومجلد Spam.' };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'تعذر إعادة إرسال رسالة التأكيد.' };
    }
  }, [supabaseAuthRequest]);

  const apiRequest = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(path, { ...init, headers: apiHeaders({ 'Content-Type': 'application/json', ...((init.headers || {}) as Record<string, string>) }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload?.error?.message || `فشل طلب الخادم (${response.status})`) as Error & { status?: number; code?: string };
      error.status = response.status;
      error.code = payload?.error?.code;
      throw error;
    }
    return payload as T;
  }, [apiHeaders]);

  // Notification helper
  const addNotification = useCallback((data: Omit<SystemNotification, 'id' | 'timestamp' | 'isRead'>) => {
    const notif: SystemNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      isRead: false,
      ...data,
    };
    setNotifications(prev => [notif, ...prev]);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const persistState = useCallback(<T,>(key: string, value: T) => {
    saveLocal(key, value);
    if (!cloudHydratedRef.current || !CLOUD_STATE_KEYS.includes(key as typeof CLOUD_STATE_KEYS[number])) return;
    const role = currentUser?.role;
    if (role && !['owner', 'admin'].includes(role)) {
      const ownerOnlyKeys = [
        STORAGE_KEYS.SESSIONS,
        STORAGE_KEYS.ACTIVE_SHIFT,
        STORAGE_KEYS.SAFE_TXS,
        STORAGE_KEYS.EMPLOYEES,
        STORAGE_KEYS.PERMISSIONS,
        STORAGE_KEYS.AUDIT_LOG,
        STORAGE_KEYS.OFFLINE_QUEUE,
        STORAGE_KEYS.PRICING_TIERS,
        STORAGE_KEYS.ROUNDING_POLICY,
        STORAGE_KEYS.NOTIFICATIONS,
      ];
      if (ownerOnlyKeys.includes(key as typeof ownerOnlyKeys[number])) return;
      if (role === 'cashier' && key === STORAGE_KEYS.DEVICES) return;
    }
    const token = getSupabaseAccessToken();
    if (!token) return; // Local PIN login is not a server-authenticated session.

    // Serialize writes per key so rapid updates don't race with the same expectedVersion.
    const previous = cloudSaveQueuesRef.current[key] || Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      const response = await fetch(`/api/state/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ value, expectedVersion: cloudVersionsRef.current[key] ?? 0 }),
      });
      if (response.status === 409) {
        addNotification({ title: 'تعارض في المزامنة', message: 'البيانات تغيرت على جهاز آخر. حدّث البيانات قبل إعادة المحاولة.', type: 'warning' });
        return;
      }
      if (!response.ok) throw new Error(`Cloud save failed (${response.status})`);
      const result = await response.json();
      if (Number.isSafeInteger(result.version)) cloudVersionsRef.current[key] = result.version;
    }).catch(() => {
      addNotification({ title: 'تعذرت المزامنة السحابية', message: 'تم الاحتفاظ بالتغييرات على هذا الجهاز، لكن لم يتأكد حفظها على الخادم. افحص الاتصال وأعد المزامنة.', type: 'warning' });
    });
    cloudSaveQueuesRef.current[key] = next;
  }, [getSupabaseAccessToken, apiHeaders, addNotification]);

  // Network listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Hydrate shared operational data from the server once, then continue writing locally and remotely.
  useEffect(() => {
    let cancelled = false;
    const hydrateCloudState = async () => {
      try {
        const token = getSupabaseAccessToken();
        if (!token) return; // Do not treat the local PIN as API authentication.
        const response = await fetch('/api/state', { headers: apiHeaders() });
        if (!response.ok) throw new Error('Cloud state unavailable');
        const payload = await response.json() as { state?: Record<string, unknown>; versions?: Record<string, number> };
        const state = payload.state || {};
        cloudVersionsRef.current = payload.versions || {};
        if (cancelled) return;

        if (Object.keys(state).length === 0) {
          // Empty cloud state is not proof that local data is disposable. Preserve it.
          cloudHydratedRef.current = true;
        } else {
          if (state[STORAGE_KEYS.BRANCHES] !== undefined) setBranches(state[STORAGE_KEYS.BRANCHES] as Branch[]);
          if (state[STORAGE_KEYS.ACTIVE_BRANCH] !== undefined) setActiveBranchIdState(state[STORAGE_KEYS.ACTIVE_BRANCH] as string);
          if (state[STORAGE_KEYS.DEVICES] !== undefined) setDevices(state[STORAGE_KEYS.DEVICES] as Device[]);
          if (state[STORAGE_KEYS.SESSIONS] !== undefined) setSessions(state[STORAGE_KEYS.SESSIONS] as GameSession[]);
          if (state[STORAGE_KEYS.WAITLIST] !== undefined) setWaitlist(state[STORAGE_KEYS.WAITLIST] as WaitlistItem[]);
          if (state[STORAGE_KEYS.SHIFTS] !== undefined) setShifts(state[STORAGE_KEYS.SHIFTS] as Shift[]);
          if (state[STORAGE_KEYS.ACTIVE_SHIFT] !== undefined) setActiveShiftId(state[STORAGE_KEYS.ACTIVE_SHIFT] as string | null);
          if (state[STORAGE_KEYS.SAFE_TXS] !== undefined) setSafeTransactions(state[STORAGE_KEYS.SAFE_TXS] as SafeTransaction[]);
          if (state[STORAGE_KEYS.EMPLOYEES] !== undefined) setEmployees(state[STORAGE_KEYS.EMPLOYEES] as Employee[]);
          if (state[STORAGE_KEYS.PERMISSIONS] !== undefined) setRolePermissions(state[STORAGE_KEYS.PERMISSIONS] as typeof DEFAULT_ROLE_PERMISSIONS);
          if (state[STORAGE_KEYS.AUDIT_LOG] !== undefined) setAuditLog(state[STORAGE_KEYS.AUDIT_LOG] as AuditLogEntry[]);
          if (state[STORAGE_KEYS.OFFLINE_QUEUE] !== undefined) setOfflineQueue(state[STORAGE_KEYS.OFFLINE_QUEUE] as OfflineAction[]);
          if (state[STORAGE_KEYS.PRICING_TIERS] !== undefined) setPricingTiers(state[STORAGE_KEYS.PRICING_TIERS] as PriceTier[]);
          if (state[STORAGE_KEYS.ROUNDING_POLICY] !== undefined) setRoundingPolicyState(state[STORAGE_KEYS.ROUNDING_POLICY] as RoundingPolicy);
          if (state[STORAGE_KEYS.NOTIFICATIONS] !== undefined) setNotifications(state[STORAGE_KEYS.NOTIFICATIONS] as SystemNotification[]);
        }
        setIsOnline(true);
      } catch {
        // The app remains usable offline and its local copy is retained.
      } finally {
        if (!cancelled) cloudHydratedRef.current = true;
      }
    };
    void hydrateCloudState();
    return () => { cancelled = true; };
  }, []);

  // Sync to LocalStorage and Supabase-backed state API.
  useEffect(() => persistState(STORAGE_KEYS.OWNER, ownerProfile), [ownerProfile, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.CURRENT_USER, currentUser), [currentUser, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.BRANCHES, branches), [branches, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.ACTIVE_BRANCH, activeBranchId), [activeBranchId, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.DEVICES, devices), [devices, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.SESSIONS, sessions), [sessions, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.WAITLIST, waitlist), [waitlist, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.INVENTORY, inventory), [inventory, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.SHIFTS, shifts), [shifts, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.ACTIVE_SHIFT, activeShiftId), [activeShiftId, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.SAFE_TXS, safeTransactions), [safeTransactions, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.EMPLOYEES, employees), [employees, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.PERMISSIONS, rolePermissions), [rolePermissions, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.AUDIT_LOG, auditLog), [auditLog, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.OFFLINE_QUEUE, offlineQueue), [offlineQueue, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.PRICING_TIERS, pricingTiers), [pricingTiers, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.ROUNDING_POLICY, roundingPolicy), [roundingPolicy, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.NOTIFICATIONS, notifications), [notifications, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.APP_LANG, appLang), [appLang, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.THEME_ACCENT, themeAccent), [themeAccent, persistState]);
  useEffect(() => persistState(STORAGE_KEYS.SUPABASE_CONFIG, supabaseConfig), [supabaseConfig, persistState]);

  // Active branch
  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === activeBranchId) || branches[0] || null;
  }, [branches, activeBranchId]);

  // Active shift
  const activeShift = useMemo(() => {
    if (!activeShiftId) return null;
    return shifts.find(s => s.id === activeShiftId && s.status === 'open') || null;
  }, [shifts, activeShiftId]);

  // Audit logging helper
  const recordAudit = useCallback((
    actionType: AuditLogEntry['actionType'],
    description: string,
    meta?: { oldValue?: string; newValue?: string; deviceOrSessionRef?: string }
  ) => {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      userId: currentUser?.id || 'system',
      userName: currentUser?.name || 'النظام',
      branchId: activeBranchId,
      actionType,
      description,
      oldValue: meta?.oldValue,
      newValue: meta?.newValue,
      deviceOrSessionRef: meta?.deviceOrSessionRef,
      isOfflineSynced: !navigator.onLine,
    };
    setAuditLog(prev => [entry, ...prev.slice(0, 499)]);
  }, [currentUser, activeBranchId]);

  // Offline queue registration
  const queueOfflineAction = useCallback((action: string, payload: any) => {
    const item: OfflineAction = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      idempotencyKey: `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      action,
      payload,
      performedBy: currentUser?.name || 'مستخدم',
      performedAt: Date.now(),
      status: 'pending',
    };
    setOfflineQueue(prev => [...prev, item]);
  }, [currentUser]);

  const syncOfflineQueue = useCallback(() => {
    const pending = offlineQueue.filter(item => item.status === 'pending');
    const token = getSupabaseAccessToken();
    if (pending.length === 0) return;
    if (!token) {
      addNotification({ title: 'يلزم تسجيل دخول سحابي', message: 'سجّل الدخول عبر Supabase Auth قبل مزامنة العمليات. تسجيل الدخول المحلي بالـ PIN لا يمنح صلاحية API.', type: 'warning' });
      return;
    }
    void fetch('/api/sync/receipts', {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ actions: pending.map(item => ({ idempotencyKey: item.idempotencyKey || item.id, action: item.action, payload: item.payload, performedAt: item.performedAt })) }),
    }).then(async response => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result?.error?.message || 'Sync failed');
      const executedResults = (result.results || []).filter((x: any) => x.accepted && x.executed === true);
      const accepted = new Set(executedResults.map((x: any) => x.idempotencyKey));
      if (accepted.size !== pending.length) throw new Error('Some queued actions have not been executed by the server.');
      const syncedSessionIds = new Set<string>();
      const transactionsToAdd: SafeTransaction[] = [];

      for (const item of executedResults) {
        if (item.versions && typeof item.versions === 'object') Object.assign(cloudVersionsRef.current, item.versions);
        const remote = item.result || {};
        const session = remote.session as GameSession | null;
        if (session && typeof session.id === 'string') {
          syncedSessionIds.add(session.id);
          setSessions(prev => prev.some(existing => existing.id === session.id)
            ? prev.map(existing => existing.id === session.id ? session : existing)
            : [session, ...prev]);
          setDevices(prev => prev.map(device => device.id !== session.deviceId ? device : session.status === 'active'
            ? { ...device, status: 'busy', currentGame: session.gameName, activeSessionId: session.id }
            : { ...device, status: 'available', currentGame: undefined, activeSessionId: undefined }));
        }

        const queued = pending.find(action => (action.idempotencyKey || action.id) === item.idempotencyKey);
        const queuedShiftId = typeof queued?.payload?.shiftId === 'string' ? queued.payload.shiftId : (activeShiftId || 'offline-sync');
        const queuedBranchId = session?.branchId || queued?.payload?.completedSession?.branchId || activeBranch?.id || '';
        const remoteTransactions = Array.isArray(remote.transactions) ? remote.transactions : remote.transaction ? [remote.transaction] : [];
        for (const tx of remoteTransactions) {
          if (!tx || typeof tx.id !== 'string') continue;
          transactionsToAdd.push({
            id: tx.id,
            shiftId: queuedShiftId,
            branchId: queuedBranchId,
            type: tx.type as SafeTransaction['type'],
            amount: Number(tx.amount),
            paymentMethod: tx.payment_method as SafeTransaction['paymentMethod'],
            description: String(tx.description || ''),
            performedBy: currentUser?.name || 'كاشير',
            timestamp: Date.parse(tx.created_at) || Date.now(),
          });
        }
      }

      if (transactionsToAdd.length || syncedSessionIds.size) {
        const incomingIds = new Set(transactionsToAdd.map(tx => tx.id));
        setSafeTransactions(prev => {
          const withoutPendingCopies = prev.filter(tx => {
            for (const sessionId of syncedSessionIds) {
              if (tx.id.startsWith('pending-session-' + sessionId + '-') || tx.id.startsWith('pending-debt-' + sessionId + '-')) return false;
            }
            return !incomingIds.has(tx.id);
          });
          return [...transactionsToAdd, ...withoutPendingCopies];
        });
      }

      setOfflineQueue(prev => prev.map(item => accepted.has(item.idempotencyKey || item.id) ? { ...item, status: 'synced' } : item));
      addNotification({ title: 'تم تنفيذ العمليات المتأخرة', message: 'تم تنفيذ ' + accepted.size + ' عملية على الخادم وتأكيد حفظها.', type: 'success' });
    }).catch((error) => addNotification({
      title: 'فشلت المزامنة',
      message: error instanceof Error ? error.message : 'لم يؤكد الخادم حفظ العمليات؛ ستظل معلقة ويمكن إعادة المحاولة.',
      type: 'warning',
    }));
  }, [offlineQueue, addNotification, getSupabaseAccessToken, apiHeaders, activeShiftId, activeBranch, currentUser]);  // --------------------------------------------------------------------------
  // REAL-TIME SESSION MONITOR & AUDIO ALARMS (User requirement: 5-min warning,
  // session finished alarm, and periodic overdue buzzer!)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let overdueTimerCount = 0;

    const interval = setInterval(() => {
      const now = Date.now();
      let hasOverdueSession = false;

      setSessions(prevSessions => {
        let hasChanges = false;
        const updated = prevSessions.map(session => {
          if (session.status !== 'active') return session;

          // 1. Timed Sessions Alarm Logic
          if (session.sessionType === 'timed' && session.plannedDurationMinutes) {
            const elapsedSeconds = (now - session.startTime) / 1000;
            const plannedSeconds = session.plannedDurationMinutes * 60;
            const remainingSeconds = plannedSeconds - elapsedSeconds;

            const dev = devices.find(d => d.id === session.deviceId);
            const screenName = dev?.screenNumber || 'الجهاز';

            // Check for 5-minute pre-alert (300 seconds left)
            if (remainingSeconds <= 300 && remainingSeconds > 0 && !session.fiveMinWarned) {
              playFiveMinuteWarningSound();
              addNotification({
                title: 'تنبيه انتهاء الجلسة (5 دقائق)',
                message: `متبقي 5 دقائق فقط على انتهاء وقت ${screenName} للعميل ${session.customerName}`,
                type: 'warning',
              });
              hasChanges = true;
              return { ...session, fiveMinWarned: true };
            }

            // Check for exact session end alarm
            if (remainingSeconds <= 0) {
              hasOverdueSession = true;
              if (!session.endedAlarmPlayed) {
                playSessionFinishedAlarm();
                addNotification({
                  title: 'انتهى وقت الجلسة!',
                  message: `انتهى وقت ${screenName} للعميل ${session.customerName} بالكامل. يرجى المحاسبة أو التمديد.`,
                  type: 'alert',
                });
                hasChanges = true;
                return { ...session, endedAlarmPlayed: true };
              }
            }
          }

          // 2. Budget Sessions Alarm Logic
          if (session.sessionType === 'budget' && session.budgetEgp) {
            const { totalCost } = calculateSessionGamingCost(session.segments, now, pricingTiers, roundingPolicy);
            const remainingBudget = session.budgetEgp - totalCost;
            const dev = devices.find(d => d.id === session.deviceId);
            const screenName = dev?.screenNumber || 'الجهاز';

            // Near end warning (less than 5 EGP)
            if (remainingBudget <= 5 && remainingBudget > 0 && !session.fiveMinWarned) {
              playFiveMinuteWarningSound();
              addNotification({
                title: 'تنبيه ميزانية الجلسة قوشكت على الانتهاء',
                message: `متبقي ${remainingBudget} ج.م فقط من ميزانية ${screenName}`,
                type: 'warning',
              });
              hasChanges = true;
              return { ...session, fiveMinWarned: true };
            }

            if (remainingBudget <= 0) {
              hasOverdueSession = true;
              if (!session.endedAlarmPlayed) {
                playSessionFinishedAlarm();
                addNotification({
                  title: 'استنفذت ميزانية الجلسة!',
                  message: `تم استنفاد ميزانية ${screenName} (${session.budgetEgp} ج.م) بالكامل!`,
                  type: 'alert',
                });
                hasChanges = true;
                return { ...session, endedAlarmPlayed: true };
              }
            }
          }

          return session;
        });

        return hasChanges ? updated : prevSessions;
      });

      // Periodic overdue reminder every 45 seconds if overdue sessions exist
      if (hasOverdueSession) {
        overdueTimerCount += 1;
        if (overdueTimerCount >= 45) {
          playOverdueReminderBeep();
          overdueTimerCount = 0;
        }
      } else {
        overdueTimerCount = 0;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [devices, pricingTiers, roundingPolicy, addNotification]);

  // --------------------------------------------------------------------------
  // Authentication & Passwords
  // --------------------------------------------------------------------------
  const registerOwnerAccount = useCallback(async (data: { name: string; phone: string; email: string; password: string; bootstrapCode: string }) => {
    try {
      const session = await supabaseAuthRequest('signup', { email: data.email.trim(), password: data.password, data: { name: data.name.trim(), phone: data.phone.trim() } });
      localStorage.setItem('lg_owner_bootstrap_code', data.bootstrapCode);
      if (!session.access_token) return { success: true, requiresEmailConfirmation: true, message: 'تم إنشاء الحساب وإرسال طلب تأكيد البريد. افتح رسالة التأكيد في البريد الوارد أو Spam؛ لا تعِد التسجيل. بعد التأكيد سجّل الدخول لإكمال تهيئة المالك.' };
      localStorage.setItem('lg_supabase_session', JSON.stringify(session));
      cloudAuthUserIdRef.current = String(session.user?.id || '');
      const boot = await apiRequest<{ user: { id: string; name: string; phone: string; role: string } }>('/api/auth/bootstrap-owner', { method: 'POST', body: JSON.stringify({ name: data.name.trim(), phone: data.phone.trim(), bootstrapCode: data.bootstrapCode }) });
      await apiRequest('/api/owner/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: data.name.trim(), phone: data.phone.trim(), businessName: 'Liverpool Gaming' }),
      });
      localStorage.removeItem('lg_owner_bootstrap_code');
      const profile: OwnerProfile = { id: boot.user.id, name: data.name.trim(), phone: data.phone.trim(), pinHash: '', businessName: 'Liverpool Gaming', subscriptionPlan: 'Multi-Branch', renewalDate: '', createdAt: Date.now(), twoFactorEnabled: false };
      setOwnerProfile(profile);
      setCurrentUser({ id: boot.user.id, name: profile.name, phone: profile.phone, role: 'owner', pinOrPassword: '', isOwner: true });
      return { success: true, requiresEmailConfirmation: false, message: 'تم إنشاء حساب المالك وربطه بالخادم بنجاح.' };
    } catch (e) { localStorage.removeItem('lg_supabase_session'); cloudAuthUserIdRef.current = null; return { success: false, requiresEmailConfirmation: false, message: e instanceof Error ? e.message : 'تعذر إنشاء حساب المالك' }; }
  }, [ownerProfile, supabaseAuthRequest, apiRequest]);

  const loginWithSupabase = useCallback(async (email: string, password: string) => {
    try {
      const session = await supabaseAuthRequest('token?grant_type=password', { email: email.trim(), password });
      if (!session.access_token) return { success: false, message: 'لم يُرجع خادم المصادقة جلسة صالحة.' };
      localStorage.setItem('lg_supabase_session', JSON.stringify(session));
      cloudAuthUserIdRef.current = String(session.user?.id || '');
      let me: { user: { id: string; role: User['role']; email?: string | null } };
      try {
        me = await apiRequest<{ user: { id: string; role: User['role']; email?: string | null } }>('/api/auth/me');
      } catch (authError) {
        const message = authError instanceof Error ? authError.message : '';
        if (!/not authorized|not a member|غير مخوّل|NOT_A_MEMBER/i.test(message)) throw authError;
        const bootstrapCode = localStorage.getItem('lg_owner_bootstrap_code');
        if (!bootstrapCode) throw new Error('هذا الحساب غير مضاف للنظام. أدخل رمز تهيئة المالك أو اطلب من المالك إضافتك.');
        await apiRequest('/api/auth/bootstrap-owner', { method: 'POST', body: JSON.stringify({ name: String(session.user?.user_metadata?.name || email.split('@')[0]), phone: String(session.user?.user_metadata?.phone || ''), bootstrapCode }) });
        localStorage.removeItem('lg_owner_bootstrap_code');
        me = await apiRequest<{ user: { id: string; role: User['role']; email?: string | null } }>('/api/auth/me');
      }
      const profile = await apiRequest<{ state?: Record<string, unknown>; versions?: Record<string, number> }>('/api/state');
      // The version map must be restored at login; otherwise every existing cloud key is written with version 0 and rejected as a conflict.
      cloudVersionsRef.current = profile.versions || {};
      cloudHydratedRef.current = true;
      const inventoryResponse = await apiRequest<{ items: any[] }>('/api/inventory/items');
      const cloudInventory: InventoryItem[] = (inventoryResponse.items || []).map((i: any) => ({ id: String(i.id), branchId: String(i.branch_id), name: String(i.name), category: i.category, sellingPrice: Number(i.selling_price), costPrice: Number(i.cost_price), stockQuantity: Number(i.stock_quantity), minStockThreshold: Number(i.min_stock_threshold) }));
      setInventory(cloudInventory);
      const cloudOwner = (profile.state?.[STORAGE_KEYS.OWNER] || null) as OwnerProfile | null;
      const state = profile.state || {};
      let ownerProfileFromServer: OwnerProfile | null = null;
      if (me.user.role === 'owner') {
        const ownerResult = await apiRequest<{ profile: { name: string; phone: string; businessName: string; createdAt: string } | null }>('/api/owner/profile');
        let ownerRecord = ownerResult.profile;
        if (!ownerRecord) {
          const name = String(cloudOwner?.name || session.user?.user_metadata?.name || email.split('@')[0]);
          const phone = String(cloudOwner?.phone || session.user?.user_metadata?.phone || '');
          const businessName = String(cloudOwner?.businessName || 'Liverpool Gaming');
          const saved = await apiRequest<{ profile: { name: string; phone: string; businessName: string; createdAt: string } }>('/api/owner/profile', {
            method: 'PUT',
            body: JSON.stringify({ name, phone, businessName }),
          });
          ownerRecord = saved.profile;
        }
        ownerProfileFromServer = {
          id: me.user.id,
          name: ownerRecord.name,
          phone: ownerRecord.phone,
          pinHash: '',
          businessName: ownerRecord.businessName,
          subscriptionPlan: 'Multi-Branch',
          renewalDate: '',
          createdAt: Date.parse(ownerRecord.createdAt) || Date.now(),
          twoFactorEnabled: false,
        };
      }
      if (state[STORAGE_KEYS.BRANCHES] !== undefined) setBranches(state[STORAGE_KEYS.BRANCHES] as Branch[]);
      if (state[STORAGE_KEYS.ACTIVE_BRANCH] !== undefined) setActiveBranchIdState(state[STORAGE_KEYS.ACTIVE_BRANCH] as string);
      if (state[STORAGE_KEYS.DEVICES] !== undefined) setDevices(state[STORAGE_KEYS.DEVICES] as Device[]);
      if (state[STORAGE_KEYS.SESSIONS] !== undefined) setSessions(state[STORAGE_KEYS.SESSIONS] as GameSession[]);
      if (state[STORAGE_KEYS.WAITLIST] !== undefined) setWaitlist(state[STORAGE_KEYS.WAITLIST] as WaitlistItem[]);
      if (state[STORAGE_KEYS.SHIFTS] !== undefined) setShifts(state[STORAGE_KEYS.SHIFTS] as Shift[]);
      if (state[STORAGE_KEYS.ACTIVE_SHIFT] !== undefined) setActiveShiftId(state[STORAGE_KEYS.ACTIVE_SHIFT] as string | null);
      if (state[STORAGE_KEYS.SAFE_TXS] !== undefined) setSafeTransactions(state[STORAGE_KEYS.SAFE_TXS] as SafeTransaction[]);
      if (state[STORAGE_KEYS.EMPLOYEES] !== undefined) setEmployees(state[STORAGE_KEYS.EMPLOYEES] as Employee[]);
      if (state[STORAGE_KEYS.PERMISSIONS] !== undefined) setRolePermissions(state[STORAGE_KEYS.PERMISSIONS] as typeof DEFAULT_ROLE_PERMISSIONS);
      if (state[STORAGE_KEYS.AUDIT_LOG] !== undefined) setAuditLog(state[STORAGE_KEYS.AUDIT_LOG] as AuditLogEntry[]);
      if (state[STORAGE_KEYS.PRICING_TIERS] !== undefined) setPricingTiers(state[STORAGE_KEYS.PRICING_TIERS] as PriceTier[]);
      if (state[STORAGE_KEYS.ROUNDING_POLICY] !== undefined) setRoundingPolicyState(state[STORAGE_KEYS.ROUNDING_POLICY] as RoundingPolicy);
      if (state[STORAGE_KEYS.NOTIFICATIONS] !== undefined) setNotifications(state[STORAGE_KEYS.NOTIFICATIONS] as SystemNotification[]);
      const displayName = session.user?.user_metadata?.name || cloudOwner?.name || session.user?.email || email;
      setCurrentUser({ id: me.user.id, name: String(displayName), phone: String(session.user?.user_metadata?.phone || cloudOwner?.phone || ''), role: me.user.role, pinOrPassword: '', isOwner: me.user.role === 'owner' });
      if (cloudOwner) setOwnerProfile(cloudOwner);
      return { success: true, message: `تم تسجيل الدخول بصلاحية ${me.user.role}.` };
    } catch (e) { localStorage.removeItem('lg_supabase_session'); cloudAuthUserIdRef.current = null; return { success: false, message: e instanceof Error ? e.message : 'فشل تسجيل الدخول أو الحساب غير مخوّل' }; }
  }, [supabaseAuthRequest, apiRequest]);

  const setupPrimaryOwner = useCallback((data: { name: string; phone: string; pinOrPassword: string; enable2FA?: boolean }): boolean => {
    if (ownerProfile) return false;
    const hashedPin = hashPinOrPassword(data.pinOrPassword);
    const profile: OwnerProfile = {
      id: `owner-${Date.now()}`,
      name: data.name,
      phone: data.phone,
      pinHash: hashedPin,
      businessName: 'Liverpool Gaming',
      subscriptionPlan: 'Multi-Branch - EGP 999/شهر',
      renewalDate: '2025 / 07 / 15',
      createdAt: Date.now(),
      twoFactorEnabled: data.enable2FA ?? true,
    };
    setOwnerProfile(profile);
    const ownerUser: User = {
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
      role: 'owner',
      pinOrPassword: hashedPin,
      isOwner: true,
    };
    setCurrentUser(ownerUser);
    recordAudit('price_change', `تسجيل المالك الرئيسي: ${data.name}`);
    return true;
  }, [ownerProfile, recordAudit]);

  const verifyOwnerPin = useCallback((pin: string): boolean => {
    if (!ownerProfile) return false;
    return verifyPinOrPassword(pin, ownerProfile.pinHash);
  }, [ownerProfile]);

  const verify2FACode = useCallback((code: string): boolean => {
    // 2FA code verification: strictly verifies against owner's secure credentials
    if (!ownerProfile) return false;
    return verifyPinOrPassword(code, ownerProfile.pinHash);
  }, [ownerProfile]);

  const loginUser = useCallback((phone: string, pin: string): { success: boolean; message: string; requires2FA?: boolean } => {
    // 1. Check Owner
    if (ownerProfile && (ownerProfile.phone === phone || phone === 'owner' || phone === 'admin')) {
      if (verifyPinOrPassword(pin, ownerProfile.pinHash)) {
        const user: User = {
          id: ownerProfile.id,
          name: ownerProfile.name,
          phone: ownerProfile.phone,
          role: 'owner',
          pinOrPassword: ownerProfile.pinHash,
          isOwner: true,
        };
        setCurrentUser(user);
        return { success: true, message: 'مرحباً بعودتك يا فندم! (المالك)', requires2FA: ownerProfile.twoFactorEnabled };
      }
      return { success: false, message: 'كلمة السر أو PIN غير صحيح' };
    }

    // 2. Check Employee
    const emp = employees.find(e => e.phone === phone || e.id === phone);
    if (emp) {
      const empPin = emp.pinOrPassword || hashPinOrPassword(emp.phone.slice(-4));
      if (verifyPinOrPassword(pin, empPin)) {
        const user: User = {
          id: emp.id,
          name: emp.name,
          phone: emp.phone,
          role: emp.role,
          branchId: emp.branchId,
          pinOrPassword: empPin,
          isOwner: false,
        };
        setCurrentUser(user);
        if (emp.branchId) {
          setActiveBranchIdState(emp.branchId);
        }
        return { success: true, message: `أهلاً بك يا ${emp.name}` };
      }
      return { success: false, message: 'كلمة السر أو PIN للموظف غير صحيح' };
    }

    return { success: false, message: 'الحساب غير مسجل بالمنظومة' };
  }, [ownerProfile, employees]);

  const logoutUser = useCallback(() => {
    localStorage.removeItem('lg_supabase_session');
    cloudAuthUserIdRef.current = null;
    setCurrentUser(null);
  }, []);

  // --------------------------------------------------------------------------
  // Branches
  // --------------------------------------------------------------------------
  const addBranch = useCallback((branchData: Omit<Branch, 'id' | 'isActive'>): Branch => {
    const id = branchData.name.toLowerCase().replace(/\s+/g, '-');
    const newBranch: Branch = {
      ...branchData,
      id: id || `branch-${Date.now()}`,
      isActive: true,
    };
    setBranches(prev => [...prev, newBranch]);
    recordAudit('price_change', `إضافة فرع جديد: ${branchData.nameAr}`);
    return newBranch;
  }, [recordAudit]);

  const updateBranch = useCallback((id: string, updates: Partial<Branch>) => {
    setBranches(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const setActiveBranchId = useCallback((id: string) => {
    setActiveBranchIdState(id);
  }, []);

  // --------------------------------------------------------------------------
  // Devices & Sessions
  // --------------------------------------------------------------------------
  const addDevice = useCallback((data: Omit<Device, 'id' | 'status'>): Device => {
    const newDevice: Device = {
      ...data,
      id: `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: 'available',
    };
    setDevices(prev => [...prev, newDevice]);
    recordAudit('session_transfer', `إضافة جهاز: ${data.name} (${data.screenNumber})`);
    return newDevice;
  }, [recordAudit]);

  const updateDevice = useCallback((id: string, updates: Partial<Device>) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const deleteDevice = useCallback((id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
  }, []);

  const populateDefaultBranchDevices = useCallback((branchId: string) => {
    const targetBranch = branches.find(b => b.id === branchId);
    if (!targetBranch) return;
    const newDevs = createDefaultDevicesForBranch(branchId);
    setDevices(prev => [...prev.filter(d => d.branchId !== branchId), ...newDevs]);
    recordAudit('stock_adjustment', `تهيئة ${newDevs.length} أجهزة لفرع ${targetBranch.nameAr}`);
  }, [branches, recordAudit]);

  const startSession = useCallback(async (data: {
    deviceId: string;
    customerName: string;
    customerPhone?: string;
    gameName: string;
    sessionType: 'open' | 'timed' | 'budget';
    controllers: ControllersCount;
    plannedDurationMinutes?: number;
    budgetEgp?: number;
    isPrepaid?: boolean;
    paidAmount?: number;
    paymentMethod?: 'cash' | 'instapay' | 'vodafone' | 'card';
  }): Promise<GameSession> => {
    if (!currentUser?.isOwner && !activeShift) {
      throw new Error('لا يمكن بدء جلسة دون فتح شيفت استلام للكاشير أولاً');
    }

    const dev = devices.find(d => d.id === data.deviceId);
    if (!dev) throw new Error('الجهاز غير موجود');
    if (dev.status !== 'available') throw new Error('لا يمكن بدء جلسة على جهاز غير متاح');

    const now = Date.now();
    const sessionNum = '#S' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900);
    const initialSegment = {
      id: 'seg-' + now + '-1',
      deviceType: dev.type,
      controllers: data.controllers,
      startTime: now,
      appliedPriceTiers: [...pricingTiers],
    };

    const newSession: GameSession = {
      id: 'ses-' + now,
      sessionNumber: sessionNum,
      deviceId: dev.id,
      branchId: dev.branchId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      gameName: data.gameName,
      sessionType: data.sessionType,
      startTime: now,
      startedBy: currentUser?.name || 'المالك',
      plannedDurationMinutes: data.plannedDurationMinutes,
      budgetEgp: data.budgetEgp,
      segments: [initialSegment],
      products: [],
      status: 'active',
      discountType: 'none',
      discountValue: 0,
      paidAmount: data.paidAmount || 0,
      paymentMethod: data.paymentMethod,
      isPrepaid: Boolean(data.isPrepaid),
      fiveMinWarned: false,
      endedAlarmPlayed: false,
    };

    const accessToken = getSupabaseAccessToken();
    let queuedForSync = false;
    if (!navigator.onLine) {
      queueOfflineAction('start_session', { session: newSession, shiftId: activeShiftId || 'owner-session' });
      queuedForSync = true;
    } else if (accessToken) {
      try {
        const result = await apiRequest<{ versions?: Record<string, number> }>('/api/sessions/start', {
          method: 'POST',
          body: JSON.stringify({
            idempotencyKey: 'start-' + newSession.id,
            session: newSession,
            shiftId: activeShiftId || 'owner-session',
          }),
        });
        if (result.versions) Object.assign(cloudVersionsRef.current, result.versions);
      } catch (error) {
        const status = error && typeof error === 'object' && 'status' in error
          ? Number((error as { status?: number }).status)
          : undefined;
        // Business/auth conflicts must be resolved, not retried as offline work.
        if (status !== undefined && status < 500) throw error;
        queueOfflineAction('start_session', { session: newSession, shiftId: activeShiftId || 'owner-session' });
        queuedForSync = true;
        addNotification({
          title: 'الجلسة محفوظة محليًا وتحتاج مزامنة',
          message: 'لم يؤكد الخادم بدء الجلسة. ستظل العملية معلقة حتى تنجح المزامنة.',
          type: 'warning',
        });
      }
    } else {
      addNotification({
        title: 'الجلسة على هذا الجهاز فقط',
        message: 'سجّل الدخول السحابي حتى يتمكن البرنامج من حفظ الجلسة في قاعدة البيانات.',
        type: 'warning',
      });
    }

    setDevices(prev => prev.map(d => d.id === dev.id ? {
      ...d,
      status: 'busy',
      currentGame: data.gameName,
      activeSessionId: newSession.id,
    } : d));
    setSessions(prev => [newSession, ...prev]);

    if (data.isPrepaid && data.paidAmount && data.paidAmount > 0) {
      const tx: SafeTransaction = {
        id: 'tx-' + now,
        shiftId: activeShiftId || 'owner-session',
        branchId: dev.branchId,
        type: 'gaming_revenue',
        amount: data.paidAmount,
        paymentMethod: data.paymentMethod || 'cash',
        description: 'دفعة مسبقة ' + sessionNum + ' (' + dev.screenNumber + ')',
        performedBy: currentUser?.name || 'المالك',
        timestamp: now,
      };
      setSafeTransactions(prev => [tx, ...prev]);
    }

    recordAudit('session_started', 'بدء ' + (data.sessionType === 'timed' ? 'جلسة بوقت' : data.sessionType === 'budget' ? 'جلسة بميزانية' : 'جلسة مفتوحة') + ' ' + sessionNum + ' على ' + dev.screenNumber + ' (' + dev.type + ')');
    if (queuedForSync) {
      addNotification({
        title: 'العملية بانتظار المزامنة',
        message: 'لن تعتبر الجلسة متزامنة إلا بعد تنفيذها على الخادم.',
        type: 'warning',
      });
    }
    return newSession;
  }, [currentUser, activeShift, devices, pricingTiers, activeShiftId, recordAudit, queueOfflineAction, getSupabaseAccessToken, apiRequest, addNotification]);
  const changeSessionControllers = useCallback((sessionId: string, newCount: ControllersCount) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId || s.status !== 'active') return s;
      const now = Date.now();
      const currentSegments = [...s.segments];
      const lastSeg = currentSegments[currentSegments.length - 1];
      if (lastSeg && !lastSeg.endTime) {
        lastSeg.endTime = now;
      }
      const dev = devices.find(d => d.id === s.deviceId);
      const devType = dev?.type || 'PS5';
      const newSegment = {
        id: `seg-${now}-${currentSegments.length + 1}`,
        deviceType: devType,
        controllers: newCount,
        startTime: now,
        changedBy: currentUser?.name || 'كاشير',
        appliedPriceTiers: [...pricingTiers],
      };
      recordAudit('session_controller_change', `تغيير أذرع ${s.sessionNumber} إلى ${newCount} أذرع`);
      return {
        ...s,
        segments: [...currentSegments, newSegment],
      };
    }));
  }, [devices, pricingTiers, currentUser, recordAudit]);

  const addSessionProduct = useCallback((sessionId: string, productId: string, quantity: number, isPaid: boolean) => {
    const item = inventory.find(i => i.id === productId);
    const session = sessions.find(s => s.id === sessionId && s.status === 'active');
    if (!item || !session || !Number.isInteger(quantity) || quantity <= 0 || quantity > item.stockQuantity) return;

    setInventory(prev => prev.map(i => i.id === productId ? {
      ...i,
      stockQuantity: Math.max(0, i.stockQuantity - quantity),
    } : i));

    const productRecord = {
      id: `sp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: item.id,
      name: item.name,
      quantity,
      unitPrice: item.sellingPrice,
      unitCost: item.costPrice,
      isPaid,
      addedAt: Date.now(),
      addedBy: currentUser?.name || 'كاشير',
    };

    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        products: [...s.products, productRecord],
      };
    }));

    if (isPaid) {
      const revenue = item.sellingPrice * quantity;
      const tx: SafeTransaction = {
        id: `tx-${Date.now()}`,
        shiftId: activeShiftId || 'owner-direct',
        branchId: activeBranchId,
        type: 'bar_revenue',
        amount: revenue,
        paymentMethod: 'cash',
        description: `طلب بوفيه: ${item.name} عدد ${quantity}`,
        performedBy: currentUser?.name || 'كاشير',
        timestamp: Date.now(),
      };
      setSafeTransactions(prev => [tx, ...prev]);
    }
  }, [inventory, sessions, currentUser, activeShiftId, activeBranchId]);

  const markProductPaid = useCallback((sessionId: string, sessionProductId: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const target = s.products.find(p => p.id === sessionProductId);
      if (target && !target.isPaid) {
        const tx: SafeTransaction = {
          id: `tx-${Date.now()}`,
          shiftId: activeShiftId || 'owner-direct',
          branchId: activeBranchId,
          type: 'bar_revenue',
          amount: target.unitPrice * target.quantity,
          paymentMethod: 'cash',
          description: `سداد طلب بوفيه: ${target.name} عدد ${target.quantity}`,
          performedBy: currentUser?.name || 'كاشير',
          timestamp: Date.now(),
        };
        setSafeTransactions(p => [tx, ...p]);
      }
      return {
        ...s,
        products: s.products.map(p => p.id === sessionProductId ? { ...p, isPaid: true } : p),
      };
    }));
  }, [activeShiftId, activeBranchId, currentUser]);

  const transferSession = useCallback((fromDeviceId: string, toDeviceId: string, reason?: string): { success: boolean; message: string } => {
    const fromDev = devices.find(d => d.id === fromDeviceId);
    const toDev = devices.find(d => d.id === toDeviceId);
    const session = sessions.find(s => s.deviceId === fromDeviceId && s.status === 'active');

    const validation = validateSessionTransfer(session, fromDev, toDev, sessions);
    if (!validation.isValid) {
      return { success: false, message: validation.errorMessage || 'تعذر نقل الجلسة' };
    }

    if (!session || !fromDev || !toDev) {
      return { success: false, message: 'بيانات الجلسة أو الأجهزة غير مكتملة' };
    }

    const now = Date.now();
    const result = executeSessionTransfer(
      session,
      fromDev,
      toDev,
      currentUser?.name || 'كاشير',
      now,
      pricingTiers,
      reason
    );

    if (!result.success || !result.updatedSession || !result.updatedOldDevice || !result.updatedTargetDevice) {
      return { success: false, message: result.errorMessage || 'فشل تنفيذ عملية النقل' };
    }

    setSessions(prev => prev.map(s => s.id === session.id ? result.updatedSession! : s));
    setDevices(prev => prev.map(d => {
      if (d.id === fromDeviceId) return result.updatedOldDevice!;
      if (d.id === toDeviceId) return result.updatedTargetDevice!;
      return d;
    }));

    recordAudit('session_transfer', `نقل جلسة ${session.sessionNumber} من ${fromDev.screenNumber} (${fromDev.type}) إلى ${toDev.screenNumber} (${toDev.type})`);
    return { success: true, message: `تم نقل الجلسة بنجاح إلى ${toDev.screenNumber} (${toDev.type}) دون إنهاء الجلسة` };
  }, [devices, sessions, currentUser, pricingTiers, recordAudit]);

  const switchSessionDeviceType = useCallback((sessionId: string, newType: DeviceType) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId || s.status !== 'active') return s;
      const now = Date.now();
      const currentSegments = [...s.segments];
      const lastSeg = currentSegments[currentSegments.length - 1];
      if (lastSeg && lastSeg.deviceType === newType) return s;
      if (lastSeg && !lastSeg.endTime) {
        lastSeg.endTime = now;
      }
      const newSeg = {
        id: `seg-${now}-${currentSegments.length + 1}`,
        deviceType: newType,
        controllers: lastSeg?.controllers || 2,
        startTime: now,
        changedBy: currentUser?.name || 'كاشير',
        appliedPriceTiers: [...pricingTiers],
      };
      recordAudit('session_device_type_change', `تغيير نوع جهاز ${s.sessionNumber} إلى ${newType}`);
      return {
        ...s,
        segments: [...currentSegments, newSeg],
      };
    }));
  }, [pricingTiers, currentUser, recordAudit]);

  const completeSession = useCallback(async (sessionId: string, checkoutData: {
    discountType: 'none' | 'fixed' | 'percent';
    discountValue: number;
    paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card' | 'split';
    amountReceived: number;
    splitPayments?: SplitPaymentPortion[];
  }): Promise<{ success: boolean; invoice: GameSession }> => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) throw new Error('الجلسة غير موجودة');
    if (session.status !== 'active') throw new Error('لا يمكن إغلاق جلسة غير نشطة أو تحصيلها مرة أخرى');
    if (completedSessionIds.current.has(sessionId)) throw new Error('تمت محاسبة هذه الجلسة بالفعل');

    const now = Date.now();
    const finalSegments = session.segments.map(seg => ({ ...seg, endTime: seg.endTime || now }));
    const { totalCost: gamingCost } = calculateSessionGamingCost(finalSegments, now, pricingTiers, roundingPolicy);
    const unpaidProductsTotal = session.products.filter(p => !p.isPaid)
      .reduce((acc, p) => acc + (p.unitPrice * p.quantity), 0);
    const productsTotal = session.products.reduce((acc, p) => acc + (p.unitPrice * p.quantity), 0);
    const invResult = calculateInvoice({
      gamingTotal: gamingCost,
      productsTotal: unpaidProductsTotal,
      discountType: checkoutData.discountType,
      discountValue: checkoutData.discountValue,
      prepaidAmount: session.paidAmount,
      amountReceived: checkoutData.amountReceived,
      paymentMethod: checkoutData.paymentMethod === 'split' ? undefined : checkoutData.paymentMethod,
      splitPayments: checkoutData.splitPayments,
    });

    const updatedSession: GameSession = {
      ...session,
      segments: finalSegments,
      status: 'completed',
      completedAt: now,
      completedBy: currentUser?.name || 'كاشير',
      discountType: checkoutData.discountType,
      discountValue: checkoutData.discountValue,
      paidAmount: session.paidAmount + invResult.actualCollected,
      paymentMethod: checkoutData.paymentMethod,
      splitPayments: checkoutData.splitPayments,
      finalGamingCost: gamingCost,
      finalProductsTotal: productsTotal,
      finalGrandTotal: invResult.netGrandTotal,
      remainingDebt: invResult.remainingDebt,
      isFullyPaid: invResult.isFullyPaid,
      changeGiven: invResult.changeGiven,
      products: session.products.map(p => ({ ...p, isPaid: true })),
    };
    const shiftId = activeShiftId || 'owner-checkout';
    const idempotencyKey = 'complete-' + sessionId;
    const financials = {
      gamingTotal: gamingCost,
      productsTotal,
      billableProductsTotal: unpaidProductsTotal,
      grossTotal: invResult.grossTotal,
      grandTotal: invResult.netGrandTotal,
      actualCollected: invResult.actualCollected,
      remainingDebt: invResult.remainingDebt,
      discountValue: checkoutData.discountValue,
      discountAmount: invResult.discountAmount,
    };
    const allocations = invResult.safeAllocations.map(alloc => ({
      amount: alloc.amount,
      paymentMethod: alloc.paymentMethod,
      description: alloc.description,
    }));

    let savedSession = updatedSession;
    let savedTransactions: Array<{id:string;created_at:string;type:string;payment_method:string;amount:number;description:string}> = [];
    const token = getSupabaseAccessToken();
    let queuedForSync = false;
    if (!token) throw new Error('سجّل الدخول بالحساب السحابي قبل محاسبة الجلسة حتى لا تضيع العملية المالية.');
    if (!navigator.onLine) {
      queueOfflineAction('complete_session', { idempotencyKey, sessionId, shiftId, completedSession: updatedSession, financials, allocations });
      queuedForSync = true;
    } else {
      try {
        const result = await apiRequest<{
          session?: GameSession;
          transactions?: Array<{id:string;created_at:string;type:string;payment_method:string;amount:number;description:string}>;
          versions?: Record<string,number>;
        }>('/api/sessions/complete', {
          method: 'POST',
          body: JSON.stringify({ idempotencyKey, sessionId, shiftId, completedSession: updatedSession, financials, allocations }),
        });
        savedSession = result.session || updatedSession;
        savedTransactions = result.transactions || [];
        if (result.versions) Object.assign(cloudVersionsRef.current, result.versions);
      } catch (error) {
        const status = error && typeof error === 'object' && 'status' in error
          ? Number((error as {status?:number}).status)
          : undefined;
        if (status !== undefined && status < 500) throw error;
        queueOfflineAction('complete_session', { idempotencyKey, sessionId, shiftId, completedSession: updatedSession, financials, allocations });
        queuedForSync = true;
      }
    }

    setDevices(prev => prev.map(d => d.id === savedSession.deviceId ? {
      ...d, status: 'available', currentGame: undefined, activeSessionId: undefined,
    } : d));
    setSessions(prev => prev.map(s => s.id === sessionId ? savedSession : s));
    completedSessionIds.current.add(sessionId);

    const fallbackTransactions = allocations.map((alloc, idx) => ({
      id: 'pending-session-' + sessionId + '-' + idx,
      created_at: new Date(now).toISOString(),
      type: 'gaming_revenue',
      payment_method: alloc.paymentMethod,
      amount: alloc.amount,
      description: alloc.description,
    }));
    const transactionsToAdd = (queuedForSync ? fallbackTransactions : savedTransactions).map(tx => ({
      id: tx.id,
      shiftId,
      branchId: savedSession.branchId,
      type: tx.type as SafeTransaction['type'],
      amount: Number(tx.amount),
      paymentMethod: tx.payment_method as SafeTransaction['paymentMethod'],
      description: tx.description,
      performedBy: currentUser?.name || 'كاشير',
      timestamp: Date.parse(tx.created_at) || now,
    }));
    setSafeTransactions(prev => {
      const incomingIds = new Set(transactionsToAdd.map(tx => tx.id));
      return [...transactionsToAdd, ...prev.filter(old => !incomingIds.has(old.id))];
    });

    if (queuedForSync) addNotification({
      title: 'الفاتورة محفوظة محليًا',
      message: 'تم تجهيز فاتورة الجلسة على هذا الجهاز، وسيتم تنفيذها على الخادم عند عودة الإنترنت. لا تعتبرها مؤكدة سحابيًا حتى يظهر إشعار نجاح المزامنة.',
      type: 'warning',
    });
    recordAudit('session_completed', 'إنهاء ' + session.sessionNumber + ' بواسطة ' + (currentUser?.name || 'كاشير') +
      ' — المحاسبة ' + invResult.actualCollected + ' EGP، المديونية ' + invResult.remainingDebt + ' EGP');
    return { success: true, invoice: savedSession };
  }, [sessions, pricingTiers, roundingPolicy, currentUser, devices, activeShiftId, recordAudit,
      apiRequest, getSupabaseAccessToken, queueOfflineAction, addNotification]);

  const collectSessionDebt = useCallback(async (
    sessionId: string,
    amount: number,
    paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card'
  ): Promise<{ success: boolean; message: string; remainingDebt: number }> => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return { success: false, message: 'الجلسة غير موجودة', remainingDebt: 0 };
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, message: 'أدخل مبلغًا صحيحًا', remainingDebt: Number(session.remainingDebt || 0) };
    if (!session.remainingDebt || session.remainingDebt <= 0)
      return { success: false, message: 'لا توجد مديونية مستحقة على هذه الجلسة', remainingDebt: 0 };
    const { collectedAmount, newRemainingDebt, isFullySettled } = settleDebtPayment(session.remainingDebt, amount, paymentMethod);
    if (collectedAmount <= 0) return { success: false, message: 'المبلغ المحصل يجب أن يكون أكبر من صفر', remainingDebt: session.remainingDebt };
    const shiftId = activeShiftId || 'direct-collection';
    const idempotencyKey = 'debt-' + sessionId.slice(-24) + '-' +
      Math.round(Number(session.remainingDebt) * 100) + '-' + Math.round(collectedAmount * 100) + '-' + paymentMethod;
    const paymentRecord = {
      amount: collectedAmount,
      paidAt: Date.now(),
      paymentMethod,
      receivedBy: currentUser?.name || 'كاشير',
    };
    const updatedSession = {
      ...session,
      paidAmount: session.paidAmount + collectedAmount,
      remainingDebt: newRemainingDebt,
      isFullyPaid: isFullySettled,
      debtPaidHistory: [...(session.debtPaidHistory || []), paymentRecord],
    };
    const token = getSupabaseAccessToken();
    if (!token) return { success: false, message: 'سجّل الدخول بالحساب السحابي قبل تحصيل المديونية.', remainingDebt: session.remainingDebt };

    let savedSession: GameSession = updatedSession;
    let transaction: {id:string;created_at:string;type:string;payment_method:string;amount:number;description:string} | null = null;
    let queuedForSync = false;
    if (!navigator.onLine) {
      queueOfflineAction('collect_session_debt', { idempotencyKey, sessionId, shiftId, amount: collectedAmount, paymentMethod });
      queuedForSync = true;
    } else {
      try {
        const result = await apiRequest<{
          session?: GameSession;
          transaction?: {id:string;created_at:string;type:string;payment_method:string;amount:number;description:string} | null;
          versions?: Record<string,number>;
        }>('/api/sessions/debt-payments', {
          method: 'POST',
          body: JSON.stringify({ idempotencyKey, sessionId, shiftId, amount: collectedAmount, paymentMethod }),
        });
        savedSession = result.session || updatedSession;
        transaction = result.transaction || null;
        if (result.versions) Object.assign(cloudVersionsRef.current, result.versions);
      } catch (error) {
        const status = error && typeof error === 'object' && 'status' in error
          ? Number((error as {status?:number}).status)
          : undefined;
        if (status !== undefined && status < 500) return {
          success:false,message:error instanceof Error ? error.message : 'تعذر تحصيل المديونية',remainingDebt:session.remainingDebt
        };
        queueOfflineAction('collect_session_debt', { idempotencyKey, sessionId, shiftId, amount: collectedAmount, paymentMethod });
        queuedForSync = true;
      }
    }
    setSessions(prev => prev.map(s => s.id === sessionId ? savedSession : s));
    const tx = transaction || (queuedForSync ? {
      id:'pending-debt-' + sessionId + '-' + Math.round(Date.now()/1000),
      created_at:new Date().toISOString(),
      type:'debt_collection',
      payment_method:paymentMethod,
      amount:collectedAmount,
      description:'تحصيل مديونية جلسة ' + session.sessionNumber,
    } : null);
    if (tx) {
      const safeTx: SafeTransaction = {
        id:tx.id, shiftId, branchId:session.branchId, type:tx.type as SafeTransaction['type'],
        amount:Number(tx.amount), paymentMethod:tx.payment_method as SafeTransaction['paymentMethod'],
        description:tx.description, performedBy:currentUser?.name || 'كاشير', timestamp:Date.parse(tx.created_at)||Date.now(),
      };
      setSafeTransactions(prev => [safeTx,...prev.filter(old=>old.id!==safeTx.id)]);
    }
    if (queuedForSync) addNotification({
      title:'تحصيل المديونية محفوظ محليًا',
      message:'سيتم اعتماد التحصيل على الخادم عند عودة الإنترنت. لا تعتبره مؤكدًا حتى يظهر إشعار نجاح المزامنة.',
      type:'warning',
    });
    recordAudit('payment_received', 'سداد مديونية جلسة ' + session.sessionNumber + ' بقيمة ' + collectedAmount + ' EGP (' + paymentMethod + ')');
    return { success: true, message: queuedForSync ? 'تم حفظ التحصيل محليًا وينتظر المزامنة' : 'تم تحصيل مبلغ ' + collectedAmount + ' EGP بنجاح', remainingDebt: savedSession.remainingDebt || 0 };
  }, [sessions, activeShiftId, currentUser, recordAudit, apiRequest, getSupabaseAccessToken, queueOfflineAction, addNotification]);

  // --------------------------------------------------------------------------
  // Waitlist
  // --------------------------------------------------------------------------
  const addToWaitlist = useCallback((item: Omit<WaitlistItem, 'id' | 'createdAt' | 'status'>): WaitlistItem => {
    const newItem: WaitlistItem = {
      ...item,
      id: `wait-${Date.now()}`,
      createdAt: Date.now(),
      status: 'waiting',
    };
    setWaitlist(prev => [...prev, newItem]);
    return newItem;
  }, []);

  const updateWaitlistItemStatus = useCallback((id: string, status: WaitlistItem['status']) => {
    setWaitlist(prev => prev.map(w => w.id === id ? { ...w, status } : w));
  }, []);

  // --------------------------------------------------------------------------
  // Inventory & Bar
  // --------------------------------------------------------------------------
  const addInventoryItem = useCallback(async (data: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
    const newItem: InventoryItem = { ...data, id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}` };
    const result = await apiRequest<{ item: any }>('/api/inventory/items', { method: 'POST', body: JSON.stringify({ id: newItem.id, branchId: newItem.branchId, name: newItem.name, category: newItem.category, sellingPrice: newItem.sellingPrice, costPrice: newItem.costPrice, stockQuantity: newItem.stockQuantity, minStockThreshold: newItem.minStockThreshold }) });
    const saved: InventoryItem = { ...newItem, id: String(result.item.id), stockQuantity: Number(result.item.stock_quantity), sellingPrice: Number(result.item.selling_price), costPrice: Number(result.item.cost_price) };
    setInventory(prev => [...prev.filter(i => i.id !== saved.id), saved]);
    recordAudit('stock_adjustment', `إضافة صنف مخزون على الخادم: ${saved.name}`);
    return saved;
  }, [apiRequest, recordAudit]);

  const updateInventoryItem = useCallback(async (id: string, updates: Partial<InventoryItem>) => {
    const current = inventory.find(i => i.id === id);
    if (!current) throw new Error('الصنف غير موجود');
    const targetStock = updates.stockQuantity;
    const metadata = { ...current, ...updates };
    if (targetStock !== undefined && targetStock !== current.stockQuantity) {
      await apiRequest('/api/inventory/adjustments', { method: 'POST', body: JSON.stringify({ idempotencyKey: `stock-${crypto.randomUUID()}`, inventoryId: id, quantityDelta: targetStock - current.stockQuantity, reason: 'Manual restock/adjustment from inventory screen' }) });
    }
    await apiRequest('/api/inventory/items', { method: 'POST', body: JSON.stringify({ id, branchId: metadata.branchId, name: metadata.name, category: metadata.category, sellingPrice: metadata.sellingPrice, costPrice: metadata.costPrice, stockQuantity: targetStock ?? current.stockQuantity, minStockThreshold: metadata.minStockThreshold }) });
    setInventory(prev => prev.map(i => i.id === id ? { ...metadata, stockQuantity: targetStock ?? i.stockQuantity } : i));
  }, [inventory, apiRequest]);

  const sellBarItems = useCallback(async (items: Array<{ productId: string; quantity: number }>, paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card') => {
    if (!items.length) return { success: false, message: 'السلة فارغة' };
    if (!activeShiftId) return { success: false, message: 'يجب فتح وردية قبل تسجيل البيع' };
    try {
      const idempotencyKey = saleIdempotencyKeyRef.current || (saleIdempotencyKeyRef.current = `sale-${crypto.randomUUID()}`);
      const result = await apiRequest<{ total: number; duplicate?: boolean; sale: { id: string }; items: Array<{ inventoryId: string; remainingStock: number }> }>('/api/finance/sales', { method: 'POST', body: JSON.stringify({ idempotencyKey, branchId: activeBranchId, shiftId: activeShiftId, paymentMethod, items: items.map(i => ({ inventoryId: i.productId, quantity: i.quantity })) }) });
      saleIdempotencyKeyRef.current = null;
      const stockById = new Map((result.items || []).map(i => [i.inventoryId, i.remainingStock]));
      setInventory(prev => prev.map(i => stockById.has(i.id) ? { ...i, stockQuantity: stockById.get(i.id)! } : i));
      const tx: SafeTransaction = { id: result.sale.id, shiftId: activeShiftId, branchId: activeBranchId, type: 'bar_revenue', amount: result.total, paymentMethod, description: `بيع بوفيه ${result.sale.id}`, performedBy: currentUser?.name || 'كاشير', timestamp: Date.now() };
      setSafeTransactions(prev => [tx, ...prev]);
      recordAudit('payment_received', `بيع بوفيه معتمد من الخادم بقيمة ${result.total} EGP`);
      return { success: true, total: result.total };
    } catch (e) { return { success: false, message: e instanceof Error ? e.message : 'فشل تسجيل البيع على الخادم' }; }
  }, [activeShiftId, activeBranchId, apiRequest, currentUser, recordAudit]);

  const sellBarItemDirect = useCallback(async (productId: string, quantity: number, paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card'): Promise<boolean> => {
    const result = await sellBarItems([{ productId, quantity }], paymentMethod);
    if (!result.success && result.message) addNotification({ title: 'فشل البيع', message: result.message, type: 'warning' });
    return result.success;
  }, [sellBarItems, addNotification]);

  const initializeDefaultCatalogueForBranch = useCallback(async (branchId: string) => {
    try {
      for (let idx = 0; idx < DEFAULT_CATALOGUE_ITEMS.length; idx++) {
        const cat = DEFAULT_CATALOGUE_ITEMS[idx];
        await addInventoryItem({ ...cat, branchId, stockQuantity: 30 });
      }
      recordAudit('stock_adjustment', `تهيئة قائمة البوفيه الافتراضية لفرع ${branchId}`);
    } catch (e) { addNotification({ title: 'فشل تهيئة المخزون', message: e instanceof Error ? e.message : 'تعذر حفظ الأصناف على الخادم', type: 'warning' }); }
  }, [addInventoryItem, recordAudit, addNotification]);

  // --------------------------------------------------------------------------
  // Shifts & Open Sessions Carry-Over
  // (User requirement: open sessions automatically carry over to the next shift!)
  // --------------------------------------------------------------------------
  const startShiftHandover = useCallback((openingCash: number, checklist: HandoverChecklist, notes?: string): Shift => {
    if (activeShift && activeShift.status === 'open' && activeShift.branchId === activeBranchId) {
      throw new Error('توجد وردية مفتوحة بالفعل لهذا الفرع');
    }
    const shiftNumber = `SH-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${shifts.length + 1}`;

    // Count open sessions in this branch to carry over
    const activeOpenSessions = sessions.filter(s => s.branchId === activeBranchId && s.status === 'active');

    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      branchId: activeBranchId,
      shiftNumber,
      cashierName: currentUser?.name || 'كاشير',
      cashierId: currentUser?.id || 'emp-1',
      startTime: Date.now(),
      status: 'open',
      openingCash,
      checklist,
      notes,
      approvedByOwner: false,
      ownerPinVerified: false,
      carriedOverSessionsCount: activeOpenSessions.length,
    };

    setShifts(prev => [newShift, ...prev]);
    setActiveShiftId(newShift.id);

    const tx: SafeTransaction = {
      id: `tx-${Date.now()}`,
      shiftId: newShift.id,
      branchId: activeBranchId,
      type: 'opening_balance',
      amount: openingCash,
      paymentMethod: 'cash',
      description: `افتتاح درج الوردية (${shiftNumber})`,
      performedBy: newShift.cashierName,
      timestamp: Date.now(),
    };
    setSafeTransactions(prev => [tx, ...prev]);

    recordAudit('shift_opened', `فتح شيفت ${shiftNumber} بنقدية ${openingCash} EGP واستلام ${activeOpenSessions.length} جلسة جارية`);
    return newShift;
  }, [activeBranchId, activeShift, currentUser, shifts.length, sessions, recordAudit]);

  const closeShift = useCallback((actualClosingCash: number, ownerPin: string, notes?: string): { success: boolean; message: string; discrepancy?: number } => {
    if (!activeShift) return { success: false, message: 'لا يوجد شيفت مفتوح حالياً' };
    if (!verifyOwnerPin(ownerPin)) return { success: false, message: 'رمز PIN الخاص بالمالك غير صحيح' };

    const shiftTxs = safeTransactions.filter(t => t.shiftId === activeShift.id);
    const cashReceipts = shiftTxs
      .filter(t => (t.type === 'gaming_revenue' || t.type === 'bar_revenue') && t.paymentMethod === 'cash')
      .reduce((sum, t) => sum + t.amount, 0);
    const electronicReceipts = shiftTxs
      .filter(t => (t.type === 'gaming_revenue' || t.type === 'bar_revenue') && t.paymentMethod !== 'cash')
      .reduce((sum, t) => sum + t.amount, 0);
    const cashExpenses = shiftTxs
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const cashWithdrawals = shiftTxs
      .filter(t => t.type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0);
    const cashAdvances = shiftTxs
      .filter(t => t.type === 'advance')
      .reduce((sum, t) => sum + t.amount, 0);

    const closingCalc = calculateShiftClosing({
      openingCash: activeShift.openingCash,
      cashReceipts,
      cashExpenses,
      cashWithdrawals,
      cashAdvances,
      actualClosingCash,
      electronicReceipts,
    });

    // Check still-open sessions to carry over to next shift
    const openSessions = sessions.filter(s => s.branchId === activeShift.branchId && s.status === 'active');

    const updatedShift: Shift = {
      ...activeShift,
      endTime: Date.now(),
      status: 'closed',
      actualClosingCash,
      expectedClosingCash: closingCalc.expectedClosingCash,
      discrepancy: closingCalc.discrepancy,
      notes: notes || activeShift.notes,
      approvedByOwner: true,
      ownerPinVerified: true,
      approvedAt: Date.now(),
      carriedOverSessionsCount: openSessions.length,
      closingFinancials: {
        cashReceipts,
        electronicReceipts,
        cashExpenses,
        cashWithdrawals,
        cashAdvances,
        totalNetRevenue: closingCalc.totalNetRevenue,
      },
    };

    setShifts(prev => prev.map(s => s.id === activeShift.id ? updatedShift : s));
    setActiveShiftId(null);

    recordAudit('shift_closed', `إغلاق شيفت ${activeShift.shiftNumber} بفارق: ${closingCalc.discrepancy} EGP ونقل ${openSessions.length} جلسة مفتوحة للشيفت القادم`);
    return {
      success: true,
      message: 'تم إغلاق الوردية وترحيل الجلسات المفتوحة بنجاح',
      discrepancy: closingCalc.discrepancy,
    };
  }, [activeShift, verifyOwnerPin, safeTransactions, sessions, recordAudit]);

  const recordSafeTransaction = useCallback(async (data: Omit<SafeTransaction, 'id' | 'shiftId' | 'branchId' | 'timestamp' | 'performedBy'>) => {
    if (!activeShiftId) throw new Error('يجب فتح وردية قبل تسجيل حركة الخزنة');
    const typeMap: Record<string, string> = { expense: 'expense', advance: 'advance', withdrawal: 'withdrawal', refund: 'refund', opening_balance: 'opening_balance', adjustment: 'adjustment', debt_collection: 'debt_collection' };
    const type = typeMap[data.type];
    if (!type) throw new Error('نوع الحركة غير مدعوم من API الخزنة');
    const result = await apiRequest<{ transaction: { id: string; created_at: string } }>('/api/finance/cash-transactions', { method: 'POST', body: JSON.stringify({ idempotencyKey: `cash-${crypto.randomUUID()}`, branchId: activeBranchId, shiftId: activeShiftId, type, amount: data.amount, paymentMethod: data.paymentMethod, description: data.description, notes: data.notes || null }) });
    const tx: SafeTransaction = { ...data, id: result.transaction.id, shiftId: activeShiftId, branchId: activeBranchId, performedBy: currentUser?.name || 'المالك', timestamp: Date.parse(result.transaction.created_at) || Date.now() };
    setSafeTransactions(prev => [tx, ...prev]);
    recordAudit('expense_logged', `تسجيل حركة خزنة معتمدة من الخادم: ${data.description} بمبلغ ${data.amount} EGP`);
  }, [activeShiftId, activeBranchId, currentUser, recordAudit, apiRequest]);

  // --------------------------------------------------------------------------
  // Employees, Password Management, Deductions & Leaves
  // --------------------------------------------------------------------------
  const addEmployee = useCallback((data: Omit<Employee, 'id' | 'joinedDate' | 'overtimeRequests' | 'advanceRequests' | 'attendanceLogs' | 'deductions' | 'leaveRequests'>): Employee => {
    const newEmp: Employee = {
      ...data,
      id: `emp-${Date.now()}`,
      joinedDate: new Date().toISOString().slice(0, 10),
      overtimeRequests: [],
      advanceRequests: [],
      attendanceLogs: [],
      deductions: [],
      leaveRequests: [],
    };
    setEmployees(prev => [...prev, newEmp]);
    recordAudit('password_changed', `إضافة موظف جديد: ${data.name} وتعيين كلمة سر`);
    return newEmp;
  }, [recordAudit]);

  const updateEmployee = useCallback((id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const transferEmployeeBranch = useCallback((employeeId: string, targetBranchId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    const targetBranch = branches.find(b => b.id === targetBranchId && b.isActive);
    if (!employee) return { success: false, message: 'الموظف غير موجود' };
    if (!targetBranch) return { success: false, message: 'الفرع المستهدف غير موجود أو غير نشط' };
    if (employee.branchId === targetBranchId) return { success: false, message: 'الموظف موجود بالفعل في هذا الفرع' };

    const fromBranch = branches.find(b => b.id === employee.branchId);
    setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, branchId: targetBranchId } : e));
    recordAudit('employee_branch_transfer', `نقل الموظف ${employee.name} من ${fromBranch?.nameAr || employee.branchId} إلى ${targetBranch.nameAr}`);
    addNotification({
      title: 'تم نقل الموظف بين الفروع',
      message: `تم نقل ${employee.name} إلى ${targetBranch.nameAr}`,
      type: 'success',
    });
    return { success: true, message: `تم نقل الموظف إلى ${targetBranch.nameAr}` };
  }, [employees, branches, recordAudit, addNotification]);

  const updateEmployeePassword = useCallback((employeeId: string, newPin: string) => {
    setEmployees(prev => prev.map(e => {
      if (e.id === employeeId) {
        const hashed = hashPinOrPassword(newPin);
        recordAudit('password_changed', `تغيير كلمة سر الموظف: ${e.name}`);
        return { ...e, pinOrPassword: hashed };
      }
      return e;
    }));
    addNotification({
      title: 'تم تحديث كلمة السر',
      message: 'تم تعديل كلمة سر الموظف وتشفيرها بنجاح.',
      type: 'success',
    });
  }, [recordAudit, addNotification]);

  const updateEmployeePermissions = useCallback((employeeId: string, permissions: RolePermissions) => {
    setEmployees(prev => prev.map(e => {
      if (e.id === employeeId) {
        return { ...e, customPermissions: permissions };
      }
      return e;
    }));
    recordAudit('password_changed', `تعديل صلاحيات الموظف`);
    addNotification({
      title: 'تحديث الصلاحيات',
      message: 'تم تحديث مصفوفة صلاحيات الموظف بنجاح.',
      type: 'success',
    });
  }, [recordAudit, addNotification]);

  const addEmployeeDeduction = useCallback((employeeId: string, amount: number, reason: string) => {
    const deduction: Deduction = {
      id: `ded-${Date.now()}`,
      amount,
      reason,
      date: new Date().toISOString().slice(0, 10),
      createdBy: currentUser?.name || 'المالك',
      createdAt: Date.now(),
    };

    setEmployees(prev => prev.map(e => {
      if (e.id === employeeId) {
        return {
          ...e,
          deductions: [...(e.deductions || []), deduction],
        };
      }
      return e;
    }));

    recordAudit('deduction_added', `خصم ${amount} EGP على الموظف بسبب: ${reason}`);
    addNotification({
      title: 'تم تطبيق خصم',
      message: `تم تطبيق خصم ${amount} ج.م بسبب: ${reason}`,
      type: 'warning',
    });
  }, [currentUser, recordAudit, addNotification]);

  const requestLeave = useCallback((employeeId: string, daysCount: number, reason: string) => {
    const req: LeaveRequest = {
      id: `leave-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      daysCount,
      reason,
      status: 'pending',
      requestedAt: Date.now(),
    };

    setEmployees(prev => prev.map(e => {
      if (e.id === employeeId) {
        return {
          ...e,
          leaveRequests: [...(e.leaveRequests || []), req],
        };
      }
      return e;
    }));

    addNotification({
      title: 'طلب إجازة جديد',
      message: `طلب إجازة لمدة ${daysCount} يوم ينتظر مراجعة الإدارة.`,
      type: 'info',
    });
  }, [addNotification]);

  const reviewLeaveRequest = useCallback((employeeId: string, requestId: string, approve: boolean) => {
    setEmployees(prev => prev.map(e => {
      if (e.id !== employeeId) return e;
      return {
        ...e,
        leaveRequests: (e.leaveRequests || []).map(r => r.id === requestId ? {
          ...r,
          status: approve ? 'approved' : 'rejected',
          reviewedBy: currentUser?.name || 'المالك',
          reviewedAt: Date.now(),
        } : r),
        status: approve ? 'on_leave' : e.status,
      };
    }));
    recordAudit(approve ? 'leave_approved' : 'leave_rejected', `قرار الإجازة: ${approve ? 'موافقة' : 'رفض'}`);
  }, [currentUser, recordAudit]);

  const requestOvertime = useCallback((employeeId: string, hours: number, hourlyRate: number, reason: string) => {
    setEmployees(prev => prev.map(e => {
      if (e.id !== employeeId) return e;
      const newReq = {
        id: `ot-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        hours,
        hourlyRate,
        reason,
        status: 'pending' as const,
        requestedAt: Date.now(),
      };
      return {
        ...e,
        overtimeRequests: [...e.overtimeRequests, newReq],
      };
    }));
    addNotification({
      title: 'طلب أوفر تايم جديد',
      message: `تم تسجيل طلب عمل إضافي (${hours} ساعة)`,
      type: 'warning',
    });
  }, [addNotification]);

  const reviewOvertimeRequest = useCallback((employeeId: string, requestId: string, approve: boolean) => {
    setEmployees(prev => prev.map(e => {
      if (e.id !== employeeId) return e;
      return {
        ...e,
        overtimeRequests: e.overtimeRequests.map(r => r.id === requestId ? {
          ...r,
          status: approve ? 'approved' : 'rejected',
          reviewedBy: currentUser?.name || 'المالك',
          reviewedAt: Date.now(),
        } : r),
      };
    }));
    recordAudit(approve ? 'overtime_approved' : 'overtime_rejected', `مراجعة أوفر تايم: ${approve ? 'تم القبول' : 'تم الرفض'}`);
  }, [currentUser, recordAudit]);

  const recordAttendance = useCallback((employeeId: string, status: 'present' | 'absent' | 'late' | 'excused', delayMinutes = 0) => {
    const today = new Date().toISOString().slice(0, 10);
    setEmployees(prev => prev.map(e => {
      if (e.id !== employeeId) return e;
      const existing = e.attendanceLogs.find(a => a.date === today);
      if (existing) {
        return {
          ...e,
          attendanceLogs: e.attendanceLogs.map(a => a.date === today ? { ...a, status, delayMinutes } : a),
        };
      }
      return {
        ...e,
        attendanceLogs: [...e.attendanceLogs, { id: `att-${Date.now()}`, date: today, clockIn: Date.now(), status, delayMinutes }],
      };
    }));
  }, []);

  const clockInEmployee = useCallback((employeeId: string) => {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    setEmployees(prev => prev.map(e => {
      if (e.id !== employeeId) return e;
      const todayLog = e.attendanceLogs.find(log => log.date === today);
      if (todayLog && !todayLog.clockOut) return e;
      const nextLog = { id: todayLog?.id || `att-${now}`, date: today, clockIn: now, status: 'present' as const, delayMinutes: 0 };
      return {
        ...e,
        attendanceLogs: todayLog
          ? e.attendanceLogs.map(log => log.date === today ? nextLog : log)
          : [...e.attendanceLogs, nextLog],
      };
    }));
    recordAudit('attendance_clock_in', `حضور الموظف ${employee.name} الساعة ${new Date(now).toLocaleTimeString('ar-EG')}`);
  }, [employees, recordAudit]);

  const clockOutEmployee = useCallback((employeeId: string) => {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    setEmployees(prev => prev.map(e => {
      if (e.id !== employeeId) return e;
      const todayLog = e.attendanceLogs.find(log => log.date === today);
      if (!todayLog || todayLog.clockOut) return e;
      return { ...e, attendanceLogs: e.attendanceLogs.map(log => log.date === today ? { ...log, clockOut: now } : log) };
    }));
    recordAudit('attendance_clock_out', `انصراف الموظف ${employee.name} الساعة ${new Date(now).toLocaleTimeString('ar-EG')}`);
  }, [employees, recordAudit]);

  // --------------------------------------------------------------------------
  // Pricing, Settings & Theme
  // --------------------------------------------------------------------------
  const updatePricingTier = useCallback((tierId: string, newPriceEgp: number) => {
    setPricingTiers(prev => prev.map(t => {
      if (t.id === tierId) {
        recordAudit('price_change', `تعديل السعر (${t.durationMinutes} دقيقة - ${t.deviceType}) إلى ${newPriceEgp} EGP`);
        return { ...t, priceEgp: newPriceEgp };
      }
      return t;
    }));
  }, [recordAudit]);

  const setRoundingPolicy = useCallback((policy: RoundingPolicy) => {
    setRoundingPolicyState(policy);
    recordAudit('price_change', `تعديل سياسة التقريب: ${policy}`);
  }, [recordAudit]);

  const updateRolePermissions = useCallback((role: 'cashier' | 'supervisor' | 'technician', permissions: RolePermissions) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: permissions,
    }));
    recordAudit('price_change', `تعديل صلاحيات الدور: ${role}`);
  }, [recordAudit]);

  const setAppLang = useCallback((lang: 'ar' | 'en') => {
    setAppLangState(lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, []);

  const setThemeAccent = useCallback((theme: 'red' | 'blue' | 'emerald' | 'purple' | 'amber') => {
    setThemeAccentState(theme);
  }, []);

  const updateSupabaseConfig = useCallback((config: Partial<SupabaseConfig>) => {
    setSupabaseConfigState(prev => ({ ...prev, ...config }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ownerProfile,
        currentUser,
        branches,
        activeBranch,
        devices,
        sessions,
        waitlist,
        inventory,
        shifts,
        activeShift,
        safeTransactions,
        employees,
        rolePermissions,
        auditLog,
        offlineQueue,
        pricingTiers,
        roundingPolicy,
        notifications,
        isOnline,
        activeView,
        appLang,
        themeAccent,
        supabaseConfig,
        setActiveView,
        setActiveBranchId,
        setAppLang,
        setThemeAccent,
        updateSupabaseConfig,
        setupPrimaryOwner,
        registerOwnerAccount,
        resendOwnerConfirmation,
        loginWithSupabase,
        loginUser,
        verify2FACode,
        logoutUser,
        verifyOwnerPin,
        addBranch,
        updateBranch,
        addDevice,
        updateDevice,
        deleteDevice,
        populateDefaultBranchDevices,
        startSession,
        changeSessionControllers,
        addSessionProduct,
        markProductPaid,
        transferSession,
        switchSessionDeviceType,
        completeSession,
        collectSessionDebt,
        updateEmployeePermissions,
        addToWaitlist,
        updateWaitlistItemStatus,
        addInventoryItem,
        updateInventoryItem,
        sellBarItemDirect,
        sellBarItems,
        initializeDefaultCatalogueForBranch,
        startShiftHandover,
        closeShift,
        recordSafeTransaction,
        addEmployee,
        updateEmployee,
        transferEmployeeBranch,
        updateEmployeePassword,
        addEmployeeDeduction,
        requestLeave,
        reviewLeaveRequest,
        requestOvertime,
        reviewOvertimeRequest,
        recordAttendance,
        clockInEmployee,
        clockOutEmployee,
        updatePricingTier,
        setRoundingPolicy,
        updateRolePermissions,
        syncOfflineQueue,
        markNotificationRead,
        clearAllNotifications,
        addNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
