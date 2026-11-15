import "server-only";
import { CHECKIN_COLUMNS } from "@/lib/campsites";
import type { Checkin } from "@/lib/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MyCheckin = Checkin & { campsites: { id: string; slug: string; name: string } };

const MY_COLUMNS = `${CHECKIN_COLUMNS}, campsites(id, slug, name)`;

/** 自分のソト活一覧（新しい順）。ログイン中のユーザーとして読むのでキャッシュしない */
export async function getMyCheckins(userId: string): Promise<MyCheckin[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("checkins")
    .select(MY_COLUMNS)
    .eq("user_id", userId)
    .order("visited_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`ソト活の取得に失敗しました: ${error.message}`);
  return data as unknown as MyCheckin[];
}

/** 自分の投稿を1件。他人の投稿や存在しない ID なら null */
export async function getMyCheckin(id: string, userId: string): Promise<MyCheckin | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("checkins")
    .select(MY_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`ソト活の取得に失敗しました: ${error.message}`);
  return data as unknown as MyCheckin | null;
}
