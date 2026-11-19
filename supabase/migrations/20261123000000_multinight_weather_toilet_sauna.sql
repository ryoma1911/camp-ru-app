-- ソト活：連泊（泊数）・天気・気象データからの推定最低気温を足す
-- キャンプ場：トイレ・サウナを足す（設備を5ジャンルに分けて表示するため）

-- ========== ソト活 ==========
-- 天気（滞在中をまとめて・複数選べる）。null = 記録なし
create domain public.weather_options as text[]
  check (
    cardinality(value) > 0
    and value <@ array['sunny', 'cloudy', 'rain', 'snow', 'windy']  -- 晴れ/くもり/雨/雪/強風
  );

alter table public.checkins
  -- 泊数。visited_on は1泊目の日。これまでの投稿は1泊
  add column nights          smallint not null default 1 check (nights between 1 and 7),
  add column weather         public.weather_options,
  -- 夜の最低気温が「わからない」ときに、座標と日付から気象データ（Open-Meteo）で推定した値。
  -- 本人の記録ではないので、集計（いちばん冷えた記録・月の平均）には使わない
  add column est_min_temp_c  numeric(4, 1) check (est_min_temp_c between -40 and 45),
  add column est_fetched_at  timestamptz;

-- ========== キャンプ場の設備（申請にも同じ項目を足す） ==========
-- none（なし）はほかと一緒に選べない。null = 未入力
create domain public.toilet_options as text[]
  check (
    cardinality(value) > 0
    and value <@ array['flush', 'simple', 'none']  -- 水洗/簡易（汲み取り・仮設）/なし
    and (not 'none' = any (value) or cardinality(value) = 1)
  );

create domain public.sauna_options as text[]
  check (
    cardinality(value) > 0
    and value <@ array['public', 'private', 'none']  -- パブリック/貸切/なし
    and (not 'none' = any (value) or cardinality(value) = 1)
  );

alter table public.campsites
  add column toilet_types public.toilet_options,
  add column sauna_types  public.sauna_options;

alter table public.campsite_submissions
  add column toilet_types public.toilet_options,
  add column sauna_types  public.sauna_options;

-- 運営が管理画面から直せるようにする（ほかの設備と同じく列単位で許可）
grant update (toilet_types, sauna_types) on public.campsites to authenticated;

-- ========== 承認の関数を、トイレ・サウナも受け取る形に作り直す ==========
drop function public.approve_campsite_submission(
  uuid, text, text, text, text, double precision, double precision,
  public.location_type, public.site_style, public.fire_rule,
  boolean, boolean, boolean, boolean,
  boolean, text[], text[], boolean, text[], boolean, text[],
  text, text, text, text, text, text
);

create function public.approve_campsite_submission(
  p_submission_id       uuid,
  p_slug                text,
  p_name                text,
  p_prefecture          text,
  p_address             text,
  p_lat                 double precision,
  p_lng                 double precision,
  p_location_type       public.location_type,
  p_site_style          public.site_style,
  p_fire_rule           public.fire_rule,
  p_car_access          boolean,
  p_has_hot_water       boolean,
  p_has_shower          boolean,
  p_has_bath            boolean,
  p_has_kitchen         boolean,
  p_garbage             text[],
  p_ac_power            text[],
  p_has_shop            boolean,
  p_shop_items          text[],
  p_has_wifi            boolean,
  p_payment_methods     text[],
  p_toilet_types        text[],
  p_sauna_types         text[],
  p_official_url        text,
  p_google_place_id     text,
  p_winter_closed_from  text,
  p_winter_closed_to    text,
  p_winter_closure_note text,
  p_admin_note          text
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
    toilet_types, sauna_types,
    official_url, google_place_id,
    winter_closed_from, winter_closed_to, winter_closure_note
  ) values (
    p_slug, p_name, p_prefecture, p_address, p_lat, p_lng, p_location_type, p_site_style, p_fire_rule,
    p_car_access, p_has_hot_water, p_has_shower, p_has_bath,
    p_has_kitchen, p_garbage, p_ac_power, p_has_shop, p_shop_items, p_has_wifi, p_payment_methods,
    p_toilet_types, p_sauna_types,
    p_official_url, p_google_place_id,
    p_winter_closed_from, p_winter_closed_to, p_winter_closure_note
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
