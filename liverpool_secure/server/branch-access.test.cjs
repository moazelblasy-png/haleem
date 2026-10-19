'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  authorizeBranch,
  canWriteBranchScopedState,
  mergeBranchScopedArray,
  resolveBranchFilter,
  scopeOperationalState,
} = require('./branch-access.cjs');

test('owner and admin can access any branch', () => {
  assert.deepEqual(authorizeBranch({ role: 'owner', branchScopeConfigured: false }, 'chelsea'), { allowed: true });
  assert.deepEqual(authorizeBranch({ role: 'admin', branchScopeConfigured: true }, 'anfield'), { allowed: true });
});

test('staff fail closed before branch-scope migration is available', () => {
  const result = authorizeBranch({ role: 'cashier', branchId: null, branchScopeConfigured: false }, 'liverpool');
  assert.equal(result.allowed, false);
  assert.equal(result.status, 503);
  assert.equal(result.code, 'BRANCH_SCOPE_NOT_CONFIGURED');
});

test('unassigned staff cannot access operational data', () => {
  const result = authorizeBranch({ role: 'supervisor', branchId: null, branchScopeConfigured: true }, 'liverpool');
  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
  assert.equal(result.code, 'BRANCH_NOT_ASSIGNED');
});

test('assigned staff can access only their exact branch', () => {
  const auth = { role: 'cashier', branchId: 'liverpool', branchScopeConfigured: true };
  assert.deepEqual(authorizeBranch(auth, 'liverpool'), { allowed: true });
  assert.equal(authorizeBranch(auth, 'chelsea').code, 'BRANCH_MISMATCH');
});

test('branch list filtering defaults a staff user to their assigned branch', () => {
  const auth = { role: 'supervisor', branchId: 'chelsea', branchScopeConfigured: true };
  assert.deepEqual(resolveBranchFilter(auth, null), { allowed: true, branchId: 'chelsea' });
  assert.equal(resolveBranchFilter(auth, 'liverpool').code, 'BRANCH_MISMATCH');
});

test('operational state returned to staff contains only their branch', () => {
  const state = {
    lg_branches: [{ id: 'liverpool' }, { id: 'chelsea' }],
    lg_active_branch_id: 'chelsea',
    lg_devices: [{ id: 'l1', branchId: 'liverpool' }, { id: 'c1', branchId: 'chelsea' }],
    lg_sessions: [{ id: 's1', branchId: 'liverpool' }, { id: 's2', branchId: 'chelsea' }],
    lg_waitlist: [{ id: 'w1', branchId: 'liverpool' }, { id: 'w2', branchId: 'chelsea' }],
    lg_inventory: [{ id: 'i1', branchId: 'liverpool' }, { id: 'i2', branchId: 'chelsea' }],
    lg_shifts: [{ id: 'sh1', branchId: 'liverpool' }, { id: 'sh2', branchId: 'chelsea' }],
    lg_active_shift_id: 'sh1',
    lg_notifications: [{ id: 'n1', branchId: 'liverpool' }, { id: 'n2', branchId: 'chelsea' }, { id: 'global' }],
    lg_pricing_tiers: [{ id: 'global-price' }],
  };

  const scoped = scopeOperationalState(state, 'liverpool');
  assert.deepEqual(scoped.lg_branches.map((x) => x.id), ['liverpool']);
  assert.equal(scoped.lg_active_branch_id, 'liverpool');
  assert.deepEqual(scoped.lg_devices.map((x) => x.id), ['l1']);
  assert.deepEqual(scoped.lg_sessions.map((x) => x.id), ['s1']);
  assert.deepEqual(scoped.lg_waitlist.map((x) => x.id), ['w1']);
  assert.deepEqual(scoped.lg_inventory.map((x) => x.id), ['i1']);
  assert.deepEqual(scoped.lg_shifts.map((x) => x.id), ['sh1']);
  assert.equal(scoped.lg_active_shift_id, 'sh1');
  assert.deepEqual(scoped.lg_notifications.map((x) => x.id), ['n1']);
  assert.deepEqual(scoped.lg_pricing_tiers, state.lg_pricing_tiers);
});

test('staff state write permissions are narrow and role-specific', () => {
  assert.equal(canWriteBranchScopedState('cashier', 'lg_sessions'), true);
  assert.equal(canWriteBranchScopedState('cashier', 'lg_devices'), false);
  assert.equal(canWriteBranchScopedState('technician', 'lg_devices'), true);
  assert.equal(canWriteBranchScopedState('technician', 'lg_sessions'), false);
  assert.equal(canWriteBranchScopedState('supervisor', 'lg_shifts'), true);
  assert.equal(canWriteBranchScopedState('cashier', 'lg_employees'), false);
  assert.equal(canWriteBranchScopedState('cashier', 'lg_inventory'), false);
});

test('branch-scoped state updates preserve every other branch', () => {
  const current = [
    { id: 'session-a', branchId: 'liverpool', status: 'active' },
    { id: 'session-b', branchId: 'chelsea', status: 'active' },
  ];
  const next = mergeBranchScopedArray(
    current,
    [{ id: 'session-c', branchId: 'liverpool', status: 'completed' }],
    'liverpool',
    'lg_sessions',
  );
  assert.deepEqual(next, [
    { id: 'session-b', branchId: 'chelsea', status: 'active' },
    { id: 'session-c', branchId: 'liverpool', status: 'completed' },
  ]);
});

test('branch-scoped state rejects cross-branch, duplicate and malformed items', () => {
  assert.throws(
    () => mergeBranchScopedArray([], [{ id: 'x', branchId: 'chelsea' }], 'liverpool', 'lg_sessions'),
    /outside the assigned branch/,
  );
  assert.throws(
    () => mergeBranchScopedArray([], [
      { id: 'x', branchId: 'liverpool' },
      { id: 'x', branchId: 'liverpool' },
    ], 'liverpool', 'lg_sessions'),
    /duplicate item id/,
  );
  assert.throws(
    () => mergeBranchScopedArray([], { id: 'x', branchId: 'liverpool' }, 'liverpool', 'lg_sessions'),
    /must be an array/,
  );
});
