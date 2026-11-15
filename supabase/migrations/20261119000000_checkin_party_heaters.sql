-- ソト活に「誰と行った？」と「使った暖房」を足す（どちらも任意。null = 記録なし）
-- 車の乗り入れ（car_access_ok）と炊事場のお湯（hot_water_ok）は、フォームと集計から外した。
-- これまでの投稿の値を残すため列は消さない（今後は入らない）

create type public.party_type as enum ('solo', 'couple', 'family', 'group');  -- ソロ/カップル/ファミリー/グループ

-- 使った暖房（複数選べる）。none（使わなかった）はほかと一緒に選べない
create domain public.heater_options as text[]
  check (
    cardinality(value) > 0
    and value <@ array['wood_stove', 'kerosene_stove', 'none']  -- 薪ストーブ/石油ストーブ/使わなかった
    and (not 'none' = any (value) or cardinality(value) = 1)
  );

alter table public.checkins
  add column party_type public.party_type,
  add column heaters    public.heater_options;
