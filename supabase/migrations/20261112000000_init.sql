-- キャンプ場版サウナイキタイ 初期スキーマ（要件.md「DB設計の方向性」に対応）
-- 方針: 公式情報は campsites、現地で試した情報は checkins、結論は集計ビュー

-- ========== 列挙型 ==========
create type public.location_type as enum ('forest', 'river', 'lake', 'highland', 'sea');      -- 林間/河原/湖畔/高原/海
create type public.site_style    as enum ('auto', 'free', 'both');                            -- オート/フリー/両方
create type public.fire_rule     as enum ('open_fire_ok', 'stand_required', 'prohibited');    -- 直火可/焚き火台必須/禁止
create type public.camp_style    as enum ('solo', 'duo', 'family');
create type public.ground_type   as enum ('grass', 'soil', 'gravel', 'sand', 'wood_deck');    -- 芝/土/砂利/砂/ウッドデッキ
create type public.peg_needed    as enum ('plastic', 'steel', 'forged', 'rocky');             -- プラ/スチール/鍛造/石が多く場所を選ぶ
create type public.fire_status   as enum ('done', 'skipped_wind', 'prohibited');              -- できた/風で控えた/ルールで禁止
create type public.sleep_quality as enum ('comfortable', 'cold', 'sleepless');               -- 快適/寒かった/眠れなかった

-- ========== キャンプ場マスタ（運営が登録） ==========
create table public.campsites (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name          text not null,
  prefecture    text not null,
  address       text not null,
  lat           double precision,
  lng           double precision,
  location_type public.location_type not null,
  site_style    public.site_style not null,
  car_access    boolean not null default false,  -- サイトへの車乗り入れ可
  has_hot_water boolean not null default false,  -- 炊事場でお湯が出る
  has_shower    boolean not null default false,
  has_bath      boolean not null default false,
  fire_rule     public.fire_rule not null,
  official_url  text,
  created_at    timestamptz not null default now()
);
create index campsites_prefecture_idx on public.campsites (prefecture);

-- ========== ユーザー ==========
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'キャンパー' check (char_length(display_name) <= 40),
  avatar_url   text,
  camp_style   public.camp_style,
  created_at   timestamptz not null default now()
);

-- 新規登録時に Google のプロフィールから profiles を自動作成
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'キャンパー'), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== キャン活投稿（一番大事なデータ） ==========
create table public.checkins (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  campsite_id            uuid not null references public.campsites (id) on delete cascade,
  visited_on             date not null,
  -- 主役の体感3指標 ①気温と睡眠
  min_temp_c             numeric(4, 1) check (min_temp_c between -40 and 45),
  temp_measured          boolean not null default false,  -- true=温度計で実測 / false=体感
  temp_at_dawn           boolean not null default true,   -- 明け方の値か
  sleeping_bag_comfort_c smallint check (sleeping_bag_comfort_c between -40 and 30),
  sleep_quality          public.sleep_quality,
  -- ②地面とペグ
  ground_type            public.ground_type not null,
  peg_needed             public.peg_needed not null,
  -- ③焚き火
  fire_status            public.fire_status not null,
  -- 補助項目
  bug_level              smallint check (bug_level between 1 and 3),
  car_access_ok          boolean,
  hot_water_ok           boolean,
  comment                text check (char_length(comment) <= 500),
  created_at             timestamptz not null default now()
  -- 同じ人が同じキャンプ場に何度も行くのが前提なのでユニーク制約は付けない
);
create index checkins_campsite_visited_idx on public.checkins (campsite_id, visited_on desc);
create index checkins_user_idx on public.checkins (user_id, visited_on desc);

create table public.checkin_photos (
  id           uuid primary key default gen_random_uuid(),
  checkin_id   uuid not null references public.checkins (id) on delete cascade,
  storage_path text not null,
  sort_order   smallint not null default 0 check (sort_order between 0 and 3),
  created_at   timestamptz not null default now()
);
create index checkin_photos_checkin_idx on public.checkin_photos (checkin_id, sort_order);

-- ========== 集計ビュー ==========
-- キャンプ場 × 月
create view public.campsite_monthly_stats
with (security_invoker = true) as
select
  campsite_id,
  extract(month from visited_on)::int                                   as month,
  count(*)::int                                                         as checkin_count,
  round(avg(min_temp_c), 1)                                             as avg_min_temp,
  mode() within group (order by ground_type)                            as mode_ground,
  mode() within group (order by peg_needed)                             as mode_peg_needed,
  round(avg((fire_status = 'skipped_wind')::int), 2)                    as fire_skipped_wind_rate,
  round(avg(bug_level), 1)                                              as avg_bug,
  round(avg(hot_water_ok::int), 2)                                      as hot_water_rate
from public.checkins
group by campsite_id, extract(month from visited_on);

-- キャンプ場 × 月 × 寝袋の快適温度帯（5℃刻み）ごとの「眠れた割合」
-- 要件.md の sleep_ok_rate_by_bag は次元が1つ多いため別ビューに分けている
create view public.campsite_sleep_stats
with (security_invoker = true) as
select
  campsite_id,
  extract(month from visited_on)::int                                   as month,
  (floor(sleeping_bag_comfort_c / 5.0) * 5)::int                        as bag_band_c,
  count(*)::int                                                         as checkin_count,
  round(avg((sleep_quality = 'comfortable')::int), 2)                   as sleep_ok_rate
from public.checkins
where sleeping_bag_comfort_c is not null and sleep_quality is not null
group by campsite_id, extract(month from visited_on), floor(sleeping_bag_comfort_c / 5.0);

-- ========== アクセス制御（RLS） ==========
alter table public.campsites      enable row level security;
alter table public.profiles       enable row level security;
alter table public.checkins       enable row level security;
alter table public.checkin_photos enable row level security;

grant select on public.campsites, public.profiles, public.checkins, public.checkin_photos,
                public.campsite_monthly_stats, public.campsite_sleep_stats
  to anon, authenticated;
grant insert, update, delete on public.checkins, public.checkin_photos to authenticated;
grant update on public.profiles to authenticated;

-- 閲覧は全員可。campsites の書き込みはダッシュボード（service role）からのみ
create policy "campsites are public" on public.campsites for select using (true);

create policy "profiles are public" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "checkins are public" on public.checkins for select using (true);
create policy "users insert own checkins" on public.checkins for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own checkins" on public.checkins for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users delete own checkins" on public.checkins for delete
  to authenticated using ((select auth.uid()) = user_id);

create policy "photos are public" on public.checkin_photos for select using (true);
create policy "users manage photos of own checkins" on public.checkin_photos for all
  to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = (select auth.uid())));

-- ========== 写真の保存先（Storage） ==========
-- パスは「<user_id>/<checkin_id>/<ファイル名>」とし、自分のフォルダにだけ書き込める
insert into storage.buckets (id, name, public)
values ('checkin-photos', 'checkin-photos', true)
on conflict (id) do nothing;

create policy "users upload to own folder" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete own files" on storage.objects for delete
  to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
