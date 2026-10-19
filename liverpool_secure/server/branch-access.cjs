'use strict';

const MANAGEMENT_ROLES = new Set(['owner', 'admin']);
const VALID_BRANCH_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;

// Staff may update only operational state for their assigned branch. Inventory is
// authoritative in liverpool_inventory and is intentionally excluded here.
const BRANCH_SCOPED_ARRAY_STATE_KEYS = new Set([
  'lg_devices',
  'lg_sessions',
  'lg_waitlist',
  'lg_shifts',
  'lg_notifications',
]);
const STAFF_STATE_WRITERS = {
  lg_devices: new Set(['supervisor', 'technician']),
  lg_sessions: new Set(['supervisor', 'cashier']),
  lg_waitlist: new Set(['supervisor', 'cashier']),
  lg_shifts: new Set(['supervisor', 'cashier']),
  lg_active_shift_id: new Set(['supervisor', 'cashier']),
  lg_notifications: new Set(['supervisor', 'cashier', 'technician']),
};

function canWriteBranchScopedState(role, key) {
  return Boolean(STAFF_STATE_WRITERS[key]?.has(role));
}

/**
 * Replace one branch's partition without overwriting any other branch's records.
 * The caller must hold a database row lock around the read/merge/write operation.
 */
function mergeBranchScopedArray(currentValue, incomingValue, branchId, key) {
  if (!BRANCH_SCOPED_ARRAY_STATE_KEYS.has(key)) {
    throw new Error('State key is not branch-mergeable.');
  }
  if (!validBranchId(branchId) || !Array.isArray(incomingValue)) {
    throw new Error('Branch-scoped state must be an array for a valid branch.');
  }

  const seen = new Set();
  for (const item of incomingValue) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || item.branchId !== branchId) {
      throw new Error('Branch-scoped state contains an item outside the assigned branch.');
    }
    if (typeof item.id !== 'string' || item.id.length < 1 || item.id.length > 160 || seen.has(item.id)) {
      throw new Error('Branch-scoped state contains an invalid or duplicate item id.');
    }
    seen.add(item.id);
  }

  const current = Array.isArray(currentValue) ? currentValue : [];
  return [
    ...current.filter((item) => !item || item.branchId !== branchId),
    ...incomingValue,
  ];
}

function isManagementRole(role) {
  return MANAGEMENT_ROLES.has(role);
}

function validBranchId(branchId) {
  return typeof branchId === 'string' && VALID_BRANCH_ID.test(branchId);
}

function authorizeBranch(auth, branchId) {
  if (isManagementRole(auth?.role)) return { allowed: true };
  if (!auth?.branchScopeConfigured) {
    return {
      allowed: false,
      status: 503,
      code: 'BRANCH_SCOPE_NOT_CONFIGURED',
      message: 'Branch access is not configured yet. Apply the branch-membership database migration.',
    };
  }
  if (!auth.branchId) {
    return {
      allowed: false,
      status: 403,
      code: 'BRANCH_NOT_ASSIGNED',
      message: 'This account must be assigned to a branch by the owner.',
    };
  }
  if (!validBranchId(branchId)) {
    return {
      allowed: false,
      status: 400,
      code: 'BRANCH_REQUIRED',
      message: 'A valid branch is required.',
    };
  }
  if (branchId !== auth.branchId) {
    return {
      allowed: false,
      status: 403,
      code: 'BRANCH_MISMATCH',
      message: 'This account cannot access another branch.',
    };
  }
  return { allowed: true };
}

function resolveBranchFilter(auth, requestedBranchId) {
  if (isManagementRole(auth?.role)) {
    if (requestedBranchId != null && requestedBranchId !== '' && !validBranchId(requestedBranchId)) {
      return {
        allowed: false,
        status: 400,
        code: 'INVALID_BRANCH',
        message: 'Branch filter is invalid.',
      };
    }
    return { allowed: true, branchId: requestedBranchId || null };
  }

  const effectiveBranchId = requestedBranchId || auth?.branchId;
  const decision = authorizeBranch(auth, effectiveBranchId);
  return { ...decision, branchId: decision.allowed ? auth.branchId : null };
}

function scopeOperationalState(state, branchId) {
  const scoped = { ...state };
  scoped.lg_branches = Array.isArray(state.lg_branches)
    ? state.lg_branches.filter((branch) => branch && branch.id === branchId)
    : [];
  scoped.lg_active_branch_id = branchId;

  for (const key of ['lg_devices', 'lg_sessions', 'lg_waitlist', 'lg_inventory', 'lg_shifts']) {
    scoped[key] = Array.isArray(state[key])
      ? state[key].filter((item) => item && item.branchId === branchId)
      : [];
  }

  const assignedShiftExists = scoped.lg_shifts.some((shift) => shift.id === state.lg_active_shift_id);
  scoped.lg_active_shift_id = assignedShiftExists ? state.lg_active_shift_id : null;

  // Notifications without an explicit branch assignment are not exposed to branch staff.
  scoped.lg_notifications = Array.isArray(state.lg_notifications)
    ? state.lg_notifications.filter((notification) => notification && notification.branchId === branchId)
    : [];

  return scoped;
}

module.exports = {
  BRANCH_SCOPED_ARRAY_STATE_KEYS,
  canWriteBranchScopedState,
  mergeBranchScopedArray,
  authorizeBranch,
  isManagementRole,
  resolveBranchFilter,
  scopeOperationalState,
  validBranchId,
};
