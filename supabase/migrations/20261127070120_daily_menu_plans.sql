create table public.daily_menu_plans (
 tanggal date primary key,
 menu_items text[] not null check (cardinality(menu_items) between 1 and 8),
 updated_at timestamptz not null default now()
);
alter table public.daily_menu_plans enable row level security;
revoke all on table public.daily_menu_plans from public, anon, authenticated;
grant select, insert, update on table public.daily_menu_plans to service_role;
comment on table public.daily_menu_plans is 'Rencana menu per tanggal, terpisah dari snapshot dokumen yang telah terbit.';
