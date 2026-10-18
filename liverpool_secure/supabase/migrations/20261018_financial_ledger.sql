-- Apply after 20261017_secure_api_sync.sql. Financial records are server-only.
begin;
create table if not exists public.liverpool_inventory (
  id text primary key, branch_id text not null,
  name text not null check(length(name) between 1 and 160),
  category text not null check(category in ('hot_drinks','cold_drinks','food','snacks','other')),
  selling_price numeric(12,2) not null check(selling_price >= 0),
  cost_price numeric(12,2) not null default 0 check(cost_price >= 0),
  stock_quantity integer not null default 0 check(stock_quantity >= 0),
  min_stock_threshold integer not null default 0 check(min_stock_threshold >= 0),
  is_active boolean not null default true, updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists liverpool_inventory_branch_idx on public.liverpool_inventory(branch_id,is_active);
create index if not exists liverpool_inventory_updated_by_idx on public.liverpool_inventory(updated_by);
create table if not exists public.liverpool_sales (
  id uuid primary key default gen_random_uuid(), idempotency_key text not null unique check(length(idempotency_key) between 8 and 128),
  branch_id text not null, shift_id text not null, cashier_id uuid not null references auth.users(id),
  payment_method text not null check(payment_method in ('cash','instapay','vodafone','card')),
  total numeric(12,2) not null check(total >= 0), created_at timestamptz not null default now()
);
create index if not exists liverpool_sales_branch_created_idx on public.liverpool_sales(branch_id,created_at desc);
create index if not exists liverpool_sales_cashier_idx on public.liverpool_sales(cashier_id);
create table if not exists public.liverpool_sale_items (
  id bigint generated always as identity primary key, sale_id uuid not null references public.liverpool_sales(id) on delete cascade,
  inventory_id text not null references public.liverpool_inventory(id), item_name text not null,
  quantity integer not null check(quantity > 0), unit_price numeric(12,2) not null check(unit_price >= 0),
  unit_cost numeric(12,2) not null check(unit_cost >= 0), line_total numeric(12,2) not null check(line_total >= 0)
);
create index if not exists liverpool_sale_items_sale_idx on public.liverpool_sale_items(sale_id);
create index if not exists liverpool_sale_items_inventory_idx on public.liverpool_sale_items(inventory_id);
create table if not exists public.liverpool_inventory_movements (
  id bigint generated always as identity primary key, inventory_id text not null references public.liverpool_inventory(id),
  branch_id text not null, quantity_delta integer not null check(quantity_delta <> 0),
  reason text not null check(length(reason) between 1 and 200), reference_id uuid,
  performed_by uuid not null references auth.users(id), created_at timestamptz not null default now(), idempotency_key text
);
create unique index if not exists liverpool_inventory_movements_idempotency_idx on public.liverpool_inventory_movements(idempotency_key) where idempotency_key is not null;
create index if not exists liverpool_inventory_movements_inventory_idx on public.liverpool_inventory_movements(inventory_id);
create index if not exists liverpool_inventory_movements_performed_by_idx on public.liverpool_inventory_movements(performed_by);
create table if not exists public.liverpool_cash_transactions (
  id uuid primary key default gen_random_uuid(), idempotency_key text not null unique check(length(idempotency_key) between 8 and 128),
  branch_id text not null, shift_id text not null, sale_id uuid references public.liverpool_sales(id),
  type text not null check(type in ('sale','expense','advance','withdrawal','refund','opening_balance','adjustment','debt_collection')),
  payment_method text not null check(payment_method in ('cash','instapay','vodafone','card')),
  amount numeric(12,2) not null check(amount > 0), description text not null check(length(description) between 1 and 500),
  performed_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists liverpool_cash_branch_created_idx on public.liverpool_cash_transactions(branch_id,created_at desc);
create index if not exists liverpool_cash_performed_by_idx on public.liverpool_cash_transactions(performed_by);
create index if not exists liverpool_cash_sale_id_idx on public.liverpool_cash_transactions(sale_id);
create unique index if not exists liverpool_single_owner_idx on public.liverpool_app_members(role) where role='owner';
create index if not exists liverpool_inventory_movements_idempotency_idx2 on public.liverpool_inventory_movements(idempotency_key) where idempotency_key is not null;
alter table public.liverpool_inventory enable row level security;
alter table public.liverpool_sales enable row level security;
alter table public.liverpool_sale_items enable row level security;
alter table public.liverpool_inventory_movements enable row level security;
alter table public.liverpool_cash_transactions enable row level security;
revoke all on public.liverpool_inventory,public.liverpool_sales,public.liverpool_sale_items,public.liverpool_inventory_movements,public.liverpool_cash_transactions from anon,authenticated;
grant select,insert,update,delete on public.liverpool_inventory,public.liverpool_sales,public.liverpool_sale_items,public.liverpool_inventory_movements,public.liverpool_cash_transactions to service_role;
grant usage,select on all sequences in schema public to service_role;
commit;
