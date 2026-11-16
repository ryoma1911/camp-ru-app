-- ソト活のテストデータを作る。Supabase の SQL エディタで実行する（管理者権限で動くので RLS を通らずに入れられる）。
-- ・テストユーザー10人（test01〜test10@sotoasobi.test。Google ログインのみのサイトなので、この人たちではログインできない）
-- ・ソト活 約160件を、キャンプ場25か所に3〜10件ずつ（残りのキャンプ場は0件のまま）
-- ・最初に前回のテストデータを消すので、何回実行しても重複しない（乱数のもとを固定しているので中身もほぼ同じ。行った日は実行日から過去12か月）
-- 消すときは delete_test_data.sql を実行する。公開前には必ず消すこと

begin;

-- 前回のテストデータを消す（プロフィール・ソト活もまとめて消える）
delete from auth.users where email like '%@sotoasobi.test';

select setseed(0.20261116);

-- ========== テストユーザー ==========
-- プロフィールは既存のトリガー（handle_new_user）が作る。ニックネームはテストとわかる名前に置き換える
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  format('test%s@sotoasobi.test', lpad(i::text, 2, '0')), '', now(),
  '{"provider":"email","providers":["email"]}', '{"test_data":true}', now(), now(),
  '', '', '', ''
from generate_series(1, 10) as i;

update public.profiles p
set display_name = 'テスト' || substr(u.email, 5, 2)  -- テスト01〜テスト10
from auth.users u
where u.id = p.id and u.email like '%@sotoasobi.test';

-- ========== ソト活 ==========
do $$
declare
  -- 関東の低地の、月ごとの明け方の最低気温の目安（℃）
  base_temp constant int[] := array[-1, 0, 3, 8, 13, 17, 21, 22, 18, 12, 6, 1];
  comments constant text[] := array[
    '夜中に風が強くなり、焚き火は早めに切り上げました',
    '明け方に霜が降りていました。冬用の寝袋で正解でした',
    '地面が固く、プラペグは曲がってしまいました',
    '炊事場がきれいで使いやすかったです',
    '星がよく見えました。夜は思ったより冷えます',
    '虫が少なく快適でした',
    '週末は混んでいましたが、サイトは広めでした',
    '薪ストーブがあるとかなり暖かく過ごせました',
    '川の音が心地よく、よく眠れました',
    '日中は暖かくても、夜は一気に気温が下がりました',
    '風よけになる木が多く、焚き火がしやすかったです',
    '朝の景色が最高でした。また来たいです'
  ];
  v_users uuid[];
  c record;
  n int;
  made int;
  tries int;
  d date;
  md text;
  closed boolean;
  t int;
  temp numeric;
  bag public.sleeping_bag_type;
  pegs public.peg_needed[] := array['plastic', 'steel', 'forged', 'rocky']::public.peg_needed[];
  peg_base int;
  wind_rate numeric;
  r numeric;
  v_heaters text[];
begin
  select array_agg(u.id order by u.email) into v_users
  from auth.users u where u.email like '%@sotoasobi.test';

  -- 対象のキャンプ場25か所（slug のハッシュ順で、毎回同じ25か所になる）
  for c in
    select cs.*, abs(hashtext(cs.slug)) as h
    from public.campsites cs
    order by md5(cs.slug)
    limit 25
  loop
    n := 3 + (c.h % 8);                 -- 3〜10件
    peg_base := 1 + (c.h / 8) % 4;      -- そのキャンプ場で多いペグ
    wind_rate := case when c.location_type in ('highland', 'view', 'sea') then 0.4 else 0.2 end;
    made := 0;
    tries := 0;

    while made < n and tries < 200 loop
      tries := tries + 1;
      d := current_date - (1 + floor(random() * 365))::int;  -- 過去12か月
      md := to_char(d, 'MM-DD');

      -- 冬季閉鎖中の日には行けないので入れない
      closed := c.winter_closed_from is not null and (
        case when c.winter_closed_from <= c.winter_closed_to
          then md between c.winter_closed_from and c.winter_closed_to
          else md >= c.winter_closed_from or md <= c.winter_closed_to
        end);
      continue when closed;

      -- 気温：月の目安 + キャンプ場の種類（高原ほど低い）+ ばらつき。1割は「わからない」
      t := base_temp[extract(month from d)::int]
        + case c.location_type
            when 'highland' then -6 when 'view' then -4 when 'forest' then -3
            when 'lake' then -3 when 'meadow' then -3 when 'river' then -1 when 'sea' then 2
            else 0 end
        + floor(random() * 7)::int - 3;
      t := greatest(-25, least(25, t));
      temp := case when random() < 0.1 then null else t end;

      -- 寝袋：気温に合うタイプ。2割は「わからない」
      bag := case
        when random() < 0.2 then null
        when t >= 10 then 'summer'
        when t >= 0 then 'three_season'
        when t >= -10 then 'winter'
        else 'extreme'
      end::public.sleeping_bag_type;

      -- 暖房：寒い日ほど使う。3割は記録なし
      r := random();
      v_heaters := case
        when random() < 0.3 then null
        when t >= 8 then array['none']
        when r < 0.3 then array['wood_stove']
        when r < 0.6 then array['kerosene_stove']
        when r < 0.65 then array['wood_stove', 'kerosene_stove']
        else array['none']
      end;

      insert into public.checkins (
        user_id, campsite_id, visited_on,
        min_temp_c, temp_measured, temp_at_dawn,
        sleeping_bag_type, sleep_quality,
        peg_needed, fire_status, bug_level, party_type, heaters,
        comment, photo_reuse_ok, created_at
      ) values (
        v_users[1 + floor(random() * array_length(v_users, 1))::int],
        c.id,
        d,
        temp,
        random() < 0.4,
        random() < 0.85,
        bag,
        case when random() < 0.1 then null
             when random() < 0.72 then 'comfortable'
             when random() < 0.8 then 'cold'
             else 'sleepless' end::public.sleep_quality,
        -- ペグ：そのキャンプ場で多いものが65%、残りはばらばら
        case when random() < 0.65 then pegs[peg_base] else pegs[1 + floor(random() * 4)::int] end,
        case when c.fire_rule = 'prohibited' then 'prohibited'
             when random() < wind_rate then 'skipped_wind'
             else 'done' end::public.fire_status,
        -- 虫：夏は多め、冬は少ない。3割は記録なし
        case when random() < 0.3 then null
             when extract(month from d) between 6 and 9 then 2 + floor(random() * 2)::int
             when extract(month from d) in (4, 5, 10) then 1 + floor(random() * 2)::int
             else 1 end,
        -- 誰と：ソロが多め。15%は記録なし
        case when random() < 0.15 then null
             else (array['solo', 'solo', 'solo', 'couple', 'family', 'group'])[1 + floor(random() * 6)::int] end::public.party_type,
        v_heaters,
        case when random() < 0.5 then null else comments[1 + floor(random() * array_length(comments, 1))::int] end,
        false,
        d + interval '1 day' + floor(random() * 20) * interval '1 hour'
      );
      made := made + 1;
    end loop;
  end loop;
end $$;

commit;

-- 確認用：テストユーザー10人と、ソト活の件数・キャンプ場の数
select
  (select count(*) from auth.users where email like '%@sotoasobi.test') as test_users,
  count(*) as test_checkins,
  count(distinct ch.campsite_id) as campsites
from public.checkins ch
join auth.users u on u.id = ch.user_id
where u.email like '%@sotoasobi.test';
