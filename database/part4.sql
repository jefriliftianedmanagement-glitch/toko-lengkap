-- =====================================================================
-- PART 4 - tambahan database: statistik dashboard admin
-- Jalankan SEKALI di Supabase SQL Editor (setelah schema.sql).
-- Aman dijalankan ulang.
-- =====================================================================
create or replace function public.admin_dashboard_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_users',     (select count(*) from public.users),
    'total_products',  (select count(*) from public.products),
    'active_products', (select count(*) from public.products where is_active),
    'total_topups',    (select count(*) from public.topup_requests),
    'pending_topups',  (select count(*) from public.topup_requests where status = 'PENDING'),
    'total_balance',   (select coalesce(sum(balance), 0) from public.wallets)
  );
$$;

-- Hanya backend (service_role) yang boleh memanggil
revoke execute on function public.admin_dashboard_stats() from public, anon, authenticated;
grant  execute on function public.admin_dashboard_stats() to service_role;
