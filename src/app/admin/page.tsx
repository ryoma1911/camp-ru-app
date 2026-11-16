import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { MAX_CAMPSITE_IMAGES } from "@/lib/campsite-images";
import { getCampsites } from "@/lib/campsites";

export const metadata = { title: "管理", robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-3xl text-sm text-stone-500">読み込み中…</p>}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const supabase = await requireAdmin();
  const [campsites, { data: images }, { data: consented }, { count: pendingCount }] = await Promise.all([
    getCampsites(),
    supabase.from("campsite_images").select("campsite_id"),
    // 紹介写真への採用を許可している、写真付きのソト活
    supabase.from("checkins").select("campsite_id, checkin_photos!inner(id)").eq("photo_reuse_ok", true),
    supabase.from("campsite_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const imageCount = new Map<string, number>();
  for (const r of images ?? []) imageCount.set(r.campsite_id, (imageCount.get(r.campsite_id) ?? 0) + 1);
  const candidateCount = new Map<string, number>();
  for (const r of consented ?? []) {
    candidateCount.set(r.campsite_id, (candidateCount.get(r.campsite_id) ?? 0) + r.checkin_photos.length);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">管理</h1>
      </div>

      <Link
        href="/admin/submissions"
        className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 hover:bg-stone-50"
      >
        <span>
          <span className="block font-bold">キャンプ場登録の申請</span>
          <span className="text-xs text-stone-500">ユーザーからの申請を確認して公開します</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${pendingCount ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-500"}`}
        >
          確認待ち {pendingCount ?? 0}件
        </span>
      </Link>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">キャンプ場の写真・設備・地図</h2>
        <p className="text-sm text-stone-600">
          写真は「自分で撮った写真」か「投稿者が許可したソト活の写真」だけを使います。
        </p>
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {campsites.map((c) => {
            const count = imageCount.get(c.id) ?? 0;
            const candidates = candidateCount.get(c.id) ?? 0;
            return (
              <li key={c.id} className="flex items-center gap-2 p-2 pl-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="text-xs text-stone-500">{c.prefecture}</span>
                </span>
                <Link
                  href={`/admin/campsites/${c.slug}/images`}
                  className="shrink-0 rounded-lg px-3 py-2 text-right text-sm hover:bg-stone-50"
                >
                  <span className="text-xs text-stone-500">写真 </span>
                  <span className={count === 0 ? "text-stone-400" : "font-bold"}>
                    {count} / {MAX_CAMPSITE_IMAGES}枚
                  </span>
                  {candidates > 0 && (
                    <span className="block text-xs text-amber-800">採用できるソト活写真 {candidates}枚</span>
                  )}
                </Link>
                <Link
                  href={`/admin/campsites/${c.slug}/edit`}
                  className="shrink-0 rounded-full border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
                >
                  設備・地図
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

    </div>
  );
}
