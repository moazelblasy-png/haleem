require('dotenv').config();
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { Pool } = require('pg');
const { BRANCH_SCOPED_ARRAY_STATE_KEYS, authorizeBranch, canWriteBranchScopedState, isManagementRole, mergeBranchScopedArray, resolveBranchFilter, scopeOperationalState, validBranchId } = require('./branch-access.cjs');
const app = express();
const port = Number(process.env.PORT || 3001);
const distDir = path.resolve(__dirname, '..', 'dist');
const keyPattern = /^[a-z][a-z0-9_]{0,63}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: true },
  max: Number(process.env.PG_POOL_MAX || 5), idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, statement_timeout: 8000, query_timeout: 10000,
}) : null;
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb', strict: true }));
async function query(sql, args = []) { if (!pool) throw new Error('Database not configured'); return pool.query(sql, args); }
function fail(res, status, code, message) { return res.status(status).json({ ok: false, error: { code, message } }); }
async function requireAuth(req, res, next) {
  try {
    const match = (req.get('authorization') || '').match(/^Bearer\s+([^\s]+)$/i);
    if (!match) return fail(res, 401, 'AUTH_REQUIRED', 'Sign in is required.');
    if (!supabaseUrl || !publishableKey) return fail(res, 503, 'AUTH_NOT_CONFIGURED', 'Authentication is not configured.');
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: `Bearer ${match[1]}`, Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return fail(res, 401, 'INVALID_SESSION', 'Session is invalid or expired.');
    const user = await response.json();
    if (!user?.id || !uuidPattern.test(user.id)) return fail(res, 401, 'INVALID_SESSION', 'Session is invalid.');

    let result;
    let branchScopeConfigured = true;
    try {
      result = await query('select role, is_active, branch_id from public.liverpool_app_members where user_id = $1::uuid', [user.id]);
    } catch (e) {
      // Keep owner/admin access available during migration rollout. Staff endpoints fail closed.
      if (e.code !== '42703') throw e;
      branchScopeConfigured = false;
      result = await query('select role, is_active from public.liverpool_app_members where user_id = $1::uuid', [user.id]);
    }
    if (!result.rows[0]?.is_active) return fail(res, 403, 'NOT_A_MEMBER', 'This account is not authorized.');
    req.auth = {
      userId: user.id,
      role: result.rows[0].role,
      email: user.email || null,
      branchId: branchScopeConfigured ? (result.rows[0].branch_id || null) : null,
      branchScopeConfigured,
    };
    next();
  } catch (e) { console.error('[auth]', e.message); return fail(res, 503, 'AUTH_UNAVAILABLE', 'Authentication service unavailable.'); }
}
function requireRole(...roles) { return (req, res, next) => req.auth && roles.includes(req.auth.role) ? next() : fail(res, 403, 'FORBIDDEN', 'Insufficient permissions.'); }
app.get('/api/health', async (_req, res) => { try { await query('select 1'); res.set('Cache-Control','no-store').json({ok:true,database:'connected'}); } catch(e) { console.error('[health]',e.message); fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.'); } });
const CLOUD_STATE_WRITE_KEYS = new Set([
  'lg_branches','lg_active_branch_id','lg_devices','lg_sessions','lg_waitlist',
  'lg_shifts','lg_active_shift_id','lg_safe_txs','lg_employees','lg_role_permissions',
  'lg_audit_log','lg_offline_queue','lg_pricing_tiers','lg_rounding_policy','lg_notifications'
]);
// Staff receive only operational state needed by the front desk. HR, permissions, audit, and
// safe transactions remain restricted to management; the client UI is not an authorization boundary.
const STAFF_STATE_READ_KEYS = new Set([
  'lg_branches','lg_active_branch_id','lg_devices','lg_sessions','lg_waitlist',
  'lg_shifts','lg_active_shift_id','lg_pricing_tiers','lg_rounding_policy','lg_notifications'
]);
app.get('/api/state', requireAuth, async (req, res) => {
  try {
    const isManagement = isManagementRole(req.auth.role);
    if (!isManagement) {
      const access = authorizeBranch(req.auth, req.auth.branchId);
      if (!access.allowed) return fail(res, access.status, access.code, access.message);
    }
    const r = await query('select state_key,state_value,version from public.liverpool_app_state order by state_key');
    // Inventory is authoritative in liverpool_inventory; never hydrate it from an old JSON snapshot.
    const persistedRows = r.rows.filter(x => x.state_key !== 'lg_inventory');
    const rows = isManagement
      ? persistedRows
      : persistedRows.filter(x => STAFF_STATE_READ_KEYS.has(x.state_key));
    const state = Object.fromEntries(rows.map(x => [x.state_key, x.state_value]));
    const versions = Object.fromEntries(rows.map(x => [x.state_key, x.version]));
    res.set('Cache-Control','no-store').json({
      ok:true,
      state:isManagement ? state : scopeOperationalState(state, req.auth.branchId),
      versions
    });
  } catch(e) { console.error('[state:read]',e.message); fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.'); }
});
app.put('/api/state/:key', requireAuth, async (req,res) => {
  const key=req.params.key, {value,expectedVersion}=req.body||{};
  if(!keyPattern.test(key) || !CLOUD_STATE_WRITE_KEYS.has(key)) return fail(res,400,'INVALID_KEY','State key is not allowed.');
  if(typeof value==='undefined') return fail(res,400,'MISSING_VALUE','State value is required.');
  if(Buffer.byteLength(JSON.stringify(value),'utf8')>500000) return fail(res,413,'VALUE_TOO_LARGE','State value exceeds 500 KB.');
  if(expectedVersion!==null && expectedVersion!==undefined && (!Number.isSafeInteger(expectedVersion)||expectedVersion<0)) return fail(res,400,'INVALID_VERSION','expectedVersion must be non-negative integer or null.');

  const management = isManagementRole(req.auth.role);
  if (!management) {
    const branchAccess = authorizeBranch(req.auth, req.auth.branchId);
    if (!branchAccess.allowed) return fail(res, branchAccess.status, branchAccess.code, branchAccess.message);
    if (!BRANCH_SCOPED_ARRAY_STATE_KEYS.has(key) || !canWriteBranchScopedState(req.auth.role, key)) {
      return fail(res,403,'STATE_WRITE_FORBIDDEN','This role cannot update this shared state key. Use the authorized operational action instead.');
    }
  }

  const client=await pool?.connect().catch(()=>null);
  if(!client) return fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.');
  try {
    await client.query('begin');
    const current=await client.query('select state_value,version from public.liverpool_app_state where state_key=$1 for update',[key]);
    if(current.rowCount===0 && expectedVersion!=null && expectedVersion!==0){
      await client.query('rollback');
      return fail(res,409,'VERSION_CONFLICT','State changed on another device; refresh first.');
    }
    if(current.rowCount>0 && expectedVersion!==current.rows[0].version){
      await client.query('rollback');
      return res.status(409).json({ok:false,error:{code:'VERSION_CONFLICT',message:'State changed on another device; refresh first.'},currentVersion:current.rows[0].version});
    }

    let valueToSave = value;
    if (!management) {
      try {
        valueToSave = mergeBranchScopedArray(current.rows[0]?.state_value, value, req.auth.branchId, key);
      } catch (error) {
        await client.query('rollback');
        return fail(res,400,'INVALID_BRANCH_STATE',error.message || 'Invalid branch-scoped state.');
      }
    }

    const saved=await client.query(
      'insert into public.liverpool_app_state(state_key,state_value,version,updated_at,updated_by) values($1,$2::jsonb,1,now(),$3::uuid) on conflict(state_key) do update set state_value=excluded.state_value,version=public.liverpool_app_state.version+1,updated_at=now(),updated_by=excluded.updated_by returning version,updated_at',
      [key,JSON.stringify(valueToSave),req.auth.userId]
    );
    await client.query('commit');
    res.set('Cache-Control','no-store').json({ok:true,key,version:saved.rows[0].version,updatedAt:saved.rows[0].updated_at});
  } catch(e) {
    await client.query('rollback').catch(()=>{});
    console.error('[state:write]',e.message);
    fail(res,503,'DATABASE_UNAVAILABLE','Could not persist state.');
  } finally { client.release(); }
});

async function loadLockedState(client, keys) {
  const result = await client.query(
    'select state_key,state_value,version from public.liverpool_app_state where state_key = any($1::text[]) order by state_key for update',
    [keys],
  );
  return Object.fromEntries(result.rows.map(row => [row.state_key, row.state_value]));
}

async function writeStateValue(client, key, value, userId) {
  await client.query(
    'insert into public.liverpool_app_state(state_key,state_value,version,updated_at,updated_by) values($1,$2::jsonb,1,now(),$3::uuid) on conflict(state_key) do update set state_value=excluded.state_value,version=public.liverpool_app_state.version+1,updated_at=now(),updated_by=excluded.updated_by',
    [key, JSON.stringify(value), userId],
  );
}

async function applyStartSession(client, auth, payload, idempotencyKey) {
  const session = payload && typeof payload === 'object' && payload.session && typeof payload.session === 'object'
    ? payload.session
    : payload;
  const shiftId = payload && typeof payload === 'object' && typeof payload.shiftId === 'string'
    ? payload.shiftId
    : '';

  if (!session || typeof session !== 'object' || Array.isArray(session) ||
      typeof session.id !== 'string' || !/^[A-Za-z0-9:_-]{3,128}$/.test(session.id) ||
      typeof session.deviceId !== 'string' || session.deviceId.length > 160 ||
      !validBranchId(session.branchId) || typeof session.sessionNumber !== 'string' ||
      session.sessionNumber.length > 100 || typeof session.customerName !== 'string' ||
      session.customerName.trim().length < 1 || session.customerName.length > 160 ||
      typeof session.gameName !== 'string' || session.gameName.length > 160 ||
      session.status !== 'active' || !Number.isFinite(session.startTime) ||
      !Array.isArray(session.segments) || session.segments.length < 1 ||
      !Array.isArray(session.products) || session.products.length > 100) {
    return { ok:false,status:400,code:'INVALID_SESSION',message:'Session fields are invalid.' };
  }
  if (!validIdempotency(idempotencyKey) || idempotencyKey.length > 110) {
    return { ok:false,status:400,code:'INVALID_IDEMPOTENCY_KEY',message:'Session idempotency key is invalid.' };
  }

  const branchAccess = authorizeBranch(auth, session.branchId);
  if (!branchAccess.allowed) return { ok:false,status:branchAccess.status,code:branchAccess.code,message:branchAccess.message };

  const state = await loadLockedState(client, ['lg_devices','lg_sessions','lg_shifts']);
  const devices = Array.isArray(state.lg_devices) ? state.lg_devices : [];
  const sessions = Array.isArray(state.lg_sessions) ? state.lg_sessions : [];
  const priorSession = sessions.find(item => item && item.id === session.id);
  if (priorSession) {
    const same = priorSession.branchId === session.branchId &&
      priorSession.deviceId === session.deviceId &&
      priorSession.startTime === session.startTime &&
      priorSession.sessionNumber === session.sessionNumber;
    if (!same || priorSession.status !== 'active') {
      return { ok:false,status:409,code:'SESSION_ID_CONFLICT',message:'This session identifier already belongs to another session.' };
    }
    return { ok:true,duplicate:true,sessionId:session.id };
  }

  const device = devices.find(item => item && item.id === session.deviceId);
  if (!device) return { ok:false,status:409,code:'DEVICE_NOT_FOUND',message:'Device is not registered in the cloud state. Refresh device setup and retry.' };
  if (device.branchId !== session.branchId) return { ok:false,status:403,code:'BRANCH_MISMATCH',message:'The selected device belongs to another branch.' };
  if (device.status !== 'available') return { ok:false,status:409,code:'DEVICE_UNAVAILABLE',message:'The selected device is no longer available.' };

  if (!isManagementRole(auth.role)) {
    const shifts = Array.isArray(state.lg_shifts) ? state.lg_shifts : [];
    const activeShift = shifts.find(item => item && item.id === shiftId && item.branchId === session.branchId && item.status === 'open');
    if (!activeShift) return { ok:false,status:409,code:'OPEN_SHIFT_REQUIRED',message:'An open shift for this branch is required before starting a session.' };
  }

  const branchSessions = sessions.filter(item => item && item.branchId === session.branchId);
  const nextSessions = mergeBranchScopedArray(
    sessions,
    [session, ...branchSessions.filter(item => item.id !== session.id)],
    session.branchId,
    'lg_sessions',
  );
  const nextDevicesForBranch = devices
    .filter(item => item && item.branchId === session.branchId)
    .map(item => item.id === device.id
      ? { ...item, status:'busy', currentGame:session.gameName, activeSessionId:session.id }
      : item);
  const nextDevices = mergeBranchScopedArray(devices, nextDevicesForBranch, session.branchId, 'lg_devices');

  await writeStateValue(client, 'lg_sessions', nextSessions, auth.userId);
  await writeStateValue(client, 'lg_devices', nextDevices, auth.userId);

  const paidAmount = Number(session.paidAmount || 0);
  if (session.isPrepaid === true && Number.isFinite(paidAmount) && paidAmount > 0) {
    if (paidAmount > 100000000) return { ok:false,status:400,code:'PREPAYMENT_OUT_OF_RANGE',message:'Prepayment amount exceeds the permitted limit.' };
    const method = ['cash','instapay','vodafone','card'].includes(session.paymentMethod) ? session.paymentMethod : 'cash';
    const transactionKey = idempotencyKey + ':prepaid';
    await client.query(
      'insert into public.liverpool_cash_transactions(idempotency_key,branch_id,shift_id,type,payment_method,amount,description,performed_by) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(idempotency_key) do nothing',
      [transactionKey,session.branchId,shiftId || 'owner-session','gaming_revenue',method,paidAmount.toFixed(2),'دفعة مسبقة '+session.sessionNumber,auth.userId],
    );
  }

  return { ok:true,duplicate:false,sessionId:session.id };
}

app.post('/api/sessions/start', requireAuth, requireRole('owner','admin','supervisor','cashier'), async(req,res) => {
  const body = req.body || {};
  if (!validIdempotency(body.idempotencyKey)) return fail(res,400,'INVALID_IDEMPOTENCY_KEY','Session idempotency key is invalid.');
  const client = await pool?.connect().catch(()=>null);
  if (!client) return fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.');
  try {
    await client.query('begin');
    const result = await applyStartSession(client, req.auth, body, body.idempotencyKey);
    if (!result.ok) {
      await client.query('rollback');
      return fail(res,result.status,result.code,result.message);
    }
    await client.query('commit');
    return res.status(result.duplicate ? 200 : 201).json({ok:true,duplicate:result.duplicate,sessionId:result.sessionId});
  } catch(e) {
    await client.query('rollback').catch(()=>{});
    console.error('[session:start]',e.message);
    return fail(res,503,'SESSION_START_FAILED','Session start was not committed; retry using the same idempotency key.');
  } finally { client.release(); }
});

app.post('/api/sync/receipts',requireAuth,requireRole('owner','admin','supervisor','cashier'),async(req,res)=>{
  const actions=req.body?.actions;
  if(!Array.isArray(actions)||actions.length<1||actions.length>100) return fail(res,400,'INVALID_BATCH','Send 1 to 100 actions.');
  for(const a of actions){
    if(!a||typeof a.idempotencyKey!=='string'||!/^[a-zA-Z0-9:_-]{8,128}$/.test(a.idempotencyKey)||
      a.idempotencyKey.length>110||typeof a.action!=='string'||a.action.length>80||
      !Number.isFinite(a.performedAt)||typeof a.payload==='undefined') return fail(res,400,'INVALID_ACTION','Invalid action item.');
    if(Buffer.byteLength(JSON.stringify(a.payload),'utf8')>100000) return fail(res,413,'PAYLOAD_TOO_LARGE','Action payload exceeds 100 KB.');
    if(a.action!=='start_session') return fail(res,422,'UNSUPPORTED_OFFLINE_ACTION','This offline action has no server executor yet and will not be marked synced.');
  }

  const client=await pool?.connect().catch(()=>null);
  if(!client) return fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.');
  try {
    await client.query('begin');
    const results=[];
    for(const action of actions){
      const payload = JSON.stringify(action.payload);
      const prior = await client.query(
        'select action_type,payload,extract(epoch from performed_at)*1000 as performed_at_ms,executed_at,result from public.liverpool_sync_receipts where user_id=$1::uuid and idempotency_key=$2 for update',
        [req.auth.userId,action.idempotencyKey],
      );
      let duplicate = false;
      if(prior.rowCount){
        const row=prior.rows[0];
        const same=row.action_type===action.action && JSON.stringify(row.payload)===JSON.stringify(JSON.parse(payload)) &&
          Math.abs(Number(row.performed_at_ms)-action.performedAt)<2;
        if(!same){ await client.query('rollback'); return fail(res,409,'IDEMPOTENCY_KEY_REUSED','A sync idempotency key was reused with a different action payload.'); }
        duplicate = true;
        if(row.executed_at){
          results.push({idempotencyKey:action.idempotencyKey,accepted:true,executed:true,duplicate:true,result:row.result});
          continue;
        }
      } else {
        await client.query(
          'insert into public.liverpool_sync_receipts(user_id,idempotency_key,action_type,payload,performed_at) values($1::uuid,$2,$3,$4::jsonb,to_timestamp($5/1000.0))',
          [req.auth.userId,action.idempotencyKey,action.action,payload,action.performedAt],
        );
      }

      const execution=await applyStartSession(client,req.auth,action.payload,action.idempotencyKey);
      if(!execution.ok){
        await client.query('rollback');
        return fail(res,execution.status,execution.code,execution.message);
      }
      await client.query(
        'update public.liverpool_sync_receipts set executed_at=coalesce(executed_at,now()),result=$3::jsonb where user_id=$1::uuid and idempotency_key=$2',
        [req.auth.userId,action.idempotencyKey,JSON.stringify({sessionId:execution.sessionId,duplicate:execution.duplicate})],
      );
      results.push({idempotencyKey:action.idempotencyKey,accepted:true,executed:true,duplicate:duplicate||execution.duplicate,result:{sessionId:execution.sessionId}});
    }
    await client.query('commit');
    res.set('Cache-Control','no-store').json({ok:true,results});
  } catch(e){
    await client.query('rollback').catch(()=>{});
    console.error('[sync]',e.message);
    fail(res,503,'SYNC_FAILED','Batch not committed; retry safely.');
  } finally { client.release(); }
});

async function resolveSupabaseUser(req) {
  const match = (req.get('authorization') || '').match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return null;
  if (!supabaseUrl || !publishableKey) throw new Error('Authentication is not configured');
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: `Bearer ${match[1]}`, Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id && uuidPattern.test(user.id) ? user : null;
}
function validIdempotency(value) { return typeof value === 'string' && /^[a-zA-Z0-9:_-]{8,128}$/.test(value); }
app.post('/api/auth/bootstrap-owner', async (req, res) => {
  try {
    const expectedBootstrapCode = process.env.OWNER_BOOTSTRAP_CODE;
    const suppliedBootstrapCode = req.body?.bootstrapCode;
    if (!expectedBootstrapCode || typeof suppliedBootstrapCode !== 'string' || suppliedBootstrapCode.length < 16 || suppliedBootstrapCode !== expectedBootstrapCode) {
      return fail(res, 403, 'BOOTSTRAP_CODE_REQUIRED', 'A valid owner bootstrap code is required for first-time setup.');
    }
    const user = await resolveSupabaseUser(req);
    if (!user) return fail(res, 401, 'INVALID_SESSION', 'Sign in before setting up the owner account.');
    const { name, phone } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 || typeof phone !== 'string' || phone.trim().length > 30) return fail(res, 400, 'INVALID_PROFILE', 'Name and phone are required.');
    const client = await pool.connect();
    try {
      await client.query('begin');
      // Serialize first-owner bootstrap attempts; SELECT ... FOR UPDATE cannot lock an empty result set.
      await client.query('select pg_advisory_xact_lock($1, $2)', [724190, 1]);
      const owner = await client.query("select user_id from public.liverpool_app_members where role='owner' limit 1 for update");
      if (owner.rowCount) { await client.query('rollback'); return fail(res, 409, 'OWNER_ALREADY_EXISTS', 'An owner account is already configured. Ask the owner to add this user.'); }
      await client.query("insert into public.liverpool_app_members(user_id,role,is_active) values($1::uuid,'owner',true) on conflict(user_id) do update set role='owner',is_active=true", [user.id]);
      await client.query('commit');
      return res.status(201).json({ ok: true, user: { id: user.id, email: user.email, name: name.trim(), phone: phone.trim(), role: 'owner' } });
    } catch (e) { await client.query('rollback').catch(()=>{}); throw e; } finally { client.release(); }
  } catch (e) { console.error('[auth:bootstrap]', e.message); return fail(res, 503, 'BOOTSTRAP_FAILED', 'Owner setup could not be completed.'); }
});

app.get('/api/auth/me', requireAuth, (req,res) => res.set('Cache-Control','no-store').json({ok:true,user:req.auth}));

app.get('/api/owner/profile', requireAuth, requireRole('owner'), async (req,res) => {
  try {
    const result=await query(
      'select user_id,name,phone,business_name,created_at,updated_at from public.liverpool_owner_profiles where user_id=$1::uuid',
      [req.auth.userId],
    );
    const row=result.rows[0];
    res.set('Cache-Control','no-store').json({ok:true,profile:row?{
      userId:row.user_id,name:row.name,phone:row.phone,businessName:row.business_name,
      createdAt:row.created_at,updatedAt:row.updated_at
    }:null});
  } catch(e) {
    console.error('[owner-profile:read]',e.message);
    fail(res,503,'OWNER_PROFILE_UNAVAILABLE','Owner profile could not be loaded.');
  }
});

app.put('/api/owner/profile', requireAuth, requireRole('owner'), async (req,res) => {
  const body=req.body||{};
  if(typeof body.name!=='string'||body.name.trim().length<2||body.name.trim().length>100||
     typeof body.phone!=='string'||body.phone.trim().length>30||
     typeof body.businessName!=='string'||body.businessName.trim().length<2||body.businessName.trim().length>160) {
    return fail(res,400,'INVALID_OWNER_PROFILE','Owner name, phone, or business name is invalid.');
  }
  try {
    const result=await query(
      'insert into public.liverpool_owner_profiles(user_id,name,phone,business_name) values($1::uuid,$2,$3,$4) on conflict(user_id) do update set name=excluded.name,phone=excluded.phone,business_name=excluded.business_name,updated_at=now() returning user_id,name,phone,business_name,created_at,updated_at',
      [req.auth.userId,body.name.trim(),body.phone.trim(),body.businessName.trim()],
    );
    const row=result.rows[0];
    res.set('Cache-Control','no-store').json({ok:true,profile:{
      userId:row.user_id,name:row.name,phone:row.phone,businessName:row.business_name,
      createdAt:row.created_at,updatedAt:row.updated_at
    }});
  } catch(e) {
    console.error('[owner-profile:write]',e.message);
    fail(res,503,'OWNER_PROFILE_SAVE_FAILED','Owner profile could not be saved.');
  }
});


 
// Owner-managed Supabase memberships. Staff are assigned to exactly one branch.
app.get('/api/admin/members', requireAuth, requireRole('owner','admin'), async (req, res) => {
  if (!req.auth.branchScopeConfigured) return fail(res, 503, 'BRANCH_SCOPE_NOT_CONFIGURED', 'Apply the branch-membership database migration before managing memberships.');
  try {
    const result = await query(`select u.id as "userId", u.email, m.role, coalesce(m.is_active,false) as "isActive", m.branch_id as "branchId", coalesce(m.created_at,u.created_at) as "createdAt" from auth.users u left join public.liverpool_app_members m on m.user_id=u.id order by u.created_at asc`);
    res.set('Cache-Control','no-store').json({ ok:true, members:result.rows });
  } catch(e) { console.error('[members:list]',e.message); fail(res,503,'MEMBERS_UNAVAILABLE','Memberships could not be loaded.'); }
});

app.put('/api/admin/members/:userId', requireAuth, requireRole('owner'), async (req, res) => {
  if (!req.auth.branchScopeConfigured) return fail(res, 503, 'BRANCH_SCOPE_NOT_CONFIGURED', 'Apply the branch-membership database migration before assigning staff.');
  const targetUserId = req.params.userId;
  const b = req.body || {};
  const allowedRoles = new Set(['admin','supervisor','cashier','technician']);
  if (!uuidPattern.test(targetUserId) || !allowedRoles.has(b.role) ||
      (b.isActive !== undefined && typeof b.isActive !== 'boolean')) {
    return fail(res, 400, 'INVALID_MEMBER', 'Member identity, role, or active status is invalid.');
  }
  let branchId = null;
  if (b.role === 'admin') {
    if (b.branchId !== undefined && b.branchId !== null && b.branchId !== '') {
      return fail(res, 400, 'INVALID_MEMBER_BRANCH', 'Admin accounts have global access and must not have a branch assignment.');
    }
  } else {
    if (!validBranchId(b.branchId)) return fail(res, 400, 'INVALID_MEMBER_BRANCH', 'Supervisor, cashier, and technician accounts require a valid branch assignment.');
    branchId = b.branchId;
  }

  const client = await pool?.connect().catch(() => null);
  if (!client) return fail(res, 503, 'DATABASE_UNAVAILABLE', 'Database unavailable.');
  try {
    await client.query('begin');
    const authUser = await client.query('select id, email from auth.users where id=$1::uuid', [targetUserId]);
    if (!authUser.rowCount) {
      await client.query('rollback');
      return fail(res, 404, 'AUTH_USER_NOT_FOUND', 'Create the Supabase Auth account before assigning application access.');
    }
    const existing = await client.query('select role from public.liverpool_app_members where user_id=$1::uuid for update', [targetUserId]);
    if (existing.rows[0]?.role === 'owner') {
      await client.query('rollback');
      return fail(res, 409, 'OWNER_ROLE_PROTECTED', 'The primary owner membership cannot be changed through this endpoint.');
    }
    const result = await client.query(
      `insert into public.liverpool_app_members(user_id,role,is_active,branch_id)
       values($1::uuid,$2,$3,$4)
       on conflict(user_id) do update set role=excluded.role,is_active=excluded.is_active,branch_id=excluded.branch_id
       where public.liverpool_app_members.role <> 'owner'
       returning user_id as "userId",role,is_active as "isActive",branch_id as "branchId",created_at as "createdAt"`,
      [targetUserId, b.role, b.isActive ?? true, branchId]
    );
    if (!result.rowCount) {
      await client.query('rollback');
      return fail(res, 409, 'OWNER_ROLE_PROTECTED', 'The primary owner membership cannot be changed through this endpoint.');
    }
    await client.query('commit');
    return res.json({ ok:true, member:{ ...result.rows[0], email:authUser.rows[0].email || null } });
  } catch(e) {
    await client.query('rollback').catch(()=>{});
    console.error('[members:upsert]',e.message);
    return fail(res,503,'MEMBER_SAVE_FAILED','Membership could not be saved.');
  } finally { client.release(); }
});


// Owner-managed Supabase memberships. Staff are assigned to exactly one branch.
// Atomic point-of-sale: prices and stock come from the database, not the browser.
app.post('/api/finance/sales', requireAuth, requireRole('owner','admin','supervisor','cashier'), async (req,res) => {
  const b=req.body||{}; const lines=b.items;
  if(!validIdempotency(b.idempotencyKey)||!validBranchId(b.branchId)||typeof b.shiftId!=='string'||b.shiftId.length>100||!['cash','instapay','vodafone','card'].includes(b.paymentMethod)||!Array.isArray(lines)||lines.length<1||lines.length>50) return fail(res,400,'INVALID_SALE','Sale fields are invalid.');
  const saleBranchAccess = authorizeBranch(req.auth, b.branchId);
  if (!saleBranchAccess.allowed) return fail(res, saleBranchAccess.status, saleBranchAccess.code, saleBranchAccess.message);
  const grouped=new Map();
  for(const line of lines){ if(!line||typeof line.inventoryId!=='string'||line.inventoryId.length>128||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10000) return fail(res,400,'INVALID_ITEMS','Sale items are invalid.'); const combinedQuantity=(grouped.get(line.inventoryId)||0)+line.quantity; if(!Number.isSafeInteger(combinedQuantity)||combinedQuantity>10000) return fail(res,400,'INVALID_ITEMS','Combined quantity per item must be between 1 and 10000.'); grouped.set(line.inventoryId,combinedQuantity); }
  const client=await pool.connect();
  try {
    await client.query('begin');
    const prior=await client.query('select id,total,created_at,branch_id,shift_id,cashier_id,payment_method from public.liverpool_sales where idempotency_key=$1',[b.idempotencyKey]);
    if(prior.rowCount){
      const existing=prior.rows[0];
      const priorItems = await client.query('select inventory_id as "inventoryId", quantity from public.liverpool_sale_items where sale_id=$1 order by inventory_id',[existing.id]);
      const requestedItems=[...grouped.entries()].sort(([a],[b])=>a.localeCompare(b));
      const savedItems=priorItems.rows.map(item=>[item.inventoryId,Number(item.quantity)]);
      const sameItems=requestedItems.length===savedItems.length&&requestedItems.every(([id,quantity],index)=>id===savedItems[index][0]&&quantity===savedItems[index][1]);
      const same=existing.branch_id===b.branchId&&existing.shift_id===b.shiftId&&existing.cashier_id===req.auth.userId&&existing.payment_method===b.paymentMethod&&sameItems;
      if(!same){await client.query('rollback');return fail(res,409,'IDEMPOTENCY_KEY_REUSED','This idempotency key was already used for a different sale.');}
      const remainingItems = await client.query('select si.inventory_id as "inventoryId", i.stock_quantity as "remainingStock" from public.liverpool_sale_items si join public.liverpool_inventory i on i.id=si.inventory_id where si.sale_id=$1',[existing.id]);
      await client.query('commit');
      return res.json({ok:true,duplicate:true,sale:existing,total:Number(existing.total),items:remainingItems.rows});
    }
    const ids=[...grouped.keys()];
    const products=await client.query('select id,branch_id,name,selling_price,cost_price,stock_quantity from public.liverpool_inventory where id=any($1::text[]) and is_active=true order by id for update',[ids]);
    if(products.rowCount!==ids.length){ await client.query('rollback'); return fail(res,409,'ITEM_NOT_FOUND','One or more items are missing or inactive.'); }
    const byId=new Map(products.rows.map(p=>[p.id,p])); let total=0;
    for(const [id,qty] of grouped){ const p=byId.get(id); if(p.branch_id!==b.branchId){await client.query('rollback');return fail(res,403,'BRANCH_MISMATCH','An item belongs to another branch.');} if(p.stock_quantity<qty){await client.query('rollback');return res.status(409).json({ok:false,error:{code:'INSUFFICIENT_STOCK',message:`Insufficient stock for ${p.name}.`},itemId:id,available:p.stock_quantity});} total+=Number(p.selling_price)*qty; }
    // Match the cash-transaction ceiling and reject numeric overflow before any sale is written.
    if(!Number.isFinite(total)||total<0||total>100000000){await client.query('rollback');return fail(res,400,'SALE_TOTAL_OUT_OF_RANGE','Sale total exceeds the allowed limit.');}
    const sale=await client.query('insert into public.liverpool_sales(idempotency_key,branch_id,shift_id,cashier_id,payment_method,total) values($1,$2,$3,$4,$5,$6) returning id,total,created_at',[b.idempotencyKey,b.branchId,b.shiftId,req.auth.userId,b.paymentMethod,total.toFixed(2)]);
    for(const [id,qty] of grouped){ const p=byId.get(id); await client.query('update public.liverpool_inventory set stock_quantity=stock_quantity-$2,updated_at=now(),updated_by=$3 where id=$1',[id,qty,req.auth.userId]); await client.query('insert into public.liverpool_sale_items(sale_id,inventory_id,item_name,quantity,unit_price,unit_cost,line_total) values($1,$2,$3,$4,$5,$6,$7)',[sale.rows[0].id,id,p.name,qty,p.selling_price,p.cost_price,(Number(p.selling_price)*qty).toFixed(2)]); await client.query('insert into public.liverpool_inventory_movements(inventory_id,branch_id,quantity_delta,reason,reference_id,performed_by) values($1,$2,$3,$4,$5,$6)',[id,b.branchId,-qty,'POS sale',sale.rows[0].id,req.auth.userId]); }
    await client.query('insert into public.liverpool_cash_transactions(idempotency_key,branch_id,shift_id,sale_id,type,payment_method,amount,description,performed_by) values($1,$2,$3,$4,\'sale\',$5,$6,$7,$8)',[b.idempotencyKey,b.branchId,b.shiftId,sale.rows[0].id,b.paymentMethod,total.toFixed(2),`POS sale ${sale.rows[0].id}`,req.auth.userId]);
    await client.query('commit'); return res.status(201).json({ok:true,duplicate:false,sale:sale.rows[0],items:[...grouped].map(([id,quantity])=>({inventoryId:id,quantity,remainingStock:byId.get(id).stock_quantity-quantity})),total:Number(total.toFixed(2))});
  } catch(e){ await client.query('rollback').catch(()=>{}); if(e.code==='23505'){return fail(res,409,'DUPLICATE_REQUEST','Duplicate sale request. Retry with the original idempotency key to retrieve it.');} console.error('[finance:sale]',e.message); return fail(res,503,'SALE_NOT_COMMITTED','Sale was not committed; retry with the same idempotency key.'); } finally {client.release();}
});
app.get('/api/inventory/items', requireAuth, async (req,res) => {
  try {
    const requestedBranchId = typeof req.query.branchId === 'string' ? req.query.branchId : null;
    const scope = resolveBranchFilter(req.auth, requestedBranchId);
    if (!scope.allowed) return fail(res, scope.status, scope.code, scope.message);
    const branchId = scope.branchId;
    const canViewCost = ['owner','admin','supervisor'].includes(req.auth.role);
    const columns = canViewCost ? 'id,branch_id,name,category,selling_price,cost_price,stock_quantity,min_stock_threshold,is_active,updated_at' : 'id,branch_id,name,category,selling_price,stock_quantity,min_stock_threshold,is_active,updated_at';
    const result = branchId
      ? await query(`select ${columns} from public.liverpool_inventory where branch_id=$1 and is_active=true order by name`,[branchId])
      : await query(`select ${columns} from public.liverpool_inventory where is_active=true order by branch_id,name`);
    res.set('Cache-Control','no-store').json({ok:true,items:result.rows});
  } catch(e) { console.error('[inventory:list]',e.message); fail(res,503,'INVENTORY_UNAVAILABLE','Inventory could not be loaded.'); }
});
app.get('/api/finance/cash-transactions', requireAuth, requireRole('owner','admin','supervisor'), async (req,res) => {
  try {
    const requestedBranchId = typeof req.query.branchId === 'string' ? req.query.branchId : null;
    const scope = resolveBranchFilter(req.auth, requestedBranchId);
    if (!scope.allowed) return fail(res, scope.status, scope.code, scope.message);
    const branchId = scope.branchId;
    const result = branchId
      ? await query('select id,branch_id,shift_id,sale_id,type,payment_method,amount,description,notes,performed_by,created_at from public.liverpool_cash_transactions where branch_id=$1 order by created_at desc limit 500',[branchId])
      : await query('select id,branch_id,shift_id,sale_id,type,payment_method,amount,description,notes,performed_by,created_at from public.liverpool_cash_transactions order by created_at desc limit 500');
    res.set('Cache-Control','no-store').json({ok:true,transactions:result.rows});
  } catch(e) { console.error('[finance:cash-list]',e.message); fail(res,503,'CASHBOX_UNAVAILABLE','Cashbox transactions could not be loaded.'); }
});

app.post('/api/inventory/items', requireAuth, requireRole('owner','admin','supervisor'), async(req,res)=>{
 const b=req.body||{}; if(typeof b.id!=='string'||b.id.length<1||b.id.length>128||!validBranchId(b.branchId)||typeof b.name!=='string'||!b.name.trim()||b.name.length>160||!['hot_drinks','cold_drinks','food','snacks','other'].includes(b.category)||![b.sellingPrice,b.costPrice,b.stockQuantity,b.minStockThreshold].every(Number.isFinite)||b.sellingPrice<0||b.costPrice<0||!Number.isInteger(b.stockQuantity)||b.stockQuantity<0||!Number.isInteger(b.minStockThreshold)||b.minStockThreshold<0) return fail(res,400,'INVALID_INVENTORY_ITEM','Inventory item fields are invalid.');
 const inventoryBranchAccess = authorizeBranch(req.auth, b.branchId);
 if (!inventoryBranchAccess.allowed) return fail(res, inventoryBranchAccess.status, inventoryBranchAccess.code, inventoryBranchAccess.message);
 const client=await pool.connect();
 try {
  await client.query('begin');
  const r=await client.query(`insert into public.liverpool_inventory(id,branch_id,name,category,selling_price,cost_price,stock_quantity,min_stock_threshold,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(id) do update set name=excluded.name,category=excluded.category,selling_price=excluded.selling_price,cost_price=excluded.cost_price,min_stock_threshold=excluded.min_stock_threshold,updated_at=now(),updated_by=excluded.updated_by where public.liverpool_inventory.branch_id=excluded.branch_id returning *, (xmax = 0) as was_inserted`,[b.id,b.branchId,b.name.trim(),b.category,b.sellingPrice,b.costPrice,b.stockQuantity,b.minStockThreshold,req.auth.userId]);
  if(!r.rowCount){await client.query('rollback');return fail(res,409,'BRANCH_MISMATCH','Inventory item cannot be moved between branches through this endpoint.');}
  const item=r.rows[0];
  // Initial stock is a real inventory event and must be auditable like later adjustments.
  if(item.was_inserted && b.stockQuantity>0){
   const ref=(await client.query('select gen_random_uuid() as id')).rows[0].id;
   await client.query('insert into public.liverpool_inventory_movements(inventory_id,branch_id,quantity_delta,reason,reference_id,performed_by) values($1,$2,$3,$4,$5,$6)',[b.id,b.branchId,b.stockQuantity,'Initial stock',ref,req.auth.userId]);
  }
  delete item.was_inserted;
  await client.query('commit');
  return res.status(201).json({ok:true,item});
 } catch(e){await client.query('rollback').catch(()=>{});console.error('[inventory:upsert]',e.message);return fail(res,503,'INVENTORY_SAVE_FAILED','Inventory item could not be saved.');} finally {client.release();}
});
app.post('/api/inventory/adjustments', requireAuth, requireRole('owner','admin','supervisor'), async(req,res)=>{
 const b=req.body||{}; if(!validIdempotency(b.idempotencyKey)||typeof b.inventoryId!=='string'||!Number.isSafeInteger(b.quantityDelta)||b.quantityDelta===0||Math.abs(b.quantityDelta)>100000||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>200)return fail(res,400,'INVALID_ADJUSTMENT','Inventory adjustment fields are invalid.'); const client=await pool.connect(); try{await client.query('begin'); const prior=await client.query('select id,inventory_id,branch_id,quantity_delta,reason from public.liverpool_inventory_movements where idempotency_key=$1 limit 1',[b.idempotencyKey]); if(prior.rowCount){const movement=prior.rows[0];const priorAccess=authorizeBranch(req.auth,movement.branch_id);if(!priorAccess.allowed){await client.query('rollback');return fail(res,priorAccess.status,priorAccess.code,priorAccess.message);}const same=movement.inventory_id===b.inventoryId&&movement.quantity_delta===b.quantityDelta&&movement.reason===b.reason.trim();await client.query('commit');if(!same)return fail(res,409,'IDEMPOTENCY_KEY_REUSED','This idempotency key was already used for a different inventory adjustment.');return res.json({ok:true,duplicate:true});} const item=await client.query('select id,branch_id,stock_quantity from public.liverpool_inventory where id=$1 and is_active=true for update',[b.inventoryId]); if(!item.rowCount){await client.query('rollback');return fail(res,404,'ITEM_NOT_FOUND','Inventory item not found.');} const itemBranchAccess=authorizeBranch(req.auth,item.rows[0].branch_id);if(!itemBranchAccess.allowed){await client.query('rollback');return fail(res,itemBranchAccess.status,itemBranchAccess.code,itemBranchAccess.message);} if(b.quantityDelta<0&&item.rows[0].stock_quantity < -b.quantityDelta){await client.query('rollback');return fail(res,409,'INSUFFICIENT_STOCK','Adjustment would make stock negative.');} const ref=(await client.query('select gen_random_uuid() as id')).rows[0].id; await client.query('update public.liverpool_inventory set stock_quantity=stock_quantity+$2,updated_at=now(),updated_by=$3 where id=$1',[b.inventoryId,b.quantityDelta,req.auth.userId]); await client.query('insert into public.liverpool_inventory_movements(inventory_id,branch_id,quantity_delta,reason,reference_id,performed_by,idempotency_key) values($1,$2,$3,$4,$5,$6,$7)',[b.inventoryId,item.rows[0].branch_id,b.quantityDelta,b.reason.trim(),ref,req.auth.userId,b.idempotencyKey]); await client.query('commit');return res.status(201).json({ok:true,referenceId:ref,stockQuantity:item.rows[0].stock_quantity+b.quantityDelta});}catch(e){await client.query('rollback').catch(()=>{});console.error('[inventory:adjust]',e.message);return fail(res,503,'ADJUSTMENT_FAILED','Inventory adjustment was not committed.');}finally{client.release();}
});
app.post('/api/finance/cash-transactions', requireAuth, requireRole('owner','admin','supervisor','cashier'), async(req,res)=>{
 const b=req.body||{}; if(!validIdempotency(b.idempotencyKey)||!validBranchId(b.branchId)||typeof b.shiftId!=='string'||!['expense','advance','withdrawal','refund','opening_balance','adjustment','debt_collection'].includes(b.type)||!['cash','instapay','vodafone','card'].includes(b.paymentMethod)||!Number.isFinite(b.amount)||b.amount<=0||b.amount>100000000||typeof b.description!=='string'||!b.description.trim()||b.description.length>500||(b.notes!==undefined&&(typeof b.notes!=='string'||b.notes.length>2000)))return fail(res,400,'INVALID_CASH_TRANSACTION','Cash transaction fields are invalid.'); if(['withdrawal','refund','adjustment','opening_balance'].includes(b.type)&&!['owner','admin','supervisor'].includes(req.auth.role))return fail(res,403,'FORBIDDEN','This role cannot record this transaction type.'); const cashBranchAccess=authorizeBranch(req.auth,b.branchId);if(!cashBranchAccess.allowed)return fail(res,cashBranchAccess.status,cashBranchAccess.code,cashBranchAccess.message); try{const r=await query('insert into public.liverpool_cash_transactions(idempotency_key,branch_id,shift_id,type,payment_method,amount,description,notes,performed_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(idempotency_key) do nothing returning id,created_at',[b.idempotencyKey,b.branchId,b.shiftId,b.type,b.paymentMethod,b.amount.toFixed(2),b.description.trim(),typeof b.notes==='string'?b.notes.trim():null,req.auth.userId]);if(!r.rowCount){const old=await query('select id,created_at,branch_id,shift_id,type,payment_method,amount,description,notes from public.liverpool_cash_transactions where idempotency_key=$1',[b.idempotencyKey]);const tx=old.rows[0];if(!tx)return fail(res,409,'IDEMPOTENCY_CONFLICT','This idempotency key is already in use.');const same=tx.branch_id===b.branchId&&tx.shift_id===b.shiftId&&tx.type===b.type&&tx.payment_method===b.paymentMethod&&Number(tx.amount)===Number(b.amount.toFixed(2))&&tx.description===b.description.trim()&&(tx.notes||'')===(typeof b.notes==='string'?b.notes.trim():'');if(!same)return fail(res,409,'IDEMPOTENCY_KEY_REUSED','This idempotency key was already used for a different transaction.');return res.json({ok:true,duplicate:true,transaction:{id:tx.id,created_at:tx.created_at}});}return res.status(201).json({ok:true,transaction:r.rows[0]});}catch(e){console.error('[finance:cash]',e.message);return fail(res,503,'CASH_TRANSACTION_FAILED','Cash transaction was not committed.');}
});

app.use((err,_req,res,_next)=>{ if(err?.type==='entity.too.large') return fail(res,413,'BODY_TOO_LARGE','Request body too large.'); if(err instanceof SyntaxError) return fail(res,400,'INVALID_JSON','Invalid JSON body.'); console.error('[http]',err?.message||err); fail(res,500,'INTERNAL_ERROR','Unexpected server error.'); });
if(fs.existsSync(distDir)){ app.use(express.static(distDir,{index:'index.html',etag:true,maxAge:'1h'})); app.get('*',(req,res,next)=>req.path.startsWith('/api/')?next():res.sendFile(path.join(distDir,'index.html'))); } else app.get('/',(_req,res)=>res.status(503).send('Application has not been built yet.'));

// Vercel imports this Express app as a serverless function. Only start a listening
// socket when this module is executed directly (for local Docker/Node deployments).
if (require.main === module) {
  const server=app.listen(port,'0.0.0.0',()=>console.log(`[web] listening on 0.0.0.0:${port}`));
  async function shutdown(signal){ console.log(`[web] ${signal}; shutting down`); server.close(async()=>{await pool?.end().catch(()=>{});process.exit(0);}); }
  process.on('SIGTERM',()=>shutdown('SIGTERM')); process.on('SIGINT',()=>shutdown('SIGINT'));
}

module.exports = app;
