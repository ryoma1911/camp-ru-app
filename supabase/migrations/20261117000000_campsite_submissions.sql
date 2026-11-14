-- ユーザーからのキャンプ場の登録申請
-- ・ユーザーは申請を作れるだけ（自分の申請も読めない。結果は今後の通知機能で「公開」のときだけ知らせる）
-- ・読み書きできるのは運営だけ。承認すると campsites に行を追加する
-- ・申請者（user_id）と公開したキャンプ場（campsite_id）を残し、通知機能で使えるようにする

create type public.submission_status as enum ('pending', 'approved', 'rejected');  -- 確認待ち/公開/見送り
create type public.submission_reject_reason as enum ('duplicate', 'not_campsite', 'insufficient');  -- 登録済み/キャンプ場ではない/情報が足りない

create table public.campsite_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  status        public.submission_status not null default 'pending',
  -- 申請者の入力（任意の項目は null =「わからない」）
  name          text not null check (char_length(name) between 1 and 80),
  prefecture    text not null check (char_length(prefecture) between 2 and 4),
  address       text not null check (char_length(address) between 1 and 200),
  official_url  text check (official_url ~ '^https?://' and char_length(official_url) <= 500),
  location_type public.location_type,
  site_style    public.site_style,
  fire_rule     public.fire_rule,
  car_access    boolean,
  has_hot_water boolean,
  has_shower    boolean,
  has_bath      boolean,
  note          text check (char_length(note) <= 500),
  -- 運営が記録する項目
  reject_reason public.submission_reject_reason,
  admin_note    text check (char_length(admin_note) <= 500),
  campsite_id   uuid references public.campsites (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index campsite_submissions_status_idx on public.campsite_submissions (status, created_at desc);
create index campsite_submissions_user_idx on public.campsite_submissions (user_id, status);

-- 確認待ちの申請は1人5件まで（ユーザーは自分の申請を読めないので、件数はこの関数で数える）
create function public.check_submission_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.campsite_submissions
      where user_id = new.user_id and status = 'pending') >= 5 then
    raise exception 'too many pending submissions' using errcode = 'P0001', hint = 'submission_limit';
  end if;
  return new;
end;
$$;

create trigger before_campsite_submission_insert
  before insert on public.campsite_submissions
  for each row execute function public.check_submission_limit();

-- ログイン中のユーザーの確認待ちの件数（フォームで「上限に達しています」を出すため）
create function public.my_pending_submission_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.campsite_submissions
  where user_id = (select auth.uid()) and status = 'pending';
$$;
revoke execute on function public.my_pending_submission_count() from public;
grant execute on function public.my_pending_submission_count() to authenticated;

-- ========== アクセス制御 ==========
alter table public.campsite_submissions enable row level security;
grant insert on public.campsite_submissions to authenticated;
grant select, update on public.campsite_submissions to authenticated;

-- 自分の名前で、確認待ちの申請だけを作れる（運営の項目は入れられない）
create policy "users submit campsites" on public.campsite_submissions for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and reject_reason is null and admin_note is null and campsite_id is null and reviewed_at is null
  );
create policy "admins read submissions" on public.campsite_submissions for select
  to authenticated using ((select public.is_admin()));
create policy "admins update submissions" on public.campsite_submissions for update
  to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- 運営が campsites に行を追加できるようにする（これまではダッシュボードからだけ）
grant insert on public.campsites to authenticated;
create policy "admins insert campsites" on public.campsites for insert
  to authenticated with check ((select public.is_admin()));

-- /campsites/new（登録申請のページ）とぶつからないよう、slug に new は使えない
alter table public.campsites add constraint campsites_slug_not_reserved check (slug <> 'new');

-- ========== 承認（キャンプ場の追加と申請の更新を、1つのトランザクションで行う） ==========
-- security invoker：呼んだ人の権限で動くので、運営以外が呼んでも RLS で失敗する
create function public.approve_campsite_submission(
  p_submission_id uuid,
  p_slug          text,
  p_name          text,
  p_prefecture    text,
  p_address       text,
  p_lat           double precision,
  p_lng           double precision,
  p_location_type public.location_type,
  p_site_style    public.site_style,
  p_fire_rule     public.fire_rule,
  p_car_access    boolean,
  p_has_hot_water boolean,
  p_has_shower    boolean,
  p_has_bath      boolean,
  p_official_url  text,
  p_admin_note    text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campsite_id uuid;
begin
  if not exists (
    select 1 from public.campsite_submissions where id = p_submission_id and status = 'pending'
  ) then
    raise exception 'submission is not pending' using errcode = 'P0001', hint = 'not_pending';
  end if;

  insert into public.campsites (
    slug, name, prefecture, address, lat, lng, location_type, site_style, fire_rule,
    car_access, has_hot_water, has_shower, has_bath, official_url
  ) values (
    p_slug, p_name, p_prefecture, p_address, p_lat, p_lng, p_location_type, p_site_style, p_fire_rule,
    p_car_access, p_has_hot_water, p_has_shower, p_has_bath, p_official_url
  )
  returning id into v_campsite_id;

  update public.campsite_submissions
  set status = 'approved', campsite_id = v_campsite_id, admin_note = p_admin_note,
      reject_reason = null, reviewed_at = now()
  where id = p_submission_id;

  return v_campsite_id;
end;
$$;
revoke execute on function public.approve_campsite_submission from public;
grant execute on function public.approve_campsite_submission to authenticated;
