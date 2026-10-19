begin;

-- Add an optional assignment for existing Auth members. Do not auto-assign staff:
-- branch ids are owned by app state (lg_branches), so the owner must verify each assignment.
alter table public.liverpool_app_members
  add column if not exists branch_id text;

-- The client has a technician role; allow it in the server-side membership table too.
alter table public.liverpool_app_members
  drop constraint if exists liverpool_app_members_role_check;

alter table public.liverpool_app_members
  add constraint liverpool_app_members_role_check
  check (role in ('owner', 'admin', 'supervisor', 'cashier', 'technician'));

alter table public.liverpool_app_members
  drop constraint if exists liverpool_app_members_branch_id_check;

alter table public.liverpool_app_members
  add constraint liverpool_app_members_branch_id_check
  check (branch_id is null or branch_id ~ '^[a-z0-9][a-z0-9_-]{0,79}$');

create index if not exists liverpool_app_members_branch_scope_idx
  on public.liverpool_app_members (branch_id, role)
  where is_active = true;

comment on column public.liverpool_app_members.branch_id is
  'Single operational branch assignment for non-management members; NULL staff assignments are denied branch access.';

commit;
