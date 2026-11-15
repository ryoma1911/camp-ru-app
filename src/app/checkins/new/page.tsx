import { Suspense } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { getCurrentUserId } from "@/lib/auth";
import { getCampsites } from "@/lib/campsites";
import { byPrefecture } from "@/lib/search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CampsitePicker } from "./campsite-picker";

export const metadata = { title: "ソト活登録" };

/** メニューの「ソト活登録」：まずキャンプ場を選び、そのキャンプ場の投稿フォームに移る */
export default function NewCheckinPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ソト活登録</h1>
        <p className="mt-1 text-sm text-stone-600">行ったキャンプ場を選んでください。</p>
      </div>
      <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
        <PickerOrLogin />
      </Suspense>
    </div>
  );
}

async function PickerOrLogin() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <form action={signInWithGoogle} className="space-y-3 rounded-xl border border-stone-200 bg-white p-6 text-center">
        <p className="text-sm">ソト活を登録するにはログインが必要です。</p>
        <input type="hidden" name="next" value="/checkins/new" />
        <button className="h-11 rounded-full bg-emerald-700 px-6 font-medium text-white hover:bg-emerald-800">
          Googleでログイン
        </button>
      </form>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [campsites, { data: mine }] = await Promise.all([
    getCampsites(),
    supabase
      .from("checkins")
      .select("campsite_id, visited_on")
      .eq("user_id", userId)
      .order("visited_on", { ascending: false })
      .limit(100),
  ]);

  // 前に投稿したキャンプ場（新しく行った順・重複なし・5件まで）
  const visitedIds = [...new Set((mine ?? []).map((r) => r.campsite_id as string))].slice(0, 5);
  const visitedSlugs = visitedIds
    .map((id) => campsites.find((c) => c.id === id)?.slug)
    .filter((s): s is string => !!s);
  const prefectures = [...new Set(campsites.map((c) => c.prefecture))].sort(byPrefecture);

  return (
    <CampsitePicker
      campsites={campsites.map(({ slug, name, prefecture, address, location_type }) => ({
        slug,
        name,
        prefecture,
        address,
        location_type,
      }))}
      visitedSlugs={visitedSlugs}
      prefectures={prefectures}
    />
  );
}
