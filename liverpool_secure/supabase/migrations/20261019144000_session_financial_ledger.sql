begin;
create table if not exists public.liverpool_session_invoices (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  idempotency_key text not null unique,
  branch_id text not null,
  shift_id text not null,
  cashier_id uuid not null references auth.users(id),
  session_number text not null,
  customer_name text not null,
  customer_phone text,
  gaming_total numeric(12,2) not null check (gaming_total >= 0),
  products_total numeric(12,2) not null check (products_total >= 0),
  billable_products_total numeric(12,2) not null default 0 check (billable_products_total >= 0),
  discount_type text not null check (discount_type in ('none','fixed','percent')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  grand_total numeric(12,2) not null check (grand_total >= 0),
  prepaid_amount numeric(12,2) not null default 0 check (prepaid_amount >= 0),
  collected_amount numeric(12,2) not null default 0 check (collected_amount >= 0),
  remaining_debt numeric(12,2) not null default 0 check (remaining_debt >= 0),
  payment_method text not null check (payment_method in ('cash','instapay','vodafone','card','split')),
  split_payments jsonb not null default '[]'::jsonb check (jsonb_typeof(split_payments) = 'array'),
  session_snapshot jsonb not null check (jsonb_typeof(session_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists liverpool_session_invoices_branch_created_idx
  on public.liverpool_session_invoices (branch_id, created_at desc);
create index if not exists liverpool_session_invoices_debt_idx
  on public.liverpool_session_invoices (branch_id, remaining_debt desc) where remaining_debt > 0;

create table if not exists public.liverpool_session_debt_payments (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  invoice_id uuid not null references public.liverpool_session_invoices(id),
  session_id text not null,
  branch_id text not null,
  shift_id text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','instapay','vodafone','card')),
  received_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists liverpool_session_debt_payments_branch_created_idx
  on public.liverpool_session_debt_payments (branch_id, created_at desc);
create index if not exists liverpool_session_debt_payments_session_idx
  on public.liverpool_session_debt_payments (session_id, created_at);

alter table public.liverpool_session_invoices add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0);
alter table public.liverpool_session_invoices add column if not exists billable_products_total numeric(12,2) not null default 0 check (billable_products_total >= 0);

alter table public.liverpool_cash_transactions add column if not exists reference_type text;
alter table public.liverpool_cash_transactions add column if not exists reference_id text;
create index if not exists liverpool_cash_transactions_reference_idx
  on public.liverpool_cash_transactions (reference_type, reference_id) where reference_type is not null;

alter table public.liverpool_session_invoices enable row level security;
alter table public.liverpool_session_debt_payments enable row level security;
revoke all on public.liverpool_session_invoices from anon, authenticated;
revoke all on public.liverpool_session_debt_payments from anon, authenticated;
grant select, insert, update, delete on public.liverpool_session_invoices to service_role;
grant select, insert, update, delete on public.liverpool_session_debt_payments to service_role;
comment on table public.liverpool_session_invoices is 'Server-recorded final invoices for gaming sessions; invoice and cash entries commit together.';
comment on table public.liverpool_session_debt_payments is 'Append-only payment records against outstanding gaming session invoices.';
commit;