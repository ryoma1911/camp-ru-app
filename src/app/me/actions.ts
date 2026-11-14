"use server";

import { refresh, updateTag } from "next/cache";
import { ALL_CHECKINS_TAG } from "@/lib/campsites";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NicknameFormState = { error: string | null; saved: boolean };

export async function updateNickname(_prev: NicknameFormState, formData: FormData): Promise<NicknameFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { error: "ログインが切れました。もう一度ログインしてください。", saved: false };

  const name = String(formData.get("display_name") ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 20) {
    return { error: "ニックネームは1〜20文字で入力してください。", saved: false };
  }

  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", userId);
  if (error) {
    console.error("nickname update failed", error);
    return { error: "保存に失敗しました。時間をおいてもう一度お試しください。", saved: false };
  }

  updateTag(ALL_CHECKINS_TAG); // 投稿に表示される名前も入れ替える
  refresh(); // ヘッダーの名前も更新する
  return { error: null, saved: true };
}
