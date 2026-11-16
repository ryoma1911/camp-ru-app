-- Place ID のチェックを直す。PostgreSQL の正規表現は繰り返し回数を255までしか書けず、
-- {10,300} だと値を入れたときに「invalid repetition count(s)」で保存できなかった。
-- 長さの条件を正規表現から外す（10〜300文字・英数字と _ - だけ、という中身は同じ）
alter table public.campsites drop constraint campsites_google_place_id_check;
alter table public.campsites add constraint campsites_google_place_id_check check (
  google_place_id is null
  or (char_length(google_place_id) between 10 and 300 and google_place_id ~ '^[A-Za-z0-9_-]+$')
);
