-- キャンプ場の冬季閉鎖。毎年同じ月日の期間として持つ（例：12-01 〜 03-31。年をまたいでよい）
-- 両方空 = 冬季閉鎖なし。運営が管理画面（設備・地図）と申請の承認で入れる

-- 'MM-DD' で、その月にある日か（2/29 は閏年に閉鎖が始まる・終わることがあるので許す）
create function public.is_month_day(v text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select v ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    and substr(v, 4, 2)::int <= case substr(v, 1, 2)
      when '02' then 29
      when '04' then 30 when '06' then 30 when '09' then 30 when '11' then 30
      else 31
    end;
$$;

alter table public.campsites
  add column winter_closed_from  text,
  add column winter_closed_to    text,
  add column winter_closure_note text check (char_length(winter_closure_note) <= 100),
  add constraint campsites_winter_closed_from_check check (winter_closed_from is null or public.is_month_day(winter_closed_from)),
  add constraint campsites_winter_closed_to_check   check (winter_closed_to is null or public.is_month_day(winter_closed_to)),
  -- 期間は両方入れるか、両方空。補足は期間があるときだけ
  add constraint campsites_winter_closed_pair check ((winter_closed_from is null) = (winter_closed_to is null)),
  add constraint campsites_winter_note_needs_period check (winter_closure_note is null or winter_closed_from is not null);

-- 運営が管理画面から直せるようにする（設備と同じく列単位で許可）
grant update (winter_closed_from, winter_closed_to, winter_closure_note) on public.campsites to authenticated;

-- 承認の関数を、冬季閉鎖も受け取る形に作り直す
drop function public.approve_campsite_submission(
  uuid, text, text, text, text, double precision, double precision,
  public.location_type, public.site_style, public.fire_rule,
  boolean, boolean, boolean, boolean,
  boolean, text[], text[], boolean, text[], boolean, text[],
  text, text, text
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
    official_url, google_place_id,
    winter_closed_from, winter_closed_to, winter_closure_note
  ) values (
    p_slug, p_name, p_prefecture, p_address, p_lat, p_lng, p_location_type, p_site_style, p_fire_rule,
    p_car_access, p_has_hot_water, p_has_shower, p_has_bath,
    p_has_kitchen, p_garbage, p_ac_power, p_has_shop, p_shop_items, p_has_wifi, p_payment_methods,
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
