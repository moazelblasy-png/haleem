require('dotenv').config();
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { Pool } = require('pg');
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
    const result = await query('select role, is_active from public.liverpool_app_members where user_id = $1::uuid', [user.id]);
    if (!result.rows[0]?.is_active) return fail(res, 403, 'NOT_A_MEMBER', 'This account is not authorized.');
    req.auth = { userId: user.id, role: result.rows[0].role, email: user.email || null };
    next();
  } catch (e) { console.error('[auth]', e.message); return fail(res, 503, 'AUTH_UNAVAILABLE', 'Authentication service unavailable.'); }
}
function requireRole(...roles) { return (req, res, next) => req.auth && roles.includes(req.auth.role) ? next() : fail(res, 403, 'FORBIDDEN', 'Insufficient permissions.'); }
app.get('/api/health', async (_req, res) => { try { await query('select 1'); res.set('Cache-Control','no-store').json({ok:true,database:'connected'}); } catch(e) { console.error('[health]',e.message); fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.'); } });
app.get('/api/state', requireAuth, async (_req, res) => {
  try { const r = await query('select state_key,state_value,version,updated_at from public.liverpool_app_state order by state_key');
    res.set('Cache-Control','no-store').json({ok:true,state:Object.fromEntries(r.rows.map(x=>[x.state_key,x.state_value])),versions:Object.fromEntries(r.rows.map(x=>[x.state_key,x.version]))});
  } catch(e) { console.error('[state:read]',e.message); fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.'); }
});
app.put('/api/state/:key', requireAuth, requireRole('owner','admin'), async (req,res) => {
  const key=req.params.key, {value,expectedVersion}=req.body||{};
  if(!keyPattern.test(key)) return fail(res,400,'INVALID_KEY','Invalid state key.');
  if(typeof value==='undefined') return fail(res,400,'MISSING_VALUE','State value is required.');
  if(Buffer.byteLength(JSON.stringify(value),'utf8')>500000) return fail(res,413,'VALUE_TOO_LARGE','State value exceeds 500 KB.');
  if(expectedVersion!==null && expectedVersion!==undefined && (!Number.isSafeInteger(expectedVersion)||expectedVersion<0)) return fail(res,400,'INVALID_VERSION','expectedVersion must be non-negative integer or null.');
  const client=await pool?.connect().catch(()=>null); if(!client) return fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.');
  try {
    await client.query('begin');
    const current=await client.query('select version from public.liverpool_app_state where state_key=$1 for update',[key]);
    if(current.rowCount===0 && expectedVersion!=null && expectedVersion!==0){ await client.query('rollback'); return fail(res,409,'VERSION_CONFLICT','State changed on another device; refresh first.'); }
    if(current.rowCount>0 && expectedVersion!==current.rows[0].version){ await client.query('rollback'); return res.status(409).json({ok:false,error:{code:'VERSION_CONFLICT',message:'State changed on another device; refresh first.'},currentVersion:current.rows[0].version}); }
    const saved=await client.query(`insert into public.liverpool_app_state(state_key,state_value,version,updated_at,updated_by) values($1,$2::jsonb,1,now(),$3::uuid) on conflict(state_key) do update set state_value=excluded.state_value,version=public.liverpool_app_state.version+1,updated_at=now(),updated_by=excluded.updated_by returning version,updated_at`,[key,JSON.stringify(value),req.auth.userId]);
    await client.query('commit'); res.set('Cache-Control','no-store').json({ok:true,key,version:saved.rows[0].version,updatedAt:saved.rows[0].updated_at});
  } catch(e) { await client.query('rollback').catch(()=>{}); console.error('[state:write]',e.message); fail(res,503,'DATABASE_UNAVAILABLE','Could not persist state.'); } finally { client.release(); }
});
app.post('/api/sync/receipts',requireAuth,requireRole('owner','admin','supervisor','cashier'),async(req,res)=>{
  const actions=req.body?.actions;
  if(!Array.isArray(actions)||actions.length<1||actions.length>100) return fail(res,400,'INVALID_BATCH','Send 1 to 100 actions.');
  for(const a of actions){ if(!a||typeof a.idempotencyKey!=='string'||!/^[a-zA-Z0-9:_-]{8,128}$/.test(a.idempotencyKey)||typeof a.action!=='string'||a.action.length>80||!Number.isFinite(a.performedAt)||typeof a.payload==='undefined') return fail(res,400,'INVALID_ACTION','Invalid action item.'); if(Buffer.byteLength(JSON.stringify(a.payload),'utf8')>100000) return fail(res,413,'PAYLOAD_TOO_LARGE','Action payload exceeds 100 KB.'); }
  const client=await pool?.connect().catch(()=>null); if(!client) return fail(res,503,'DATABASE_UNAVAILABLE','Database unavailable.');
  try { await client.query('begin'); const results=[]; for(const a of actions){ const r=await client.query(`insert into public.liverpool_sync_receipts(user_id,idempotency_key,action_type,payload,performed_at) values($1::uuid,$2,$3,$4::jsonb,to_timestamp($5/1000.0)) on conflict(user_id,idempotency_key) do nothing returning idempotency_key`,[req.auth.userId,a.idempotencyKey,a.action,JSON.stringify(a.payload),a.performedAt]); results.push({idempotencyKey:a.idempotencyKey,accepted:true,duplicate:r.rowCount===0}); } await client.query('commit'); res.json({ok:true,results}); }
  catch(e){ await client.query('rollback').catch(()=>{}); console.error('[sync]',e.message); fail(res,503,'SYNC_FAILED','Batch not committed; retry safely.'); } finally { client.release(); }
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

// Atomic point-of-sale: prices and stock come from the database, not the browser.
app.post('/api/finance/sales', requireAuth, requireRole('owner','admin','supervisor','cashier'), async (req,res) => {
  const b=req.body||{}; const lines=b.items;
  if(!validIdempotency(b.idempotencyKey)||typeof b.branchId!=='string'||b.branchId.length>80||typeof b.shiftId!=='string'||b.shiftId.length>100||!['cash','instapay','vodafone','card'].includes(b.paymentMethod)||!Array.isArray(lines)||lines.length<1||lines.length>50) return fail(res,400,'INVALID_SALE','Sale fields are invalid.');
  const grouped=new Map();
  for(const line of lines){ if(!line||typeof line.inventoryId!=='string'||line.inventoryId.length>128||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10000) return fail(res,400,'INVALID_ITEMS','Sale items are invalid.'); grouped.set(line.inventoryId,(grouped.get(line.inventoryId)||0)+line.quantity); }
  const client=await pool.connect();
  try {
    await client.query('begin');
    const prior=await client.query('select id,total,created_at from public.liverpool_sales where idempotency_key=$1',[b.idempotencyKey]);
    if(prior.rowCount){
      const priorItems = await client.query('select si.inventory_id as "inventoryId", i.stock_quantity as "remainingStock" from public.liverpool_sale_items si join public.liverpool_inventory i on i.id=si.inventory_id where si.sale_id=$1',[prior.rows[0].id]);
      await client.query('commit');
      return res.json({ok:true,duplicate:true,sale:prior.rows[0],total:Number(prior.rows[0].total),items:priorItems.rows});
    }
    const ids=[...grouped.keys()];
    const products=await client.query('select id,branch_id,name,selling_price,cost_price,stock_quantity from public.liverpool_inventory where id=any($1::text[]) and is_active=true order by id for update',[ids]);
    if(products.rowCount!==ids.length){ await client.query('rollback'); return fail(res,409,'ITEM_NOT_FOUND','One or more items are missing or inactive.'); }
    const byId=new Map(products.rows.map(p=>[p.id,p])); let total=0;
    for(const [id,qty] of grouped){ const p=byId.get(id); if(p.branch_id!==b.branchId){await client.query('rollback');return fail(res,403,'BRANCH_MISMATCH','An item belongs to another branch.');} if(p.stock_quantity<qty){await client.query('rollback');return res.status(409).json({ok:false,error:{code:'INSUFFICIENT_STOCK',message:`Insufficient stock for ${p.name}.`},itemId:id,available:p.stock_quantity});} total+=Number(p.selling_price)*qty; }
    const sale=await client.query('insert into public.liverpool_sales(idempotency_key,branch_id,shift_id,cashier_id,payment_method,total) values($1,$2,$3,$4,$5,$6) returning id,total,created_at',[b.idempotencyKey,b.branchId,b.shiftId,req.auth.userId,b.paymentMethod,total.toFixed(2)]);
    for(const [id,qty] of grouped){ const p=byId.get(id); await client.query('update public.liverpool_inventory set stock_quantity=stock_quantity-$2,updated_at=now(),updated_by=$3 where id=$1',[id,qty,req.auth.userId]); await client.query('insert into public.liverpool_sale_items(sale_id,inventory_id,item_name,quantity,unit_price,unit_cost,line_total) values($1,$2,$3,$4,$5,$6,$7)',[sale.rows[0].id,id,p.name,qty,p.selling_price,p.cost_price,(Number(p.selling_price)*qty).toFixed(2)]); await client.query('insert into public.liverpool_inventory_movements(inventory_id,branch_id,quantity_delta,reason,reference_id,performed_by) values($1,$2,$3,$4,$5,$6)',[id,b.branchId,-qty,'POS sale',sale.rows[0].id,req.auth.userId]); }
    await client.query('insert into public.liverpool_cash_transactions(idempotency_key,branch_id,shift_id,sale_id,type,payment_method,amount,description,performed_by) values($1,$2,$3,$4,\'sale\',$5,$6,$7,$8)',[b.idempotencyKey,b.branchId,b.shiftId,sale.rows[0].id,b.paymentMethod,total.toFixed(2),`POS sale ${sale.rows[0].id}`,req.auth.userId]);
    await client.query('commit'); return res.status(201).json({ok:true,duplicate:false,sale:sale.rows[0],items:[...grouped].map(([id,quantity])=>({inventoryId:id,quantity,remainingStock:byId.get(id).stock_quantity-quantity})),total:Number(total.toFixed(2))});
  } catch(e){ await client.query('rollback').catch(()=>{}); if(e.code==='23505'){return fail(res,409,'DUPLICATE_REQUEST','Duplicate sale request. Retry with the original idempotency key to retrieve it.');} console.error('[finance:sale]',e.message); return fail(res,503,'SALE_NOT_COMMITTED','Sale was not committed; retry with the same idempotency key.'); } finally {client.release();}
});
app.get('/api/inventory/items', requireAuth, async (req,res) => {
  try {
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : null;
    const canViewCost = ['owner','admin','supervisor'].includes(req.auth.role);
    const columns = canViewCost ? 'id,branch_id,name,category,selling_price,cost_price,stock_quantity,min_stock_threshold,is_active,updated_at' : 'id,branch_id,name,category,selling_price,stock_quantity,min_stock_threshold,is_active,updated_at';
    const result = branchId
      ? await query(`select ${columns} from public.liverpool_inventory where branch_id=$1 and is_active=true order by name`,[branchId])
      : await query(`select ${columns} from public.liverpool_inventory where is_active=true order by branch_id,name`);
    res.set('Cache-Control','no-store').json({ok:true,items:result.rows});
  } catch(e) { console.error('[inventory:list]',e.message); fail(res,503,'INVENTORY_UNAVAILABLE','Inventory could not be loaded.'); }
});
app.get('/api/finance/cash-transactions', requireAuth, async (req,res) => {
  try {
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : null;
    const result = branchId
      ? await query('select id,branch_id,shift_id,sale_id,type,payment_method,amount,description,notes,performed_by,created_at from public.liverpool_cash_transactions where branch_id=$1 order by created_at desc limit 500',[branchId])
      : await query('select id,branch_id,shift_id,sale_id,type,payment_method,amount,description,notes,performed_by,created_at from public.liverpool_cash_transactions order by created_at desc limit 500');
    res.set('Cache-Control','no-store').json({ok:true,transactions:result.rows});
  } catch(e) { console.error('[finance:cash-list]',e.message); fail(res,503,'CASHBOX_UNAVAILABLE','Cashbox transactions could not be loaded.'); }
});

app.post('/api/inventory/items', requireAuth, requireRole('owner','admin','supervisor'), async(req,res)=>{
 const b=req.body||{}; if(typeof b.id!=='string'||b.id.length<1||b.id.length>128||typeof b.branchId!=='string'||typeof b.name!=='string'||!b.name.trim()||b.name.length>160||!['hot_drinks','cold_drinks','food','snacks','other'].includes(b.category)||![b.sellingPrice,b.costPrice,b.stockQuantity,b.minStockThreshold].every(Number.isFinite)||b.sellingPrice<0||b.costPrice<0||!Number.isInteger(b.stockQuantity)||b.stockQuantity<0||!Number.isInteger(b.minStockThreshold)||b.minStockThreshold<0) return fail(res,400,'INVALID_INVENTORY_ITEM','Inventory item fields are invalid.');
 try {const r=await query(`insert into public.liverpool_inventory(id,branch_id,name,category,selling_price,cost_price,stock_quantity,min_stock_threshold,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(id) do update set name=excluded.name,category=excluded.category,selling_price=excluded.selling_price,cost_price=excluded.cost_price,min_stock_threshold=excluded.min_stock_threshold,updated_at=now(),updated_by=excluded.updated_by where public.liverpool_inventory.branch_id=excluded.branch_id returning *`,[b.id,b.branchId,b.name.trim(),b.category,b.sellingPrice,b.costPrice,b.stockQuantity,b.minStockThreshold,req.auth.userId]); if(!r.rowCount)return fail(res,409,'BRANCH_MISMATCH','Inventory item cannot be moved between branches through this endpoint.'); return res.status(201).json({ok:true,item:r.rows[0]});} catch(e){console.error('[inventory:upsert]',e.message);return fail(res,503,'INVENTORY_SAVE_FAILED','Inventory item could not be saved.');}
});
app.post('/api/inventory/adjustments', requireAuth, requireRole('owner','admin','supervisor'), async(req,res)=>{
 const b=req.body||{}; if(!validIdempotency(b.idempotencyKey)||typeof b.inventoryId!=='string'||!Number.isSafeInteger(b.quantityDelta)||b.quantityDelta===0||Math.abs(b.quantityDelta)>100000||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>200)return fail(res,400,'INVALID_ADJUSTMENT','Inventory adjustment fields are invalid.'); const client=await pool.connect(); try{await client.query('begin'); const prior=await client.query('select id from public.liverpool_inventory_movements where idempotency_key=$1 limit 1',[b.idempotencyKey]); if(prior.rowCount){await client.query('commit');return res.json({ok:true,duplicate:true});} const item=await client.query('select id,branch_id,stock_quantity from public.liverpool_inventory where id=$1 and is_active=true for update',[b.inventoryId]); if(!item.rowCount){await client.query('rollback');return fail(res,404,'ITEM_NOT_FOUND','Inventory item not found.');} if(b.quantityDelta<0&&item.rows[0].stock_quantity < -b.quantityDelta){await client.query('rollback');return fail(res,409,'INSUFFICIENT_STOCK','Adjustment would make stock negative.');} const ref=(await client.query('select gen_random_uuid() as id')).rows[0].id; await client.query('update public.liverpool_inventory set stock_quantity=stock_quantity+$2,updated_at=now(),updated_by=$3 where id=$1',[b.inventoryId,b.quantityDelta,req.auth.userId]); await client.query('insert into public.liverpool_inventory_movements(inventory_id,branch_id,quantity_delta,reason,reference_id,performed_by,idempotency_key) values($1,$2,$3,$4,$5,$6,$7)',[b.inventoryId,item.rows[0].branch_id,b.quantityDelta,b.reason.trim(),ref,req.auth.userId,b.idempotencyKey]); await client.query('commit');return res.status(201).json({ok:true,referenceId:ref,stockQuantity:item.rows[0].stock_quantity+b.quantityDelta});}catch(e){await client.query('rollback').catch(()=>{});console.error('[inventory:adjust]',e.message);return fail(res,503,'ADJUSTMENT_FAILED','Inventory adjustment was not committed.');}finally{client.release();}
});
app.post('/api/finance/cash-transactions', requireAuth, requireRole('owner','admin','supervisor','cashier'), async(req,res)=>{
 const b=req.body||{}; if(!validIdempotency(b.idempotencyKey)||typeof b.branchId!=='string'||typeof b.shiftId!=='string'||!['expense','advance','withdrawal','refund','opening_balance','adjustment','debt_collection'].includes(b.type)||!['cash','instapay','vodafone','card'].includes(b.paymentMethod)||!Number.isFinite(b.amount)||b.amount<=0||b.amount>100000000||typeof b.description!=='string'||!b.description.trim()||b.description.length>500||(b.notes!==undefined&&(typeof b.notes!=='string'||b.notes.length>2000)))return fail(res,400,'INVALID_CASH_TRANSACTION','Cash transaction fields are invalid.'); if(['withdrawal','refund','adjustment','opening_balance'].includes(b.type)&&!['owner','admin','supervisor'].includes(req.auth.role))return fail(res,403,'FORBIDDEN','This role cannot record this transaction type.'); try{const r=await query('insert into public.liverpool_cash_transactions(idempotency_key,branch_id,shift_id,type,payment_method,amount,description,notes,performed_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(idempotency_key) do nothing returning id,created_at',[b.idempotencyKey,b.branchId,b.shiftId,b.type,b.paymentMethod,b.amount.toFixed(2),b.description.trim(),typeof b.notes==='string'?b.notes.trim():null,req.auth.userId]);if(!r.rowCount){const old=await query('select id,created_at from public.liverpool_cash_transactions where idempotency_key=$1',[b.idempotencyKey]);return res.json({ok:true,duplicate:true,transaction:old.rows[0]});}return res.status(201).json({ok:true,transaction:r.rows[0]});}catch(e){console.error('[finance:cash]',e.message);return fail(res,503,'CASH_TRANSACTION_FAILED','Cash transaction was not committed.');}
});

app.use((err,_req,res,_next)=>{ if(err?.type==='entity.too.large') return fail(res,413,'BODY_TOO_LARGE','Request body too large.'); if(err instanceof SyntaxError) return fail(res,400,'INVALID_JSON','Invalid JSON body.'); console.error('[http]',err?.message||err); fail(res,500,'INTERNAL_ERROR','Unexpected server error.'); });
if(fs.existsSync(distDir)){ app.use(express.static(distDir,{index:'index.html',etag:true,maxAge:'1h'})); app.get('*',(req,res,next)=>req.path.startsWith('/api/')?next():res.sendFile(path.join(distDir,'index.html'))); } else app.get('/',(_req,res)=>res.status(503).send('Application has not been built yet.'));
const server=app.listen(port,'0.0.0.0',()=>console.log(`[web] listening on 0.0.0.0:${port}`));
async function shutdown(signal){ console.log(`[web] ${signal}; shutting down`); server.close(async()=>{await pool?.end().catch(()=>{});process.exit(0);}); }
process.on('SIGTERM',()=>shutdown('SIGTERM')); process.on('SIGINT',()=>shutdown('SIGINT'));
