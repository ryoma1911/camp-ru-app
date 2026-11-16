-- テストデータを消す（公開前に必ず実行する）。Supabase の SQL エディタで実行する。
-- 消えるもの：@sotoasobi.test のテストユーザーと、そのプロフィール・ソト活（外部キーの on delete cascade でまとめて消える）
-- 本物のユーザーと、その投稿には触れない

begin;

delete from auth.users where email like '%@sotoasobi.test';

commit;

-- 確認用：どちらも 0 なら消えている
select
  (select count(*) from auth.users where email like '%@sotoasobi.test') as test_users,
  (select count(*) from public.profiles where display_name like 'テスト%') as test_profiles;
