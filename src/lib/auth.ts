import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** ログイン中ならユーザーIDを返す。cookie を読むので <Suspense> の内側で使うこと */
export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

export type MyProfile = { id: string; display_name: string };

/** ログイン中のユーザーのプロフィール（ニックネーム）。Google の本名は使わない */
export async function getMyProfile(): Promise<MyProfile | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("id, display_name").eq("id", userId).maybeSingle();
  return data ?? { id: userId, display_name: "キャンパー" };
}
