-- 本名が表示されないようにする
-- ・新規登録時は Google の名前・アイコンをコピーせず「キャンパー1234」形式の自動ニックネームにする
-- ・登録済みのプロフィールで Google の名前・アイコンが入っているものも置き換える
-- （本名は auth.users の中にだけ残り、サイトからは参照しない）

create or replace function public.random_camper_name()
returns text
language sql
volatile
as $$
  select 'キャンパー' || lpad(floor(random() * 10000)::int::text, 4, '0');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, public.random_camper_name(), null);
  return new;
end;
$$;

update public.profiles p
set display_name = public.random_camper_name(),
    avatar_url   = null
from auth.users u
where u.id = p.id
  and (
    p.display_name in (u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
    or p.avatar_url is not null
  );

-- ニックネームは前後の空白なし・1〜20文字
alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles
  add constraint profiles_display_name_check
  check (display_name = btrim(display_name) and char_length(display_name) between 1 and 20);
