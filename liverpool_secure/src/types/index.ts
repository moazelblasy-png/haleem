/**
 * Liverpool Gaming - Comprehensive Type Definitions
 */

export type DeviceType = 'PS4' | 'PS5';
export type ControllersCount = 2 | 3 | 4;
export type RoundingPolicy = 'ceil_quarter' | 'ceil_tier' | 'exact_minute';

export interface PriceTier {
  id: string;
  deviceType: DeviceType;
  controllers: ControllersCount;
  durationMinutes: number; // 15, 30, 45, 60, 75, 90, 105, 120
  priceEgp: number;
}

export interface SessionSegment {
  id: string;
  deviceType: DeviceType;
  controllers: ControllersCount;
  startTime: number; // timestamp in ms
  endTime?: number;  // timestamp in ms (or current if active)
  appliedPriceTiers?: PriceTier[];
  changedBy?: string;
}

export type UserRole = 'owner' | 'cashier' | 'supervisor' | 'technician';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  branchId?: string;
  pinOrPassword: string;
  isOwner?: boolean;
}

export interface OwnerProfile {
  id: string;
  name: string;
  phone: string;
  pinHash: string;
  businessName: string;
  subscriptionPlan: string;
  renewalDate: string;
  createdAt: number;
  twoFactorEnabled?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  nameAr: string;
  code: string;
  logo: string;
  address: string;
  phone: string;
  isActive: boolean;
}

export type DeviceStatus = 'available' | 'busy' | 'overdue' | 'maintenance' | 'offline';

export interface Device {
  id: string;
  screenNumber: string; // e.g. "شاشة 01"
  name: string;
  branchId: string;
  type: DeviceType; // 'PS4' | 'PS5'
  status: DeviceStatus;
  currentGame?: string;
  installedGames: string[];
  activeSessionId?: string;
  downtimeLogs?: Array<{
    id: string;
    startedAt: number;
    endedAt?: number;
    reason: string;
  }>;
}

export type SessionType = 'open' | 'timed' | 'budget';

export interface SessionProductItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number; // Owner only
  isPaid: boolean;
  addedAt: number;
  addedBy: string;
}

export interface SplitPaymentPortion {
  method: 'cash' | 'instapay' | 'vodafone' | 'card';
  amount: number;
}

export interface SessionTransferRecord {
  id: string;
  fromDeviceId: string;
  fromScreenNumber: string;
  fromDeviceType: DeviceType;
  toDeviceId: string;
  toScreenNumber: string;
  toDeviceType: DeviceType;
  transferredAt: number;
  transferredBy: string;
  reason?: string;
}

export interface GameSession {
  id: string;
  sessionNumber: string; // e.g. "#S250525-001"
  deviceId: string;
  branchId: string;
  customerName: string;
  customerPhone?: string;
  gameName: string;
  sessionType: SessionType;
  startTime: number;
  startedBy?: string;
  plannedDurationMinutes?: number;
  budgetEgp?: number;
  segments: SessionSegment[];
  products: SessionProductItem[];
  status: 'active' | 'completed' | 'cancelled';
  discountType: 'none' | 'fixed' | 'percent';
  discountValue: number;
  paidAmount: number;
  paymentMethod?: 'cash' | 'instapay' | 'vodafone' | 'card' | 'split';
  splitPayments?: SplitPaymentPortion[];
  isPrepaid: boolean;
  isFullyPaid?: boolean;
  notes?: string;
  completedAt?: number;
  completedBy?: string;
  finalGamingCost?: number;
  finalProductsTotal?: number;
  finalGrandTotal?: number;
  remainingDebt?: number;
  debtPaidHistory?: Array<{
    amount: number;
    paidAt: number;
    paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card';
    receivedBy: string;
  }>;
  changeGiven?: number;
  carriedOverFromShiftId?: string;
  transferHistory?: SessionTransferRecord[];
  fiveMinWarned?: boolean;
  endedAlarmPlayed?: boolean;
}

export interface WaitlistItem {
  id: string;
  customerName: string;
  customerPhone: string;
  gameRequested: string;
  preferredDeviceType?: DeviceType;
  branchId: string;
  createdAt: number;
  status: 'waiting' | 'called' | 'seated' | 'cancelled';
}

export interface InventoryItem {
  id: string;
  branchId: string;
  name: string;
  category: 'hot_drinks' | 'cold_drinks' | 'food' | 'snacks' | 'other';
  sellingPrice: number;
  costPrice: number; // Owner only
  stockQuantity: number;
  minStockThreshold: number;
  imageUrl?: string;
}

