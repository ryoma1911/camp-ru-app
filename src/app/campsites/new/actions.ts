"use server";

import { lookupPostal, normalizePostal } from "@/lib/postal";
import { MAX_PENDING_SUBMISSIONS, parseSubmissionForm } from "@/lib/submission-input";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SubmissionFormState = { error: string | null; done: boolean };

/** キャンプ場の登録を申請する。運営が確認してから公開する */
export async function submitCampsite(_prev: SubmissionFormState, formData: FormData): Promise<SubmissionFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { error: "ログインが切れました。もう一度ログインしてください。", done: false };

  const parsed = parseSubmissionForm(formData);
  if (!parsed.ok) return { error: parsed.error, done: false };

  // 申請者は自分の申請を読めないので、select せずに入れるだけにする
  const { error } = await supabase.from("campsite_submissions").insert({ ...parsed.fields, user_id: userId });
  if (error) {
    if (error.hint === "submission_limit") {
      return {
        error: `確認待ちの申請が${MAX_PENDING_SUBMISSIONS}件あります。運営が確認するまでお待ちください。`,
        done: false,
      };
    }
    console.error("campsite submission insert failed", error);
    return { error: "申請に失敗しました。時間をおいてもう一度お試しください。", done: false };
  }
  return { error: null, done: true };
}

/** 郵便番号から都道府県と市区町村を調べる（フォームの自動入力に使う） */
export async function findAddressByPostal(code: string): Promise<{ prefecture: string; city: string }[] | null> {
  const normalized = normalizePostal(code);
  return normalized ? lookupPostal(normalized) : null;
}
