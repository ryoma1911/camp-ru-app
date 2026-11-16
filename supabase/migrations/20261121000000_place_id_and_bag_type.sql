-- ① 地図リンクを施設名で開くため、Googleマップの Place ID を持たせる（空 = Googleマップ未登録として座標で開く）
-- ② ソト活の寝袋を「快適温度」から「寝袋タイプ」に変える

-- ========== ① Place ID ==========
alter table public.campsites
  add column google_place_id text check (google_place_id is null or google_place_id ~ '^[A-Za-z0-9_-]{10,300}$');

-- 運営が管理画面から直せるようにする（設備と同じく列単位で許可）
grant update (google_place_id) on public.campsites to authenticated;

-- 承認の関数を、Place ID も受け取る形に作り直す
drop function public.approve_campsite_submission(
  uuid, text, text, text, text, double precision, double precision,
  public.location_type, public.site_style, public.fire_rule,
  boolean, boolean, boolean, boolean,
  boolean, text[], text[], boolean, text[], boolean, text[],
  text, text
);

create function public.approve_campsite_submission(
  p_submission_id   uuid,
  p_slug            text,
  p_name            text,
  p_prefecture      text,
  p_address         text,
  p_lat             double precision,
  p_lng             double precision,
  p_location_type   public.location_type,
  p_site_style      public.site_style,
  p_fire_rule       public.fire_rule,
  p_car_access      boolean,
  p_has_hot_water   boolean,
  p_has_shower      boolean,
  p_has_bath        boolean,
  p_has_kitchen     boolean,
  p_garbage         text[],
  p_ac_power        text[],
  p_has_shop        boolean,
  p_shop_items      text[],
  p_has_wifi        boolean,
  p_payment_methods text[],
  p_official_url    text,
  p_google_place_id text,
  p_admin_note      text
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
    car_access, has_hot_water, has_shower, has_bath,
    has_kitchen, garbage, ac_power, has_shop, shop_items, has_wifi, payment_methods,
    official_url, google_place_id
  ) values (
    p_slug, p_name, p_prefecture, p_address, p_lat, p_lng, p_location_type, p_site_style, p_fire_rule,
    p_car_access, p_has_hot_water, p_has_shower, p_has_bath,
    p_has_kitchen, p_garbage, p_ac_power, p_has_shop, p_shop_items, p_has_wifi, p_payment_methods,
    p_official_url, p_google_place_id
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

-- ========== ② 寝袋タイプ ==========
create type public.sleeping_bag_type as enum ('summer', 'three_season', 'winter', 'extreme');  -- 夏用/3シーズン用/冬用/厳冬期用

-- 任意。null =「わからない」（現地コンディションの集計に入れない）
alter table public.checkins add column sleeping_bag_type public.sleeping_bag_type;

-- これまでの投稿は、快適温度からタイプに振り分けて移す
update public.checkins
set sleeping_bag_type = case
  when sleeping_bag_comfort_c >= 10 then 'summer'
  when sleeping_bag_comfort_c >= 0  then 'three_season'
  when sleeping_bag_comfort_c >= -10 then 'winter'
  else 'extreme'
end::public.sleeping_bag_type
where sleeping_bag_comfort_c is not null;

-- 快適温度の列（sleeping_bag_comfort_c）は、過去の値を残すため消さない（今後は入らない）
