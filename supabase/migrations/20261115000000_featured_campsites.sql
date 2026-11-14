-- トップの「おすすめのキャンプ場」用
-- featured_rank に数字（1, 2, 3…）を入れたキャンプ場を、数字の小さい順におすすめとして先に出す。
-- 空（null）のキャンプ場はおすすめではない（残りの枠は今月のキャン活が多い順で自動的に埋める）
alter table public.campsites
  add column if not exists featured_rank smallint check (featured_rank > 0);

-- 「最近登録されたキャンプ場」を新しい順に取り出すため
create index if not exists campsites_created_at_idx on public.campsites (created_at desc);
