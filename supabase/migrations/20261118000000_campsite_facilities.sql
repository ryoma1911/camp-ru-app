-- キャンプ場の設備を6項目増やす（炊事場・ゴミ・AC電源・売店・Wi-Fi・決済方法）
-- ・どれも null =「未入力」（画面では空欄）。今あるキャンプ場は未入力から始め、運営が管理画面で入れていく
-- ・ゴミ・AC電源・売店の品物・決済方法は複数選べる（混在するキャンプ場があるため）
-- ・申請（campsite_submissions）にも同じ項目を足す。申請者が入れた値を、運営が公式サイトで確かめて公開する

-- ========== 複数選べる項目の型（決まった値だけ・空の配列は入れない） ==========
create domain public.garbage_options as text[]
  check (cardinality(value) > 0 and value <@ array['paid', 'free', 'take_home']);  -- 有料/無料/持ち帰り

-- none（なし）はほかと一緒に選べない
create domain public.ac_power_options as text[]
  check (
    cardinality(value) > 0
    and value <@ array['extra_fee', 'included', 'none']  -- 設置サイトあり（別料金）/（料金に含む）/なし
    and (not 'none' = any (value) or cardinality(value) = 1)
  );

create domain public.shop_item_options as text[]
  check (
    cardinality(value) > 0
    and value <@ array['gas', 'firewood', 'charcoal', 'towel', 'meal_kit', 'toothbrush', 'other']
  );

create domain public.payment_options as text[]
  check (cardinality(value) > 0 and value <@ array['cash', 'card']);  -- 現金/カード

-- ========== キャンプ場 ==========
alter table public.campsites
  add column has_kitchen     boolean,                         -- 炊事場があるか
  add column garbage         public.garbage_options,
  add column ac_power        public.ac_power_options,
  add column has_shop        boolean,                         -- 売店があるか
  add column shop_items      public.shop_item_options,        -- 売店で買えるもの（売店ありのときだけ）
  add column has_wifi        boolean,
  add column payment_methods public.payment_options,
  add constraint campsites_shop_items_need_shop check (shop_items is null or has_shop is true);

-- ========== 申請 ==========
alter table public.campsite_submissions
  add column has_kitchen     boolean,
  add column garbage         public.garbage_options,
  add column ac_power        public.ac_power_options,
  add column has_shop        boolean,
  add column shop_items      public.shop_item_options,
  add column has_wifi        boolean,
  add column payment_methods public.payment_options,
  add constraint campsite_submissions_shop_items_need_shop check (shop_items is null or has_shop is true);

-- ========== 運営が設備を編集できるようにする ==========
-- 直せるのは設備の列だけ（名前・住所・slug などは、ここからは変えられない）
grant update (
  car_access, has_hot_water, has_shower, has_bath,
  has_kitchen, garbage, ac_power, has_shop, shop_items, has_wifi, payment_methods
) on public.campsites to authenticated;
create policy "admins update campsites" on public.campsites for update
  to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ========== 承認の関数を、新しい項目を受け取る形に作り直す ==========
drop function public.approve_campsite_submission(
  uuid, text, text, text, text, double precision, double precision,
  public.location_type, public.site_style, public.fire_rule,
  boolean, boolean, boolean, boolean, text, text
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
    official_url
  ) values (
    p_slug, p_name, p_prefecture, p_address, p_lat, p_lng, p_location_type, p_site_style, p_fire_rule,
    p_car_access, p_has_hot_water, p_has_shower, p_has_bath,
    p_has_kitchen, p_garbage, p_ac_power, p_has_shop, p_shop_items, p_has_wifi, p_payment_methods,
    p_official_url
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
