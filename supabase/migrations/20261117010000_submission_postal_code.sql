-- キャンプ場登録の申請に郵便番号を追加（任意。7桁の数字、ハイフンなし）
-- 住所は「都道府県＋市区町村＋丁目番地号」を1つにして address に入れる。郵便番号は運営の確認用
alter table public.campsite_submissions
  add column if not exists postal_code text check (postal_code ~ '^[0-9]{7}$');
