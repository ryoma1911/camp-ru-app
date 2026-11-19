"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { SUMMARIES_TAG, checkinsTag } from "@/lib/campsites";
import { estimateFields, parseCheckinForm, type CheckinFormState } from "@/lib/checkin-input";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createCheckin(
  campsite: { id: string; slug: string },
  _prev: CheckinFormState,
  formData: FormData,
): Promise<CheckinFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { error: "ログインが切れました。もう一度ログインしてください。" };

  const parsed = parseCheckinForm(formData, userId);
  if (!parsed.ok) return { error: parsed.error };

  const { data: checkin, error } = await supabase
    .from("checkins")
    .insert({
      ...parsed.fields,
      ...(await estimateFields(campsite.id, parsed.fields)),
      user_id: userId,
      campsite_id: campsite.id,
    })
    .select("id")
    .single();
  if (error || !checkin) {
    console.error("checkin insert failed", error);
    return { error: "保存に失敗しました。時間をおいてもう一度お試しください。" };
  }

  if (parsed.photoPaths.length > 0) {
    const { error: photoError } = await supabase
      .from("checkin_photos")
      .insert(parsed.photoPaths.map((path, i) => ({ checkin_id: checkin.id, storage_path: path, sort_order: i })));
    if (photoError) console.error("checkin photos insert failed", photoError);
  }

  updateTag(checkinsTag(campsite.id));
  updateTag(SUMMARIES_TAG);
  // 投稿1件のページに移り、Xでの共有をすすめる
  redirect(`/checkins/${checkin.id}?posted=1`);
}
