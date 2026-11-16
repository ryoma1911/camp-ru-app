-- ソト活の「地面」をフォーム・集計・検索から外した（ペグの項目を「地面の固さ」として残す）。
-- これまでの投稿の値を残すため列は消さず、新しい投稿では空欄（null）にできるようにする
alter table public.checkins alter column ground_type drop not null;
