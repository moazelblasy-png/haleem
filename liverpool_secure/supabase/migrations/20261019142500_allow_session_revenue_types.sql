begin;
alter table public.liverpool_cash_transactions
  drop constraint if exists liverpool_cash_transactions_type_check;
alter table public.liverpool_cash_transactions
  add constraint liverpool_cash_transactions_type_check
  check (type in (
    'sale','gaming_revenue','bar_revenue','expense','advance','withdrawal',
    'refund','opening_balance','adjustment','debt_collection'
  ));
commit;