export interface HandoverChecklist {
  cashCounted: boolean;
  ps4Checked: boolean;
  ps5Checked: boolean;
  controllersCounted: boolean;
  controllersCount: number;
  cupsStockChecked: boolean;
  teaStockChecked: boolean;
  coffeeStockChecked: boolean;
  noodleStockChecked: boolean;
  notes?: string;
}

export interface Shift {
  id: string;
  branchId: string;
  shiftNumber: string;
  cashierName: string;
  cashierId: string;
  startTime: number;
  endTime?: number;
  status: 'open' | 'closed';
  openingCash: number;
  actualClosingCash?: number;
  expectedClosingCash?: number;
  discrepancy?: number;
  checklist: HandoverChecklist;
  receivingCashierName?: string;
  receivingCashierId?: string;
  notes?: string;
  approvedByOwner: boolean;
  ownerPinVerified: boolean;
  approvedAt?: number;
  carriedOverSessionsCount?: number;
  closingFinancials?: {
    cashReceipts: number;
    electronicReceipts: number;
    cashExpenses: number;
    cashWithdrawals: number;
    cashAdvances: number;
    totalNetRevenue: number;
  };
}

export type SafeTransactionType =
  | 'gaming_revenue'
  | 'bar_revenue'
  | 'debt_collection'
  | 'refund'
  | 'expense'
  | 'withdrawal'
  | 'advance'
  | 'opening_balance'
  | 'adjustment';

export interface SafeTransaction {
  id: string;
  shiftId: string;
  branchId: string;
  type: SafeTransactionType;
  amount: number;
  paymentMethod: 'cash' | 'instapay' | 'vodafone' | 'card';
  description: string;
  category?: string;
  performedBy: string;
  timestamp: number;
  receiptNumber?: string;
  notes?: string;
}

export interface Deduction {
  id: string;
  date: string;
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: number;
}

export interface LeaveRequest {
  id: string;
  date: string;
  daysCount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}

export interface OvertimeRequest {
  id: string;
  date: string;
  hours: number;
  hourlyRate: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  requestedAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}

export interface AdvanceRequest {
  id: string;
  date: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  requestedAt: number;
}

export interface AttendanceLog {
  id: string;
  date: string;
  clockIn: number;
  clockOut?: number;
  delayMinutes: number;
  status: 'present' | 'absent' | 'late' | 'excused';
}

export interface Employee {
  id: string;
  name: string;
  role: 'cashier' | 'supervisor' | 'technician';
  branchId: string;
  phone: string;
  pinOrPassword?: string;
  shiftType: 'morning' | 'night';
  salaryMonthly: number;
  dailyRate: number;
  status: 'active' | 'on_leave' | 'inactive' | 'pending_approval';
  joinedDate: string;
  overtimeRequests: OvertimeRequest[];
  advanceRequests: AdvanceRequest[];
  attendanceLogs: AttendanceLog[];
  deductions: Deduction[];
  leaveRequests: LeaveRequest[];
  customPermissions?: RolePermissions;
}

export interface RolePermissions {
  dashboard: boolean;
  cashier: boolean;
  devices: boolean;
  inventory: boolean;
  reports: boolean;
  settings: boolean;
  viewProfits: boolean;
  editPrices: boolean;
  approveOvertime: boolean;
  manageEmployees: boolean;
  recordExpenses: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  branchId: string;
  actionType:
    | 'session_started'
    | 'session_completed'
    | 'session_controller_change'
    | 'session_device_type_change'
    | 'attendance_clock_in'
    | 'attendance_clock_out'
    | 'price_change'
    | 'discount_applied'
    | 'payment_received'
    | 'session_transfer'
    | 'session_swap'
    | 'employee_branch_transfer'
    | 'shift_opened'
    | 'shift_closed'
    | 'expense_logged'
    | 'advance_logged'
    | 'withdrawal_logged'
    | 'stock_adjustment'
    | 'overtime_approved'
    | 'overtime_rejected'
    | 'password_changed'
    | 'deduction_added'
    | 'leave_approved'
    | 'leave_rejected';
  description: string;
  oldValue?: string;
  newValue?: string;
  deviceOrSessionRef?: string;
  isOfflineSynced?: boolean;
}

export interface OfflineAction {
  id: string;
  idempotencyKey: string;
  action: string;
  payload: any;
  performedBy: string;
  performedAt: number;
  status: 'pending' | 'synced' | 'failed';
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'alert' | 'info' | 'success';
  timestamp: number;
  isRead: boolean;
  actionLink?: string;
}
