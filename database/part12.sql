-- PART 12: pembelian produk dengan saldo virtual.
-- Jalankan SEKALI di Supabase SQL Editor setelah PART 11.
-- Seluruh potongan saldo, transaksi, ledger, dan jumlah terjual diproses atomik.

-- Referensi produk dan kunci idempotensi untuk mencegah pembelian dobel saat request diulang.
alter table public.transactions
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists idempotency_key uuid;

create unique index if not exists transactions_purchase_idempotency_uidx
  on public.transactions (user_id, idempotency_key)
  where type = 'PURCHASE' and idempotency_key is not null;

comment on column public.transactions.product_id is
  'Produk yang dibeli; menjadi NULL jika produk dihapus, histori keuangan tetap dipertahankan.';
comment on column public.transactions.idempotency_key is
  'Kunci request pembelian dari browser untuk mencegah pemotongan saldo ganda ketika request diulang.';

-- Hanya backend dengan service_role yang boleh memanggil RPC ini.
create or replace function public.purchase_product(
  p_user_id uuid,
  p_product_id uuid,
  p_request_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_active boolean;
  v_product record;
  v_existing record;
  v_balance_before bigint;
  v_balance_after bigint;
  v_tx uuid;
  v_code text;
  v_description text;
begin
  if p_user_id is null or p_product_id is null or p_request_key is null then
    raise exception 'INVALID_REQUEST_KEY';
  end if;

  -- Serialisasi request dengan kunci yang sama untuk user yang sama.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_request_key::text, 0));

  select is_active into v_user_active
    from public.users
   where id = p_user_id
   for update;
  if not found or v_user_active is distinct from true then
    raise exception 'USER_NOT_FOUND';
  end if;

  -- Retry dengan kunci sama mengembalikan transaksi awal, bukan memotong saldo lagi.
  select id, product_id, transaction_code, amount, description
    into v_existing
    from public.transactions
   where user_id = p_user_id
     and type = 'PURCHASE'
     and idempotency_key = p_request_key
   limit 1;
  if found then
    if v_existing.product_id is distinct from p_product_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    select balance into v_balance_after
      from public.wallets
     where user_id = p_user_id;
    if not found then
      raise exception 'WALLET_NOT_FOUND';
    end if;
    return jsonb_build_object(
      'transaction_id', v_existing.id,
      'transaction_code', v_existing.transaction_code,
      'amount', v_existing.amount,
      'description', v_existing.description,
      'balance_after', v_balance_after,
      'already_processed', true
    );
  end if;

  -- Kunci produk dan dompet agar harga/status dan saldo tidak berubah di tengah checkout.
  select id, name, price into v_product
    from public.products
   where id = p_product_id and is_active = true
   for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select balance into v_balance_before
    from public.wallets
   where user_id = p_user_id
   for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if v_balance_before < v_product.price then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update public.wallets
     set balance = balance - v_product.price
   where user_id = p_user_id
   returning balance into v_balance_after;

  v_description := 'Pembelian produk: ' || v_product.name;
  insert into public.transactions (
    user_id, type, amount, description, product_id, idempotency_key
  ) values (
    p_user_id, 'PURCHASE', v_product.price, v_description, v_product.id, p_request_key
  ) returning id, transaction_code into v_tx, v_code;

  insert into public.wallet_ledger (
    user_id, transaction_id, direction, amount, balance_before, balance_after
  ) values (
    p_user_id, v_tx, 'DEBIT', v_product.price, v_balance_before, v_balance_after
  );

  update public.products
     set sold_count = sold_count + 1
   where id = v_product.id;

  return jsonb_build_object(
    'transaction_id', v_tx,
    'transaction_code', v_code,
    'amount', v_product.price,
    'description', v_description,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'already_processed', false
  );
end;
$$;

revoke all on function public.purchase_product(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.purchase_product(uuid, uuid, uuid) to service_role;
