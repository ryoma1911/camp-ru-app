"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { CAMPSITE_IMAGES_TAG } from "@/lib/campsite-images";
import { SUMMARIES_TAG, checkinsTag } from "@/lib/campsites";
import { checkinTag } from "@/lib/checkin-share";
import { PHOTO_BUCKET, estimateFields, parseCheckinForm, type CheckinFormState } from "@/lib/checkin-input";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 自分の投稿を書き換える。写真は「残したもの＋追加したもの」にし、外したファイルは消す。
 * 残した写真の行は消さずに並び順だけ直す（キャンプ場の紹介写真に採用されていても外れないように）。
 * 外した写真・許可を外したときに採用されていた写真は、DB 側で自動的に紹介写真から外れる
 */
export async function updateCheckin(
  target: { id: string; campsiteId: string; slug: string },
  _prev: CheckinFormState,
  formData: FormData,
): Promise<CheckinFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { error: "ログインが切れました。もう一度ログインしてください。" };

  const parsed = parseCheckinForm(formData, userId);
  if (!parsed.ok) return { error: parsed.error };

  // user_id も条件に入れ、自分の投稿以外は更新されないようにする（RLS でも制限している）
  const { data: updated, error } = await supabase
    .from("checkins")
    .update({ ...parsed.fields, ...(await estimateFields(target.campsiteId, parsed.fields)) })
    .eq("id", target.id)
    .eq("user_id", userId)
    .select("id");
  if (error || !updated?.length) {
    console.error("checkin update failed", error);
    return { error: "保存に失敗しました。時間をおいてもう一度お試しください。" };
  }

  const { data: oldPhotos } = await supabase
    .from("checkin_photos")
    .select("id, storage_path")
    .eq("checkin_id", target.id);
  const old = oldPhotos ?? [];
  const removedRows = old.filter((p) => !parsed.photoPaths.includes(p.storage_path));
  const removed = removedRows.map((p) => p.storage_path);

  if (removedRows.length > 0) {
    await supabase.from("checkin_photos").delete().in("id", removedRows.map((p) => p.id));
  }
  const added: { checkin_id: string; storage_path: string; sort_order: number }[] = [];
  for (const [i, path] of parsed.photoPaths.entries()) {
    const kept = old.find((p) => p.storage_path === path);
    if (kept) await supabase.from("checkin_photos").update({ sort_order: i }).eq("id", kept.id);
    else added.push({ checkin_id: target.id, storage_path: path, sort_order: i });
  }
  if (added.length > 0) {
    const { error: photoError } = await supabase.from("checkin_photos").insert(added);
    if (photoError) console.error("checkin photos insert failed", photoError);
  }
  if (removed.length > 0) {
    const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove(removed);
    if (removeError) console.error("photo file remove failed", removeError);
  }

  updateTag(checkinsTag(target.campsiteId));
  updateTag(SUMMARIES_TAG);
  updateTag(checkinTag(target.id));
  updateTag(CAMPSITE_IMAGES_TAG);
  redirect(`/campsites/${target.slug}?updated=1`);
}

/** 自分の投稿を削除する。写真ファイルも一緒に消す（紹介写真に採用されていれば DB 側で自動的に外れる） */
export async function deleteCheckin(target: { id: string; campsiteId: string }): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { error: "ログインが切れました。もう一度ログインしてください。" };

  const { data: photos } = await supabase
    .from("checkin_photos")
    .select("storage_path")
    .eq("checkin_id", target.id);

  const { data: deleted, error } = await supabase
    .from("checkins")
    .delete()
    .eq("id", target.id)
    .eq("user_id", userId)
    .select("id");
  if (error || !deleted?.length) {
    console.error("checkin delete failed", error);
    return { error: "削除に失敗しました。時間をおいてもう一度お試しください。" };
  }

  const paths = (photos ?? []).map((p) => p.storage_path);
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    if (removeError) console.error("photo file remove failed", removeError);
  }

  updateTag(checkinsTag(target.campsiteId));
  updateTag(SUMMARIES_TAG);
  updateTag(checkinTag(target.id));
  updateTag(CAMPSITE_IMAGES_TAG);
  refresh();
  return { error: null };
}
