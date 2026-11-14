-- キャンプ場の画像（運営が登録する紹介写真）
-- 出どころは2つだけ：
--   own     … 運営が自分で撮った写真（Storage の campsite-images に保存）
--   checkin … 投稿者が許可したキャン活の写真を採用したもの（元のファイルをそのまま参照し、コピーしない）
-- 並び順が一番小さいものがカバー写真。写真が1枚もなければ、画面ではキャンプ場の種類の色を出す

-- ========== 運営 ==========
-- この表に行があるユーザーだけが運営。行の追加は Supabase のダッシュボード（Table Editor）からのみ
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- ポリシーを作らないので、アプリ（anon / authenticated）からは読み書きできない

-- ログイン中のユーザーが運営かどうか（RLS とアプリの両方で使う）
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ========== 写真の採用の許可（投稿ごと） ==========
alter table public.checkins add column photo_reuse_ok boolean not null default false;

-- ========== キャンプ場の画像 ==========
create type public.campsite_image_source as enum ('own', 'checkin');

create table public.campsite_images (
  id               uuid primary key default gen_random_uuid(),
  campsite_id      uuid not null references public.campsites (id) on delete cascade,
  source           public.campsite_image_source not null,
  -- own のとき：campsite-images バケット内のパス
  storage_path     text,
  -- checkin のとき：採用元の写真。投稿や写真が消えたら、この行も自動で消える（＝デフォルトの写真に戻る）
  checkin_photo_id uuid unique references public.checkin_photos (id) on delete cascade,
  -- 撮影者の表示（own のとき。checkin のときは投稿者のニックネームを表示する）
  credit           text check (char_length(credit) <= 40),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  check (
    (source = 'own' and storage_path is not null and checkin_photo_id is null)
    or (source = 'checkin' and checkin_photo_id is not null and storage_path is null)
  )
);
create index campsite_images_campsite_idx on public.campsite_images (campsite_id, sort_order);

-- 投稿者が許可を外したら、その投稿から採用した写真を外す（デフォルトの写真に戻す）
create function public.drop_unapproved_campsite_images()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.campsite_images ci
  using public.checkin_photos p
  where ci.checkin_photo_id = p.id and p.checkin_id = new.id;
  return new;
end;
$$;

create trigger on_checkin_photo_reuse_revoked
  after update of photo_reuse_ok on public.checkins
  for each row
  when (old.photo_reuse_ok and not new.photo_reuse_ok)
  execute function public.drop_unapproved_campsite_images();

-- ========== アクセス制御 ==========
alter table public.campsite_images enable row level security;
grant select on public.campsite_images to anon, authenticated;
grant insert, update, delete on public.campsite_images to authenticated;

create policy "campsite images are public" on public.campsite_images for select using (true);

-- 運営だけが登録できる。キャン活の写真は「許可あり」かつ「同じキャンプ場の投稿」のものだけ
create policy "admins insert campsite images" on public.campsite_images for insert
  to authenticated
  with check (
    (select public.is_admin())
    and (
      source = 'own'
      or exists (
        select 1
        from public.checkin_photos p
        join public.checkins c on c.id = p.checkin_id
        where p.id = checkin_photo_id
          and c.photo_reuse_ok
          and c.campsite_id = campsite_images.campsite_id
      )
    )
  );
create policy "admins update campsite images" on public.campsite_images for update
  to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete campsite images" on public.campsite_images for delete
  to authenticated using ((select public.is_admin()));

-- ========== 画像の保存先（Storage） ==========
-- 誰でも見られる。書き込み・削除は運営だけ。パスは「<campsite_id>/<uuid>.jpg」
insert into storage.buckets (id, name, public)
values ('campsite-images', 'campsite-images', true)
on conflict (id) do nothing;

create policy "admins upload campsite images" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'campsite-images' and (select public.is_admin()));
create policy "admins read campsite image objects" on storage.objects for select
  to authenticated
  using (bucket_id = 'campsite-images' and (select public.is_admin()));
create policy "admins delete campsite images" on storage.objects for delete
  to authenticated
  using (bucket_id = 'campsite-images' and (select public.is_admin()));
