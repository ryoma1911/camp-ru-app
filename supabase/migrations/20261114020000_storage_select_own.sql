-- 投稿の編集・削除で写真ファイルを消せるようにする
-- Supabase Storage のファイル削除には delete に加えて select の権限が必要なため、
-- 自分のフォルダ（<user_id>/...）のファイルだけ参照できるようにする
-- （表示は公開URLで行うので、他人のファイルを一覧できる必要はない）

create policy "users read own files" on storage.objects for select
  to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
