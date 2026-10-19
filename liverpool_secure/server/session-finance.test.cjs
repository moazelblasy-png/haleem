'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerSessionFinanceRoutes } = require('./session-finance.cjs');
const {
  authorizeBranch,
  isManagementRole,
  resolveBranchFilter,
  mergeBranchScopedArray,
  validBranchId,
} = require('./branch-access.cjs');

function createHarness() {
  const registeredRoutes = new Map();
  let lockedStateCalls = 0;
  const app = {
    post(route, ...handlers) { registeredRoutes.set('POST ' + route, handlers); },
    get(route, ...handlers) { registeredRoutes.set('GET ' + route, handlers); },
  };
  const deps = {
    pool: { connect: async () => { throw new Error('Database should not be reached by validation tests'); } },
    query: async () => { throw new Error('Database should not be reached by validation tests'); },
    requireAuth: (_req, _res, next) => next(),
    requireRole: () => (_req, _res, next) => next(),
    fail: (res, status, code, message) => res.status(status).json({ ok:false, error:{ code, message } }),
    loadLockedState: async () => { lockedStateCalls++; throw new Error('Unexpected state read'); },
    writeStateValue: async () => { throw new Error('Unexpected state write'); },
    mergeBranchScopedArray: (...args) => mergeBranchScopedArray(...args),
    authorizeBranch,
    isManagementRole,
    resolveBranchFilter,
    validBranchId,
    validIdempotency: value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{8,128}$/.test(value),
  };
  const handlers = registerSessionFinanceRoutes(app, deps);
  return { registeredRoutes, handlers, getLockedStateCalls: () => lockedStateCalls };
}

test('registers the session invoice, debt payment, and report endpoints', () => {
  const { registeredRoutes } = createHarness();
  assert.ok(registeredRoutes.has('POST /api/sessions/complete'));
  assert.ok(registeredRoutes.has('POST /api/sessions/debt-payments'));
  assert.ok(registeredRoutes.has('GET /api/finance/session-invoices'));
  assert.ok(registeredRoutes.has('GET /api/finance/session-debt-payments'));
});

test('rejects a session invoice whose discount and grand total do not reconcile before reading state', async () => {
  const h = createHarness();
  const result = await h.handlers.applyCompleteSession(
    { query: async () => { throw new Error('Database should not be queried'); } },
    { userId:'00000000-0000-4000-8000-000000000001', role:'owner', branchId:null },
    {
      idempotencyKey:'complete-session-0001',
      sessionId:'session-0001',
      shiftId:'owner-checkout',
      completedSession:{
        id:'session-0001',status:'completed',branchId:'liverpool',deviceId:'device-1',
        sessionNumber:'S-001',customerName:'Test customer',discountType:'none',paymentMethod:'cash',
        finalGamingCost:10,finalProductsTotal:0,finalGrandTotal:9,paidAmount:0,remainingDebt:9,
        completedAt:Date.now(),
      },
      financials:{
        gamingTotal:10,productsTotal:0,billableProductsTotal:0,grossTotal:10,
        discountValue:0,discountAmount:0,grandTotal:9,actualCollected:0,remainingDebt:9,
      },
      allocations:[],
    },
  );
  assert.equal(result.ok,false);
  assert.equal(result.code,'INVOICE_RECONCILIATION_FAILED');
  assert.equal(h.getLockedStateCalls(),0);
});

test('rejects invalid debt payment inputs before reading state', async () => {
  const h = createHarness();
  const result = await h.handlers.applyDebtPayment(
    { query: async () => { throw new Error('Database should not be queried'); } },
    { userId:'00000000-0000-4000-8000-000000000001', role:'owner', branchId:null },
    { idempotencyKey:'debt-payment-0001',sessionId:'session-0001',shiftId:'shift-1',amount:0,paymentMethod:'cash' },
  );
  assert.equal(result.ok,false);
  assert.equal(result.code,'INVALID_DEBT_PAYMENT');
  assert.equal(h.getLockedStateCalls(),0);
});
