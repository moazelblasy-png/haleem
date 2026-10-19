/**
 * Liverpool Gaming - Device Transfer Engine
 * Pure logic module for validating and applying session transfers between physical PlayStation consoles.
 * Strictly verifies device availability, branch matching, segment creation, and state integrity.
 */

import { Device, GameSession, DeviceType, SessionTransferRecord, SessionSegment, PriceTier } from '../types';
import { newRuntimeId } from '../utils/runtime';

export interface TransferValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export interface ExecuteTransferResult {
  success: boolean;
  errorMessage?: string;
  updatedSession?: GameSession;
  updatedOldDevice?: Device;
  updatedTargetDevice?: Device;
  transferRecord?: SessionTransferRecord;
}

/**
 * Validates whether a session can be transferred from source device to target device.
 */
export function validateSessionTransfer(
  session: GameSession | undefined,
  fromDevice: Device | undefined,
  targetDevice: Device | undefined,
  allActiveSessions: GameSession[]
): TransferValidationResult {
  if (!session) {
    return { isValid: false, errorMessage: 'الجلسة غير موجودة' };
  }

  if (session.status !== 'active') {
    return { isValid: false, errorMessage: 'لا يمكن نقل جلسة غير نشطة أو مكتملة' };
  }

  if (!fromDevice) {
    return { isValid: false, errorMessage: 'الجهاز الحالي غير موجود' };
  }

  if (!targetDevice) {
    return { isValid: false, errorMessage: 'الجهاز المستهدف غير موجود' };
  }

  if (fromDevice.id === targetDevice.id) {
    return { isValid: false, errorMessage: 'لا يمكن نقل الجلسة لنفس الجهاز الحالي' };
  }

  // Branch check: Cannot transfer across different branches
  if (fromDevice.branchId !== targetDevice.branchId) {
    return { isValid: false, errorMessage: 'لا يمكن نقل الجلسة إلى فرع آخر' };
  }

  if (session.branchId !== targetDevice.branchId) {
    return { isValid: false, errorMessage: 'فرع الجلسة لا يطابق فرع الجهاز المستهدف' };
  }

  // Device availability check: target must NOT be busy or maintenance or offline
  if (targetDevice.status === 'maintenance') {
    return { isValid: false, errorMessage: 'الجهاز المستهدف تحت الصيانة وخارج الخدمة' };
  }

  if (targetDevice.status === 'offline') {
    return { isValid: false, errorMessage: 'الجهاز المستهدف غير متصل حالياً' };
  }

  if (targetDevice.status === 'busy' || targetDevice.status === 'overdue') {
    return { isValid: false, errorMessage: 'الجهاز المستهدف مشغول حالياً بجلسة أخرى' };
  }

  // Check if any other active session is currently running on the target device
  const conflictingSession = allActiveSessions.find(
    s => s.deviceId === targetDevice.id && s.status === 'active' && s.id !== session.id
  );
  if (conflictingSession) {
    return { isValid: false, errorMessage: 'توجد جلسة نشطة بالفعل على هذا الجهاز' };
  }

  return { isValid: true };
}

/**
 * Executes a clean, atomic session transfer between physical devices.
 */
export function executeSessionTransfer(
  session: GameSession,
  fromDevice: Device,
  targetDevice: Device,
  transferredBy: string,
  nowMs: number,
  pricingTiers: PriceTier[],
  reason?: string
): ExecuteTransferResult {
  const currentSegments = [...session.segments];
  const lastSeg = currentSegments[currentSegments.length - 1];
  const lastControllers = lastSeg?.controllers || 2;

  // If transferring to a different device type (PS4 -> PS5 or PS5 -> PS4), create a new segment
  if (lastSeg && lastSeg.deviceType !== targetDevice.type) {
    if (!lastSeg.endTime) {
      lastSeg.endTime = nowMs;
    }
    const newSegment: SessionSegment = {
      id: `seg-${nowMs}-${currentSegments.length + 1}`,
      deviceType: targetDevice.type,
      controllers: lastControllers,
      startTime: nowMs,
      appliedPriceTiers: [...pricingTiers],
    };
    currentSegments.push(newSegment);
  }

  const transferRecord: SessionTransferRecord = {
    id: newRuntimeId('xfer'),
    fromDeviceId: fromDevice.id,
    fromScreenNumber: fromDevice.screenNumber,
    fromDeviceType: fromDevice.type,
    toDeviceId: targetDevice.id,
    toScreenNumber: targetDevice.screenNumber,
    toDeviceType: targetDevice.type,
    transferredAt: nowMs,
    transferredBy,
    reason: reason || `نقل من ${fromDevice.screenNumber} إلى ${targetDevice.screenNumber}`,
  };

  const updatedSession: GameSession = {
    ...session,
    deviceId: targetDevice.id,
    segments: currentSegments,
    transferHistory: [...(session.transferHistory || []), transferRecord],
  };

  const updatedOldDevice: Device = {
    ...fromDevice,
    status: 'available',
    currentGame: undefined,
    activeSessionId: undefined,
  };

  const updatedTargetDevice: Device = {
    ...targetDevice,
    status: 'busy',
    currentGame: session.gameName,
    activeSessionId: session.id,
  };

  return {
    success: true,
    updatedSession,
    updatedOldDevice,
    updatedTargetDevice,
    transferRecord,
  };
}
