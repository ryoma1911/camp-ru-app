import { Suspense } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { getMyProfile } from "@/lib/auth";
import { NicknameForm } from "./nickname-form";

export const metadata = { title: "マイページ" };

export default function MyPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">マイページ</h1>
      <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
        <MyPageContent />
      </Suspense>
    </div>
  );
}

async function MyPageContent() {
  const profile = await getMyProfile();
  if (!profile) {
    return (
      <form action={signInWithGoogle} className="space-y-3 rounded-xl border border-stone-200 bg-white p-6 text-center">
        <p className="text-sm">マイページを見るにはログインが必要です。</p>
        <input type="hidden" name="next" value="/me" />
        <button className="h-11 rounded-full bg-emerald-700 px-6 font-medium text-white hover:bg-emerald-800">
          Googleでログイン
        </button>
      </form>
    );
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      {/* 保存後に最新の名前で入れ直すため key に名前を使う */}
      <NicknameForm key={profile.display_name} current={profile.display_name} />
    </section>
  );
}
