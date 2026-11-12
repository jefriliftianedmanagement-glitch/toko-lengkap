-- =====================================================================
-- FAKE ONLINE SHOP PWA - DATABASE SCHEMA (PART 1)
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Aman dijalankan pada project baru yang masih kosong.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. HELPER: auto update kolom updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. TABEL
-- ---------------------------------------------------------------------

-- 1.1 users (username disimpan TANPA '@', tampilkan '@' di frontend)
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  account_id    bigint not null unique
                check (account_id between 1000000000 and 9999999999), -- 10 digit
  username      text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  password_hash text not null,
  avatar_url    text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index users_username_lower_uidx on public.users (lower(username));

create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

-- account_id TIDAK BOLEH berubah setelah dibuat
create or replace function public.block_account_id_change()
returns trigger language plpgsql as $$
begin
  if new.account_id is distinct from old.account_id then
    raise exception 'ACCOUNT_ID_IMMUTABLE';
  end if;
  return new;
end $$;

create trigger trg_users_account_id_immutable before update on public.users
  for each row execute function public.block_account_id_change();

-- 1.2 admins (terpisah dari users)
create table public.admins (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  password_hash text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_admins_updated before update on public.admins
  for each row execute function public.set_updated_at();

-- 1.3 wallets (1 user = 1 wallet, saldo tidak boleh negatif)
create table public.wallets (
  user_id    uuid primary key references public.users(id) on delete restrict,
  balance    bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_wallets_updated before update on public.wallets
  for each row execute function public.set_updated_at();

-- 1.4 products
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 150),
  description text not null default '',
  price       bigint not null check (price > 0),
  category    text not null default 'Umum',
  image_path  text,                       -- path di bucket product-images
  is_active   boolean not null default true,
  sold_count  integer not null default 0 check (sold_count >= 0),
  created_by  uuid references public.admins(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index products_active_created_idx on public.products (is_active, created_at desc);
create index products_category_idx       on public.products (category);
create index products_price_idx          on public.products (price);
create index products_sold_idx           on public.products (sold_count desc);
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- 1.5 topup_requests
-- Status: PENDING -> APPROVED -> CLAIMED | PENDING -> REJECTED | PENDING -> CANCELLED
-- Batas atas 1 triliun adalah batas TEKNIS (cegah overflow), bukan batas bisnis.
create table public.topup_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete restrict,
  amount       bigint not null check (amount > 0 and amount <= 1000000000000),
  status       text not null default 'PENDING'
               check (status in ('PENDING','APPROVED','REJECTED','CLAIMED','CANCELLED')),
  processed_by uuid references public.admins(id) on delete set null,
  processed_at timestamptz,
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index topup_status_created_idx on public.topup_requests (status, created_at desc);
create index topup_user_created_idx   on public.topup_requests (user_id, created_at desc);
create trigger trg_topup_updated before update on public.topup_requests
  for each row execute function public.set_updated_at();

-- 1.6 user_inbox
create table public.user_inbox (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  topup_request_id uuid references public.topup_requests(id) on delete set null,
  type             text not null
                   check (type in ('WELCOME','TOPUP_APPROVED','TOPUP_REJECTED','BALANCE_RECEIVED','SYSTEM')),
  title            text not null,
  body             text not null,
  is_read          boolean not null default false,
  claimed_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index inbox_user_idx on public.user_inbox (user_id, is_read, created_at desc);

-- 1.7 transactions
create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  transaction_code text not null unique
                   default ('TRX-' || to_char(now() at time zone 'utc','YYYYMMDD') || '-' ||
                            upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  user_id          uuid not null references public.users(id) on delete restrict,
  type             text not null check (type in ('TOPUP_CLAIM','ADMIN_SEND_BALANCE','PURCHASE')),
  amount           bigint not null check (amount > 0),
  status           text not null default 'SUCCESS' check (status in ('SUCCESS','FAILED')),
  description      text not null default '',
  admin_id         uuid references public.admins(id) on delete set null,
  topup_request_id uuid references public.topup_requests(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index tx_user_created_idx on public.transactions (user_id, created_at desc);
create index tx_created_idx      on public.transactions (created_at desc);

-- 1.8 wallet_ledger (append-only: tidak boleh di-UPDATE / DELETE)
create table public.wallet_ledger (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.users(id) on delete restrict,
  transaction_id uuid not null references public.transactions(id) on delete restrict,
  direction      text not null check (direction in ('CREDIT','DEBIT')),
  amount         bigint not null check (amount > 0),
  balance_before bigint not null check (balance_before >= 0),
  balance_after  bigint not null check (balance_after >= 0),
  created_at     timestamptz not null default now(),
  check (
    (direction = 'CREDIT' and balance_after = balance_before + amount) or
    (direction = 'DEBIT'  and balance_after = balance_before - amount)
  )
);
create index ledger_user_idx on public.wallet_ledger (user_id, id desc);

create or replace function public.block_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'LEDGER_IS_APPEND_ONLY';
end $$;

create trigger trg_ledger_no_update before update or delete on public.wallet_ledger
  for each row execute function public.block_ledger_mutation();

-- 1.9 admin_audit_log
create table public.admin_audit_log (
  id             bigint generated always as identity primary key,
  admin_id       uuid references public.admins(id) on delete set null,
  action         text not null,
  target_user_id uuid references public.users(id) on delete set null,
  target_id      text,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index audit_created_idx on public.admin_audit_log (created_at desc);

-- ---------------------------------------------------------------------
-- 2. FUNGSI RPC (semua atomic dalam 1 transaksi database)
--    Hanya service_role (backend Express) yang boleh memanggilnya.
--    Setiap fungsi melempar exception berkode, mis. 'USER_NOT_FOUND'.
-- ---------------------------------------------------------------------

-- 2.1 Registrasi: buat user + wallet + generator ID 10 digit unik
create or replace function public.register_user(p_username text, p_password_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_acc bigint;
  v_id  uuid;
  v_try int := 0;
begin
  loop
    v_try := v_try + 1;
    v_acc := 1000000000 + floor(random() * 9000000000)::bigint;
    begin
      insert into public.users (account_id, username, password_hash)
      values (v_acc, p_username, p_password_hash)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if exists (select 1 from public.users u where lower(u.username) = lower(p_username)) then
        raise exception 'USERNAME_TAKEN';
      end if;
      if v_try >= 20 then
        raise exception 'ID_GENERATION_FAILED';
      end if;
      -- bentrok account_id -> ulangi dengan ID baru
    end;
  end loop;

  insert into public.wallets (user_id) values (v_id);

  insert into public.user_inbox (user_id, type, title, body)
  values (v_id, 'WELCOME', 'Selamat datang!',
          'Akun Anda berhasil dibuat. Ini adalah toko simulasi dengan saldo virtual.');

  return jsonb_build_object('user_id', v_id, 'account_id', v_acc, 'username', p_username);
end $$;

-- 2.2 User mengajukan top-up (saldo TIDAK berubah)
create or replace function public.create_topup_request(p_user_id uuid, p_amount bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000000 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if not exists (select 1 from public.users where id = p_user_id and is_active) then
    raise exception 'USER_NOT_FOUND';
  end if;

  insert into public.topup_requests (user_id, amount)
  values (p_user_id, p_amount)
  returning id into v_id;

  return jsonb_build_object('request_id', v_id, 'status', 'PENDING', 'amount', p_amount);
end $$;

-- 2.3 User membatalkan request (hanya jika masih PENDING)
create or replace function public.cancel_topup_request(p_user_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.topup_requests
     set status = 'CANCELLED'
   where id = p_request_id and user_id = p_user_id and status = 'PENDING';
  if not found then
    raise exception 'REQUEST_NOT_CANCELLABLE';
  end if;
  return jsonb_build_object('request_id', p_request_id, 'status', 'CANCELLED');
end $$;

-- 2.4 Admin APPROVE (saldo BELUM bertambah, user harus CLAIM)
create or replace function public.admin_approve_topup(p_admin_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_amount bigint;
begin
  if not exists (select 1 from public.admins where id = p_admin_id and is_active) then
    raise exception 'ADMIN_NOT_FOUND';
  end if;

  update public.topup_requests
     set status = 'APPROVED', processed_by = p_admin_id, processed_at = now()
   where id = p_request_id and status = 'PENDING'
   returning user_id, amount into v_user, v_amount;
  if not found then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  insert into public.user_inbox (user_id, topup_request_id, type, title, body)
  values (v_user, p_request_id, 'TOPUP_APPROVED', 'TOP-UP BERHASIL DISETUJUI!',
          'Permintaan top-up sebesar Rp' ||
          replace(to_char(v_amount, 'FM999,999,999,999,999'), ',', '.') ||
          ' telah disetujui oleh administrator. Silakan klaim saldo Anda untuk memasukkan dana virtual ke akun.');

  insert into public.admin_audit_log (admin_id, action, target_user_id, target_id, details)
  values (p_admin_id, 'APPROVE_TOPUP', v_user, p_request_id::text,
          jsonb_build_object('amount', v_amount));

  return jsonb_build_object('request_id', p_request_id, 'status', 'APPROVED');
end $$;

-- 2.5 Admin REJECT
create or replace function public.admin_reject_topup(p_admin_id uuid, p_request_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_amount bigint;
begin
  if not exists (select 1 from public.admins where id = p_admin_id and is_active) then
    raise exception 'ADMIN_NOT_FOUND';
  end if;

  update public.topup_requests
     set status = 'REJECTED', processed_by = p_admin_id, processed_at = now()
   where id = p_request_id and status = 'PENDING'
   returning user_id, amount into v_user, v_amount;
  if not found then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  insert into public.user_inbox (user_id, topup_request_id, type, title, body)
  values (v_user, p_request_id, 'TOPUP_REJECTED', 'Top-up ditolak',
          'Permintaan top-up sebesar Rp' ||
          replace(to_char(v_amount, 'FM999,999,999,999,999'), ',', '.') ||
          ' ditolak oleh administrator.' ||
          coalesce(' Alasan: ' || nullif(trim(p_reason), ''), ''));

  insert into public.admin_audit_log (admin_id, action, target_user_id, target_id, details)
  values (p_admin_id, 'REJECT_TOPUP', v_user, p_request_id::text,
          jsonb_build_object('amount', v_amount, 'reason', p_reason));

  return jsonb_build_object('request_id', p_request_id, 'status', 'REJECTED');
end $$;

-- 2.6 User CLAIM BALANCE (anti double-claim lewat UPDATE bersyarat status)
create or replace function public.claim_topup(p_user_id uuid, p_inbox_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_req    uuid;
  v_amount bigint;
  v_before bigint;
  v_after  bigint;
  v_tx     uuid;
  v_code   text;
begin
  -- 1. pesan harus milik user ini dan bertipe TOPUP_APPROVED
  select topup_request_id into v_req
    from public.user_inbox
   where id = p_inbox_id and user_id = p_user_id and type = 'TOPUP_APPROVED';
  if not found or v_req is null then
    raise exception 'MESSAGE_NOT_FOUND';
  end if;

  -- 2. atomic: hanya 1 pemanggil yang berhasil mengubah APPROVED -> CLAIMED
  update public.topup_requests
     set status = 'CLAIMED', claimed_at = now()
   where id = v_req and user_id = p_user_id and status = 'APPROVED'
   returning amount into v_amount;
  if not found then
    raise exception 'ALREADY_CLAIMED_OR_INVALID';
  end if;

  -- 3. tambah saldo (nominal dari DATABASE, bukan dari frontend)
  update public.wallets
     set balance = balance + v_amount
   where user_id = p_user_id
   returning balance into v_after;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;
  v_before := v_after - v_amount;

  -- 4. catat transaksi + ledger
  insert into public.transactions (user_id, type, amount, description, topup_request_id)
  values (p_user_id, 'TOPUP_CLAIM', v_amount, 'Klaim top-up yang disetujui admin', v_req)
  returning id, transaction_code into v_tx, v_code;

  insert into public.wallet_ledger (user_id, transaction_id, direction, amount, balance_before, balance_after)
  values (p_user_id, v_tx, 'CREDIT', v_amount, v_before, v_after);

  -- 5. tandai pesan sudah diklaim
  update public.user_inbox set claimed_at = now(), is_read = true where id = p_inbox_id;

  return jsonb_build_object('transaction_code', v_code, 'amount', v_amount,
                            'balance_before', v_before, 'balance_after', v_after);
end $$;

-- 2.7 Admin SEND BALANCE (berdasarkan account_id 10 digit)
create or replace function public.admin_send_balance(
  p_admin_id          uuid,
  p_target_account_id bigint,
  p_amount            bigint,
  p_note              text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid;
  v_uname  text;
  v_before bigint;
  v_after  bigint;
  v_tx     uuid;
  v_code   text;
begin
  if not exists (select 1 from public.admins where id = p_admin_id and is_active) then
    raise exception 'ADMIN_NOT_FOUND';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000000 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select id, username into v_user, v_uname
    from public.users
   where account_id = p_target_account_id and is_active;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  update public.wallets
     set balance = balance + p_amount
   where user_id = v_user
   returning balance into v_after;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;
  v_before := v_after - p_amount;

  insert into public.transactions (user_id, type, amount, description, admin_id)
  values (v_user, 'ADMIN_SEND_BALANCE', p_amount,
          coalesce(nullif(trim(p_note), ''), 'Saldo dikirim oleh administrator'), p_admin_id)
  returning id, transaction_code into v_tx, v_code;

  insert into public.wallet_ledger (user_id, transaction_id, direction, amount, balance_before, balance_after)
  values (v_user, v_tx, 'CREDIT', p_amount, v_before, v_after);

  insert into public.user_inbox (user_id, type, title, body)
  values (v_user, 'BALANCE_RECEIVED', 'Anda menerima saldo',
          'Administrator mengirim saldo sebesar Rp' ||
          replace(to_char(p_amount, 'FM999,999,999,999,999'), ',', '.') ||
          ' ke akun Anda. Ref: ' || v_code);

  insert into public.admin_audit_log (admin_id, action, target_user_id, target_id, details)
  values (p_admin_id, 'SEND_BALANCE', v_user, v_code,
          jsonb_build_object('amount', p_amount, 'account_id', p_target_account_id, 'note', p_note));

  return jsonb_build_object('transaction_code', v_code, 'username', v_uname,
                            'account_id', p_target_account_id, 'amount', p_amount,
                            'balance_before', v_before, 'balance_after', v_after);
end $$;

-- ---------------------------------------------------------------------
-- 3. KEAMANAN: RLS aktif, TANPA policy untuk anon/authenticated.
--    Artinya key publik (anon) tidak bisa membaca/menulis apa pun.
--    Hanya backend dengan service_role key (bypass RLS) yang bisa akses.
-- ---------------------------------------------------------------------
alter table public.users           enable row level security;
alter table public.admins          enable row level security;
alter table public.wallets         enable row level security;
alter table public.products        enable row level security;
alter table public.topup_requests  enable row level security;
alter table public.user_inbox      enable row level security;
alter table public.transactions    enable row level security;
alter table public.wallet_ledger   enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.register_user(text, text)               to service_role;
grant execute on function public.create_topup_request(uuid, bigint)      to service_role;
grant execute on function public.cancel_topup_request(uuid, uuid)        to service_role;
grant execute on function public.admin_approve_topup(uuid, uuid)         to service_role;
grant execute on function public.admin_reject_topup(uuid, uuid, text)    to service_role;
grant execute on function public.claim_topup(uuid, uuid)                 to service_role;
grant execute on function public.admin_send_balance(uuid, bigint, bigint, text) to service_role;

-- ---------------------------------------------------------------------
-- 4. STORAGE: bucket gambar produk (publik untuk dibaca, tulis hanya via backend)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
