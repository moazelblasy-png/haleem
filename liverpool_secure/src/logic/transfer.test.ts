import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSessionTransfer, executeSessionTransfer } from './transfer';
import { Device, GameSession, PriceTier } from '../types';

const mockPriceTiers: PriceTier[] = [
  { id: '1', deviceType: 'PS4', controllers: 2, durationMinutes: 60, priceEgp: 20 },
  { id: '2', deviceType: 'PS5', controllers: 2, durationMinutes: 60, priceEgp: 30 },
];

const mockBaseSession: GameSession = {
  id: 'sess-123',
  sessionNumber: '#S261017-001',
  deviceId: 'dev-ps4-1',
  branchId: 'branch-liverpool',
  customerName: 'محمد أحمد',
  customerPhone: '01099887766',
  gameName: 'FC 24',
  sessionType: 'open',
  startTime: 1000000,
  segments: [
    {
      id: 'seg-1',
      deviceType: 'PS4',
      controllers: 2,
      startTime: 1000000,
    },
  ],
  products: [
    {
      id: 'p-1',
      productId: 'inv-tea',
      name: 'شاي كشري',
      quantity: 2,
      unitPrice: 10,
      unitCost: 3,
      isPaid: false,
      addedAt: 1000500,
      addedBy: 'كاشير',
    },
  ],
  status: 'active',
  discountType: 'none',
  discountValue: 0,
  paidAmount: 50, // Prepaid 50 EGP
  isPrepaid: true,
};

const devSourcePS4: Device = {
  id: 'dev-ps4-1',
  screenNumber: 'شاشة 01',
  name: 'شاشة 1 PS4',
  branchId: 'branch-liverpool',
  type: 'PS4',
  status: 'busy',
  installedGames: ['FC 24'],
  activeSessionId: 'sess-123',
};

const devTargetPS5: Device = {
  id: 'dev-ps5-2',
  screenNumber: 'شاشة 02',
  name: 'شاشة 2 PS5',
  branchId: 'branch-liverpool',
  type: 'PS5',
  status: 'available',
  installedGames: ['FC 24'],
};

const devBusyPS5: Device = {
  id: 'dev-ps5-3',
  screenNumber: 'شاشة 03',
  name: 'شاشة 3 PS5',
  branchId: 'branch-liverpool',
  type: 'PS5',
  status: 'busy',
  installedGames: ['FC 24'],
  activeSessionId: 'sess-999',
};

const devMaintenancePS4: Device = {
  id: 'dev-ps4-4',
  screenNumber: 'شاشة 04',
  name: 'شاشة 4 PS4',
  branchId: 'branch-liverpool',
  type: 'PS4',
  status: 'maintenance',
  installedGames: ['FC 24'],
};

const devOtherBranchPS5: Device = {
  id: 'dev-ps5-chelsea',
  screenNumber: 'شاشة 01',
  name: 'شاشة 1 تشيلسي',
  branchId: 'branch-chelsea',
  type: 'PS5',
  status: 'available',
  installedGames: ['FC 24'],
};

test('Test 7: Transfer PS4 to available PS5 console successfully', () => {
  const validation = validateSessionTransfer(mockBaseSession, devSourcePS4, devTargetPS5, [mockBaseSession]);
  assert.equal(validation.isValid, true, 'Validation should pass for available target');

  const now = 1003600; // 1 hour later
  const res = executeSessionTransfer(mockBaseSession, devSourcePS4, devTargetPS5, 'كاشير الشفت', now, mockPriceTiers);

  assert.equal(res.success, true);
  assert.equal(res.updatedSession?.deviceId, 'dev-ps5-2');
  assert.equal(res.updatedSession?.id, 'sess-123', 'Preserves original session ID');
  assert.equal(res.updatedSession?.paidAmount, 50, 'Preserves paid amount');
  assert.equal(res.updatedSession?.products.length, 1, 'Preserves attached products');
  assert.equal(res.updatedSession?.segments.length, 2, 'Creates a second segment for PS5 rate');
  assert.equal(res.updatedSession?.segments[0].endTime, now, 'Closes old PS4 segment');
  assert.equal(res.updatedSession?.segments[1].deviceType, 'PS5', 'Opens new PS5 segment');
  assert.equal(res.updatedOldDevice?.status, 'available', 'Old device becomes available');
  assert.equal(res.updatedTargetDevice?.status, 'busy', 'Target device becomes busy');
  assert.equal(res.updatedSession?.transferHistory?.length, 1, 'Records transfer in history');
});

test('Test 8: Reject transfer to a busy device', () => {
  const activeSessions = [mockBaseSession, { ...mockBaseSession, id: 'sess-999', deviceId: 'dev-ps5-3' }];
  const validation = validateSessionTransfer(mockBaseSession, devSourcePS4, devBusyPS5, activeSessions);
  assert.equal(validation.isValid, false);
  assert.match(validation.errorMessage || '', /مشغول/);
});

test('Test 9: Reject transfer to a device under maintenance', () => {
  const validation = validateSessionTransfer(mockBaseSession, devSourcePS4, devMaintenancePS4, [mockBaseSession]);
  assert.equal(validation.isValid, false);
  assert.match(validation.errorMessage || '', /صيانة/);
});

test('Test 10: Reject transfer to a device in another branch', () => {
  const validation = validateSessionTransfer(mockBaseSession, devSourcePS4, devOtherBranchPS5, [mockBaseSession]);
  assert.equal(validation.isValid, false);
  assert.match(validation.errorMessage || '', /فرع/);
});

test('Test 11 & 14: Preserves all financial and product data during timed session transfer', () => {
  const timedSession: GameSession = {
    ...mockBaseSession,
    sessionType: 'timed',
    plannedDurationMinutes: 120,
    remainingDebt: 15,
  };

  const validation = validateSessionTransfer(timedSession, devSourcePS4, devTargetPS5, [timedSession]);
  assert.equal(validation.isValid, true);

  const res = executeSessionTransfer(timedSession, devSourcePS4, devTargetPS5, 'كاشير الشفت', 1002000, mockPriceTiers);
  assert.equal(res.updatedSession?.sessionType, 'timed');
  assert.equal(res.updatedSession?.plannedDurationMinutes, 120, 'Preserves planned duration');
  assert.equal(res.updatedSession?.remainingDebt, 15, 'Preserves remaining debt');
  assert.equal(res.updatedSession?.startTime, 1000000, 'Does NOT reset elapsed timer');
});
