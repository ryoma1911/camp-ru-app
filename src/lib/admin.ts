import "server-only";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** ログイン中のユーザーが運営か（admins 表に行があるか）。cookie を読むので <Suspense> の内側で使うこと */
export async function isAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return false;
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}

/**
 * 運営でなければ「ページが見つかりません」にする（管理画面があること自体を見せない）。
 * 運営なら、運営として DB を読み書きするクライアントを返す
 */
export async function requireAdmin() {
  if (!(await isAdmin())) notFound();
  return createSupabaseServerClient();
}
