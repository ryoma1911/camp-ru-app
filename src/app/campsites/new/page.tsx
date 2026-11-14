import { Suspense } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { getCurrentUserId } from "@/lib/auth";
import { getCampsites } from "@/lib/campsites";
import { MAX_PENDING_SUBMISSIONS } from "@/lib/submission-input";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SubmissionArea } from "./submission-form";

export const metadata = { title: "キャンプ場登録" };

/** メニューの「キャンプ場登録」：まだ載っていないキャンプ場の登録を申請する */
export default function NewCampsitePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">キャンプ場登録</h1>
        <p className="mt-1 text-sm text-stone-600">
          まだ載っていないキャンプ場の登録を申請できます。運営が公式サイトで確認してから公開します。
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
        <FormOrLogin />
      </Suspense>
    </div>
  );
}

async function FormOrLogin() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <form action={signInWithGoogle} className="space-y-3 rounded-xl border border-stone-200 bg-white p-6 text-center">
        <p className="text-sm">キャンプ場を登録するにはログインが必要です。</p>
        <input type="hidden" name="next" value="/campsites/new" />
        <button className="h-11 rounded-full bg-emerald-700 px-6 font-medium text-white hover:bg-emerald-800">
          Googleでログイン
        </button>
      </form>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [campsites, { data: pendingCount }] = await Promise.all([
    getCampsites(),
    supabase.rpc("my_pending_submission_count"),
  ]);

  return (
    <SubmissionArea
      existing={campsites.map(({ slug, name, prefecture }) => ({ slug, name, prefecture }))}
      limitReached={(pendingCount ?? 0) >= MAX_PENDING_SUBMISSIONS}
    />
  );
}
