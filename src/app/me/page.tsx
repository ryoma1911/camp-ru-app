import Link from "next/link";
import { Suspense } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { CheckinCard } from "@/components/checkin-card";
import { CheckinOwnerActions } from "@/components/checkin-owner-actions";
import { getMyProfile } from "@/lib/auth";
import { getMyCheckins } from "@/lib/my-checkins";
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

  const checkins = await getMyCheckins(profile.id);
  const campsiteCount = new Set(checkins.map((c) => c.campsite_id)).size;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        {/* 保存後に最新の名前で入れ直すため key に名前を使う */}
        <NicknameForm key={profile.display_name} current={profile.display_name} />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">わたしのキャン活</h2>
          <p className="text-sm text-stone-600">
            {checkins.length}件・{campsiteCount}か所のキャンプ場
          </p>
        </div>
        {checkins.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
            まだキャン活がありません。<Link href="/" className="text-emerald-700 underline">キャンプ場をさがす</Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {checkins.map((c) => (
              <CheckinCard
                key={c.id}
                checkin={c}
                heading={
                  <Link href={`/campsites/${c.campsites.slug}`} className="text-emerald-800 underline-offset-4 hover:underline">
                    {c.campsites.name}
                  </Link>
                }
                actions={<CheckinOwnerActions id={c.id} campsiteId={c.campsite_id} />}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
