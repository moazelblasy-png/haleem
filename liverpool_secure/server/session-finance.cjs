// Server-authoritative finalization for gaming session invoices and debt payments.
'use strict';

function finiteSessionMoney(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000000;
}
function sessionMoneyEqual(left, right) {
  return Math.abs(Math.round(Number(left) * 100) - Math.round(Number(right) * 100)) <= 1;
}
function sessionTransactionDto(row) {
  return { id:row.id,created_at:row.created_at,type:row.type,payment_method:row.payment_method,
    amount:Number(row.amount),description:row.description,performed_by:row.performed_by };
}

function registerSessionFinanceRoutes(app, deps) {
  const {
    pool, query, requireAuth, requireRole, fail, loadLockedState, writeStateValue,
    mergeBranchScopedArray, authorizeBranch, isManagementRole, resolveBranchFilter,
    validBranchId, validIdempotency,
  } = deps;

  async function readSessionInvoiceTransactions(client, sessionId) {
    const result = await client.query(
      "select id,created_at,type,payment_method,amount,description,performed_by from public.liverpool_cash_transactions where reference_type='session_invoice' and reference_id=$1 order by created_at",
      [sessionId],
    );
    return result.rows.map(sessionTransactionDto);
  }

  async function applyCompleteSession(client, auth, body) {
    const { idempotencyKey, sessionId, shiftId, completedSession, financials, allocations } = body;
    if (!validIdempotency(idempotencyKey) || typeof sessionId !== 'string' || sessionId.length < 3 || sessionId.length > 160 ||
        !completedSession || typeof completedSession !== 'object' || Array.isArray(completedSession) ||
        completedSession.id !== sessionId || completedSession.status !== 'completed' || !validBranchId(completedSession.branchId) ||
        typeof shiftId !== 'string' || !shiftId.trim() || shiftId.length > 120 ||
        !financials || typeof financials !== 'object' || Array.isArray(financials) ||
        !Array.isArray(allocations) || allocations.length > 8) {
      return {ok:false,status:400,code:'INVALID_SESSION_INVOICE',message:'Session invoice fields are invalid.'};
    }
    const fields = ['gamingTotal','productsTotal','billableProductsTotal','grossTotal','grandTotal','actualCollected','remainingDebt','discountValue','discountAmount'];
    if (!fields.every(key => finiteSessionMoney(financials[key])) ||
        !['none','fixed','percent'].includes(completedSession.discountType) ||
        !['cash','instapay','vodafone','card','split'].includes(completedSession.paymentMethod) ||
        typeof completedSession.sessionNumber !== 'string' || completedSession.sessionNumber.length > 100 ||
        typeof completedSession.customerName !== 'string' || !completedSession.customerName.trim() || completedSession.customerName.length > 160 ||
        !finiteSessionMoney(completedSession.finalGamingCost) || !finiteSessionMoney(completedSession.finalProductsTotal) ||
        !finiteSessionMoney(completedSession.finalGrandTotal) || !finiteSessionMoney(completedSession.paidAmount) ||
        !finiteSessionMoney(completedSession.remainingDebt)) {
      return {ok:false,status:400,code:'INVALID_INVOICE_TOTALS',message:'Session invoice totals are invalid.'};
    }
    const expectedGross = Math.round((financials.gamingTotal + financials.billableProductsTotal) * 100) / 100;
    const boundedDiscount = completedSession.discountType === 'percent'
      ? Math.round((financials.grossTotal * Math.min(100, financials.discountValue) / 100) * 100) / 100
      : completedSession.discountType === 'fixed'
        ? Math.min(financials.grossTotal, financials.discountValue)
        : 0;
    const expectedGrand = Math.max(0, Math.round((financials.grossTotal - financials.discountAmount) * 100) / 100);
    if (!sessionMoneyEqual(financials.grossTotal, expectedGross) ||
        !sessionMoneyEqual(financials.discountAmount, boundedDiscount) ||
        !sessionMoneyEqual(financials.grandTotal, expectedGrand) ||
        !sessionMoneyEqual(completedSession.finalProductsTotal, financials.productsTotal) ||
        (completedSession.discountType === 'none' && financials.discountAmount !== 0) ||
        financials.billableProductsTotal > financials.productsTotal + 0.01 ||
        financials.discountValue > 100000000) {
      return {ok:false,status:400,code:'INVOICE_RECONCILIATION_FAILED',message:'Invoice products, discount, and totals do not reconcile.'};
    }
    let allocationTotal = 0;
    for (const item of allocations) {
      if (!item || typeof item !== 'object' || !['cash','instapay','vodafone','card'].includes(item.paymentMethod) ||
          !finiteSessionMoney(item.amount) || item.amount <= 0 || typeof item.description !== 'string' || item.description.length > 500) {
        return {ok:false,status:400,code:'INVALID_PAYMENT_ALLOCATION',message:'Payment allocations are invalid.'};
      }
      allocationTotal += item.amount;
    }
    if (!sessionMoneyEqual(allocationTotal, financials.actualCollected)) {
      return {ok:false,status:400,code:'PAYMENT_ALLOCATION_MISMATCH',message:'Payment allocations must equal the amount actually collected.'};
    }

    const access = authorizeBranch(auth, completedSession.branchId);
    if (!access.allowed) return {ok:false,status:access.status,code:access.code,message:access.message};
    const state = await loadLockedState(client, ['lg_sessions','lg_devices','lg_shifts']);
    const sessions = Array.isArray(state.lg_sessions) ? state.lg_sessions : [];
    const devices = Array.isArray(state.lg_devices) ? state.lg_devices : [];
    const current = sessions.find(item => item && item.id === sessionId);
    if (!current) return {ok:false,status:404,code:'SESSION_NOT_FOUND',message:'Session was not found in cloud state.'};
    const currentAccess = authorizeBranch(auth, current.branchId);
    if (!currentAccess.allowed) return {ok:false,status:currentAccess.status,code:currentAccess.code,message:currentAccess.message};
    if (current.branchId !== completedSession.branchId || current.deviceId !== completedSession.deviceId) {
      return {ok:false,status:409,code:'SESSION_IDENTITY_CHANGED',message:'Session identity changed; refresh and retry.'};
    }

    const existingInvoice = await client.query(
      'select idempotency_key from public.liverpool_session_invoices where session_id=$1 for update',
      [sessionId],
    );
    if (existingInvoice.rowCount) {
      if (existingInvoice.rows[0].idempotency_key !== idempotencyKey) {
        return {ok:false,status:409,code:'SESSION_ALREADY_INVOICED',message:'This session already has a final invoice.'};
      }
      return {ok:true,duplicate:true,session:current,transactions:await readSessionInvoiceTransactions(client,sessionId),versions:state.__versions||{}};
    }
    if (current.status !== 'active') return {ok:false,status:409,code:'SESSION_NOT_ACTIVE',message:'Only an active session can be checked out.'};
    if (!isManagementRole(auth.role)) {
      const shift = (Array.isArray(state.lg_shifts) ? state.lg_shifts : []).find(item =>
        item && item.id === shiftId && item.branchId === current.branchId && item.status === 'open');
      if (!shift) return {ok:false,status:409,code:'OPEN_SHIFT_REQUIRED',message:'An open shift for this branch is required to complete the session.'};
    }

    const oldPaid = Number(current.paidAmount || 0);
    const collected = financials.actualCollected;
    const expectedDebt = Math.max(0, financials.grandTotal - oldPaid - collected);
    if (!finiteSessionMoney(oldPaid) ||
        !sessionMoneyEqual(completedSession.finalGamingCost, financials.gamingTotal) ||
        !sessionMoneyEqual(completedSession.finalGrandTotal, financials.grandTotal) ||
        !sessionMoneyEqual(completedSession.remainingDebt, financials.remainingDebt) ||
        !sessionMoneyEqual(completedSession.paidAmount, oldPaid + collected) ||
        !sessionMoneyEqual(financials.remainingDebt, expectedDebt) ||
        collected > Math.max(0, financials.grandTotal - oldPaid) + 0.01 ||
        !Number.isFinite(completedSession.completedAt) ||
        completedSession.completedAt < current.startTime ||
        completedSession.completedAt > Date.now() + 30000) {
      return {ok:false,status:400,code:'INVOICE_RECONCILIATION_FAILED',message:'Invoice totals do not reconcile with the session balance.'};
    }
    const device = devices.find(item => item && item.id === current.deviceId);
    if (!device || device.branchId !== current.branchId || (device.activeSessionId && device.activeSessionId !== current.id)) {
      return {ok:false,status:409,code:'DEVICE_SESSION_MISMATCH',message:'The device no longer belongs to this active session.'};
    }

    await client.query(
      'insert into public.liverpool_session_invoices (idempotency_key,session_id,branch_id,shift_id,cashier_id,session_number,customer_name,customer_phone,gaming_total,products_total,billable_products_total,discount_type,discount_value,discount_amount,grand_total,prepaid_amount,collected_amount,remaining_debt,payment_method,split_payments,session_snapshot) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb)',
      [idempotencyKey,sessionId,current.branchId,shiftId,auth.userId,completedSession.sessionNumber,
        completedSession.customerName.trim(),typeof completedSession.customerPhone==='string'?completedSession.customerPhone.slice(0,40):null,
        financials.gamingTotal.toFixed(2),financials.productsTotal.toFixed(2),financials.billableProductsTotal.toFixed(2),
        completedSession.discountType,financials.discountValue.toFixed(2),financials.discountAmount.toFixed(2),
        financials.grandTotal.toFixed(2),oldPaid.toFixed(2),collected.toFixed(2),financials.remainingDebt.toFixed(2),
        completedSession.paymentMethod,
        JSON.stringify(Array.isArray(completedSession.splitPayments)?completedSession.splitPayments:[]),JSON.stringify(completedSession)],
    );

    const transactions = [];
    for (let i=0;i<allocations.length;i++) {
      const allocation = allocations[i];
      const result = await client.query(
        "insert into public.liverpool_cash_transactions (idempotency_key,branch_id,shift_id,type,payment_method,amount,description,performed_by,reference_type,reference_id) values ($1,$2,$3,'gaming_revenue',$4,$5,$6,$7,'session_invoice',$8) returning id,created_at,type,payment_method,amount,description,performed_by",
        [idempotencyKey + ':alloc:' + i,current.branchId,shiftId,allocation.paymentMethod,allocation.amount.toFixed(2),
          allocation.description.trim(),auth.userId,sessionId],
      );
      transactions.push(sessionTransactionDto(result.rows[0]));
    }

    const branchSessions = sessions.filter(item => item && item.branchId === current.branchId)
      .map(item => item.id === sessionId ? completedSession : item);
    const nextSessions = mergeBranchScopedArray(sessions,branchSessions,current.branchId,'lg_sessions');
    const branchDevices = devices.filter(item => item && item.branchId === current.branchId)
      .map(item => item.id === current.deviceId ? {...item,status:'available',currentGame:undefined,activeSessionId:undefined}:item);
    const nextDevices = mergeBranchScopedArray(devices,branchDevices,current.branchId,'lg_devices');
    const sessionsVersion = await writeStateValue(client,'lg_sessions',nextSessions,auth.userId);
    const devicesVersion = await writeStateValue(client,'lg_devices',nextDevices,auth.userId);
    return {ok:true,duplicate:false,session:completedSession,transactions,versions:{lg_sessions:sessionsVersion,lg_devices:devicesVersion}};
  }

  async function applyDebtPayment(client,auth,body) {
    const {idempotencyKey,sessionId,shiftId,amount,paymentMethod}=body;
    if(!validIdempotency(idempotencyKey)||typeof sessionId!=='string'||sessionId.length<3||sessionId.length>160||
       typeof shiftId!=='string'||!shiftId.trim()||shiftId.length>120||!finiteSessionMoney(amount)||amount<=0||
       !['cash','instapay','vodafone','card'].includes(paymentMethod)) {
      return {ok:false,status:400,code:'INVALID_DEBT_PAYMENT',message:'Debt payment fields are invalid.'};
    }
    const state=await loadLockedState(client,['lg_sessions','lg_shifts']);
    const sessions=Array.isArray(state.lg_sessions)?state.lg_sessions:[];
    const session=sessions.find(item=>item&&item.id===sessionId);
    if(!session) return {ok:false,status:404,code:'SESSION_NOT_FOUND',message:'Session was not found in cloud state.'};
    const access=authorizeBranch(auth,session.branchId);
    if(!access.allowed) return {ok:false,status:access.status,code:access.code,message:access.message};
    if(session.status!=='completed') return {ok:false,status:409,code:'SESSION_NOT_COMPLETED',message:'Debt can only be collected after checkout.'};

    const prior=await client.query('select session_id,amount,payment_method from public.liverpool_session_debt_payments where idempotency_key=$1 for update',[idempotencyKey]);
    if(prior.rowCount) {
      const row=prior.rows[0];
      if(row.session_id!==sessionId||!sessionMoneyEqual(Number(row.amount),amount)||row.payment_method!==paymentMethod)
        return {ok:false,status:409,code:'IDEMPOTENCY_KEY_REUSED',message:'This idempotency key belongs to a different debt payment.'};
      const transaction=await client.query('select id,created_at,type,payment_method,amount,description,performed_by from public.liverpool_cash_transactions where idempotency_key=$1',[idempotencyKey+':cash']);
      return {ok:true,duplicate:true,session,transaction:transaction.rows[0]?sessionTransactionDto(transaction.rows[0]):null,versions:state.__versions||{}};
    }
    if(!finiteSessionMoney(session.remainingDebt)||session.remainingDebt<=0)
      return {ok:false,status:409,code:'NO_OUTSTANDING_DEBT',message:'This session has no outstanding debt.'};
    if(amount>Number(session.remainingDebt)+0.01)
      return {ok:false,status:400,code:'PAYMENT_EXCEEDS_DEBT',message:'Collected amount cannot exceed the outstanding debt.'};
    if(!isManagementRole(auth.role)) {
      const shift=(Array.isArray(state.lg_shifts)?state.lg_shifts:[]).find(item=>item&&item.id===shiftId&&item.branchId===session.branchId&&item.status==='open');
      if(!shift) return {ok:false,status:409,code:'OPEN_SHIFT_REQUIRED',message:'An open shift for this branch is required to collect debt.'};
    }
    const invoiceResult=await client.query('select id,remaining_debt from public.liverpool_session_invoices where session_id=$1 for update',[sessionId]);
    if(!invoiceResult.rowCount) return {ok:false,status:409,code:'SESSION_INVOICE_NOT_FOUND',message:'This session has no server-recorded invoice and must be reconciled first.'};
    const invoice=invoiceResult.rows[0];
    if(Number(invoice.remaining_debt)+0.01<amount||!sessionMoneyEqual(Number(invoice.remaining_debt),Number(session.remainingDebt)))
      return {ok:false,status:409,code:'DEBT_BALANCE_CONFLICT',message:'Debt balance changed on the server. Refresh and retry.'};
    const remainingDebt=Math.max(0,Math.round((Number(session.remainingDebt)-amount)*100)/100);
    const paidAmount=Math.round((Number(session.paidAmount||0)+amount)*100)/100;
    const record={amount,paidAt:Date.now(),paymentMethod,receivedBy:auth.userId};
    const updatedSession={...session,paidAmount,remainingDebt,isFullyPaid:remainingDebt===0,
      debtPaidHistory:[...(Array.isArray(session.debtPaidHistory)?session.debtPaidHistory:[]),record]};
    const payment=await client.query(
      'insert into public.liverpool_session_debt_payments (idempotency_key,invoice_id,session_id,branch_id,shift_id,amount,payment_method,received_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id,created_at',
      [idempotencyKey,invoice.id,sessionId,session.branchId,shiftId,amount.toFixed(2),paymentMethod,auth.userId],
    );
    const transaction=await client.query(
      "insert into public.liverpool_cash_transactions (idempotency_key,branch_id,shift_id,type,payment_method,amount,description,performed_by,reference_type,reference_id) values ($1,$2,$3,'debt_collection',$4,$5,$6,$7,'session_debt_payment',$8) returning id,created_at,type,payment_method,amount,description,performed_by",
      [idempotencyKey+':cash',session.branchId,shiftId,paymentMethod,amount.toFixed(2),'تحصيل مديونية جلسة '+session.sessionNumber,auth.userId,sessionId],
    );
    const nextSessions=mergeBranchScopedArray(sessions,sessions.filter(item=>item&&item.branchId===session.branchId).map(item=>item.id===sessionId?updatedSession:item),session.branchId,'lg_sessions');
    const version=await writeStateValue(client,'lg_sessions',nextSessions,auth.userId);
    await client.query(
      'update public.liverpool_session_invoices set collected_amount=collected_amount+$2,remaining_debt=$3,session_snapshot=$4::jsonb,updated_at=now() where id=$1',
      [invoice.id,amount.toFixed(2),remainingDebt.toFixed(2),JSON.stringify(updatedSession)],
    );
    return {ok:true,duplicate:false,session:updatedSession,transaction:sessionTransactionDto(transaction.rows[0]),debtPaymentId:payment.rows[0].id,versions:{lg_sessions:version}};
  }

  app.post('/api/sessions/complete',requireAuth,requireRole('owner','admin','supervisor','cashier'),async(req,res) => {
    const client=await pool?.connect().catch(()=>null);
    if(!client) return fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.');
    try {
      await client.query('begin');
      const result=await applyCompleteSession(client,req.auth,req.body||{});
      if(!result.ok){await client.query('rollback');return fail(res,result.status,result.code,result.message);}
      await client.query('commit');
      return res.status(result.duplicate?200:201).json({ok:true,duplicate:result.duplicate,session:result.session,transactions:result.transactions||[],versions:result.versions||{}});
    } catch(e) {
      await client.query('rollback').catch(()=>{});
      if(e.code==='23505') return fail(res,409,'DUPLICATE_SESSION_INVOICE','A final invoice already exists for this session.');
      console.error('[session:complete]',e.message);
      return fail(res,503,'SESSION_CHECKOUT_FAILED','Session checkout was not committed; retry with the same idempotency key.');
    } finally {client.release();}
  });

  app.post('/api/sessions/debt-payments',requireAuth,requireRole('owner','admin','supervisor','cashier'),async(req,res) => {
    const client=await pool?.connect().catch(()=>null);
    if(!client) return fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.');
    try {
      await client.query('begin');
      const result=await applyDebtPayment(client,req.auth,req.body||{});
      if(!result.ok){await client.query('rollback');return fail(res,result.status,result.code,result.message);}
      await client.query('commit');
      return res.status(result.duplicate?200:201).json({ok:true,duplicate:result.duplicate,session:result.session,transaction:result.transaction||null,debtPaymentId:result.debtPaymentId,versions:result.versions||{}});
    } catch(e) {
      await client.query('rollback').catch(()=>{});
      if(e.code==='23505') return fail(res,409,'DUPLICATE_DEBT_PAYMENT','A debt payment with this identifier already exists.');
      console.error('[session:debt-payment]',e.message);
      return fail(res,503,'DEBT_PAYMENT_FAILED','Debt payment was not committed; retry with the same idempotency key.');
    } finally {client.release();}
  });

  app.get('/api/finance/session-invoices',requireAuth,requireRole('owner','admin','supervisor'),async(req,res) => {
    const scope=resolveBranchFilter(req.auth,typeof req.query.branchId==='string'?req.query.branchId:null);
    if(!scope.allowed) return fail(res,scope.status,scope.code,scope.message);
    const from=typeof req.query.from==='string'?req.query.from:null, to=typeof req.query.to==='string'?req.query.to:null;
    if((from&&!Number.isFinite(Date.parse(from)))||(to&&!Number.isFinite(Date.parse(to))))
      return fail(res,400,'INVALID_DATE_RANGE','Report date filters must be valid ISO dates.');
    try {
      const params=[],filters=[];
      if(scope.branchId){params.push(scope.branchId);filters.push('branch_id=$'+params.length);}
      if(from){params.push(from);filters.push('created_at >= $'+params.length+'::timestamptz');}
      if(to){params.push(to);filters.push('created_at < ($'+params.length+'::timestamptz + interval \'1 day\')');}
      params.push(500);
      const result=await query(
        'select id,session_id,branch_id,shift_id,cashier_id,session_number,customer_name,customer_phone,gaming_total,products_total,billable_products_total,discount_type,discount_value,discount_amount,grand_total,prepaid_amount,collected_amount,remaining_debt,payment_method,split_payments,created_at from public.liverpool_session_invoices '+
        (filters.length?'where '+filters.join(' and '):'')+' order by created_at desc limit $'+params.length,params,
      );
      res.set('Cache-Control','no-store').json({ok:true,invoices:result.rows.map(row=>({...row,gaming_total:Number(row.gaming_total),products_total:Number(row.products_total),billable_products_total:Number(row.billable_products_total),discount_value:Number(row.discount_value),discount_amount:Number(row.discount_amount),grand_total:Number(row.grand_total),prepaid_amount:Number(row.prepaid_amount),collected_amount:Number(row.collected_amount),remaining_debt:Number(row.remaining_debt)}))});
    } catch(e){console.error('[session-invoices:list]',e.message);fail(res,503,'SESSION_INVOICES_UNAVAILABLE','Session invoices could not be loaded.');}
  });

  app.get('/api/finance/session-debt-payments',requireAuth,requireRole('owner','admin','supervisor'),async(req,res) => {
    const scope=resolveBranchFilter(req.auth,typeof req.query.branchId==='string'?req.query.branchId:null);
    if(!scope.allowed) return fail(res,scope.status,scope.code,scope.message);
    try {
      const params=[],filters=[];
      if(scope.branchId){params.push(scope.branchId);filters.push('branch_id=$'+params.length);}
      params.push(500);
      const result=await query(
        'select id,session_id,branch_id,shift_id,amount,payment_method,received_by,created_at from public.liverpool_session_debt_payments '+
        (filters.length?'where '+filters.join(' and '):'')+' order by created_at desc limit $'+params.length,params,
      );
      res.set('Cache-Control','no-store').json({ok:true,payments:result.rows.map(row=>({...row,amount:Number(row.amount)}))});
    } catch(e){console.error('[session-debt-payments:list]',e.message);fail(res,503,'SESSION_DEBT_PAYMENTS_UNAVAILABLE','Debt payment history could not be loaded.');}
  });

  return { applyCompleteSession, applyDebtPayment };
}

module.exports = { registerSessionFinanceRoutes };
