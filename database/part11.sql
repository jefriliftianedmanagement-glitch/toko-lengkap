-- PART 11: moderasi akun, penghapusan riwayat secara aman, dan audit.
-- Jalankan SEKALI di Supabase SQL Editor setelah PART 10.
-- Transaksi dan wallet_ledger tidak dihapus: keduanya adalah jejak keuangan.

-- 1) Penghapusan akun permanen: hapus identitas, pertahankan jejak keuangan anonim.
-- Wallet dan inbox ikut terhapus; top-up request dilepas dari user.
alter table public.wallets drop constraint if exists wallets_user_id_fkey;
alter table public.wallets
  add constraint wallets_user_id_fkey foreign key (user_id)
  references public.users(id) on delete cascade;

alter table public.topup_requests alter column user_id drop not null;
alter table public.topup_requests drop constraint if exists topup_requests_user_id_fkey;
alter table public.topup_requests
  add constraint topup_requests_user_id_fkey foreign key (user_id)
  references public.users(id) on delete set null;

-- Lepas FK transaksi/ledger ke users agar UUID pseudonim dan nilai historis
-- tetap ada setelah identitas user dihapus. Baris ledger tetap append-only.
alter table public.transactions drop constraint if exists transactions_user_id_fkey;
alter table public.wallet_ledger drop constraint if exists wallet_ledger_user_id_fkey;

comment on column public.transactions.user_id is
  'UUID user saat transaksi dibuat; FK dilepas pada PART 11 agar histori tetap anonim setelah akun dihapus.';
comment on column public.wallet_ledger.user_id is
  'UUID user saat ledger dibuat; FK dilepas pada PART 11 agar ledger append-only tetap utuh setelah akun dihapus.';

-- 2) Soft-delete transaksi: user menyembunyikan dari riwayat sendiri;
-- admin menghapus dari tampilan admin dan semua riwayat user.
alter table public.transactions
  add column if not exists user_hidden_at timestamptz,
  add column if not exists admin_deleted_at timestamptz,
  add column if not exists admin_deleted_by uuid references public.admins(id) on delete set null;

create index if not exists tx_visible_user_idx
  on public.transactions (user_id, created_at desc)
  where user_hidden_at is null and admin_deleted_at is null;
create index if not exists tx_admin_visible_idx
  on public.transactions (created_at desc)
  where admin_deleted_at is null;

-- 3) Soft-delete pesan inbox agar operasi klaim saldo tetap aman.
alter table public.user_inbox
  add column if not exists hidden_at timestamptz;
create index if not exists inbox_visible_user_idx
  on public.user_inbox (user_id, created_at desc)
  where hidden_at is null;

-- 4) RPC hapus akun. Hanya service_role backend yang dapat menjalankannya.
create or replace function public.admin_delete_user(p_admin_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id bigint;
  v_cancelled_topups integer := 0;
begin
  if not exists (select 1 from public.admins where id = p_admin_id and is_active = true) then
    raise exception 'ADMIN_NOT_FOUND';
  end if;

  select account_id into v_account_id
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  -- Tutup permintaan yang belum menghasilkan saldo agar tidak tersisa
  -- sebagai antrean top-up tanpa pemilik setelah akun dihapus.
  update public.topup_requests
  set status = 'CANCELLED', processed_by = p_admin_id, processed_at = now()
  where user_id = p_user_id and status in ('PENDING', 'APPROVED');
  get diagnostics v_cancelled_topups = row_count;

  insert into public.admin_audit_log (admin_id, action, target_user_id, target_id, details)
  values (p_admin_id, 'USER_PERMANENT_DELETE', p_user_id, v_account_id::text,
          jsonb_build_object('retained_financial_history', true,
                             'cancelled_unclaimed_topups', v_cancelled_topups));

  delete from public.users where id = p_user_id;

  return jsonb_build_object('deleted', true, 'account_id', v_account_id,
                            'cancelled_unclaimed_topups', v_cancelled_topups,
                            'financial_history_retained', true);
end;
$$;

-- 5) RPC sembunyikan inbox dengan lock. Pesan top-up approved yang belum diklaim
-- tidak boleh disembunyikan supaya user tidak kehilangan akses klaim.
create or replace function public.hide_user_inbox_message(p_user_id uuid, p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_claimed_at timestamptz;
begin
  select type, claimed_at into v_type, v_claimed_at
  from public.user_inbox
  where id = p_message_id and user_id = p_user_id and hidden_at is null
  for update;

  if not found then
    raise exception 'MESSAGE_NOT_FOUND';
  end if;

  if v_type = 'TOPUP_APPROVED' and v_claimed_at is null then
    raise exception 'MESSAGE_CLAIM_REQUIRED';
  end if;

  update public.user_inbox set hidden_at = now()
  where id = p_message_id and user_id = p_user_id;

  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.admin_delete_user(uuid, uuid) from public, anon, authenticated;
revoke all on function public.hide_user_inbox_message(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_user(uuid, uuid) to service_role;
grant execute on function public.hide_user_inbox_message(uuid, uuid) to service_role;
