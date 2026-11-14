import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { MAX_CAMPSITE_IMAGES } from "@/lib/campsite-images";
import { getCampsites } from "@/lib/campsites";

export const metadata = { title: "管理", robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const supabase = await requireAdmin();
  const [campsites, { data: images }, { data: consented }] = await Promise.all([
    getCampsites(),
    supabase.from("campsite_images").select("campsite_id"),
    // 紹介写真への採用を許可している、写真付きのキャン活
    supabase.from("checkins").select("campsite_id, checkin_photos!inner(id)").eq("photo_reuse_ok", true),
  ]);
  const imageCount = new Map<string, number>();
  for (const r of images ?? []) imageCount.set(r.campsite_id, (imageCount.get(r.campsite_id) ?? 0) + 1);
  const candidateCount = new Map<string, number>();
  for (const r of consented ?? []) {
    candidateCount.set(r.campsite_id, (candidateCount.get(r.campsite_id) ?? 0) + r.checkin_photos.length);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">管理</h1>
        <p className="mt-1 text-sm text-stone-600">
          キャンプ場の紹介写真を登録します。写真は「自分で撮った写真」か「投稿者が許可したキャン活の写真」だけを使います。
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">キャンプ場の写真</h2>
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {campsites.map((c) => {
            const count = imageCount.get(c.id) ?? 0;
            const candidates = candidateCount.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/campsites/${c.slug}/images`}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-stone-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="text-xs text-stone-500">{c.prefecture}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className={count === 0 ? "text-stone-400" : "font-bold"}>
                      {count} / {MAX_CAMPSITE_IMAGES}枚
                    </span>
                    {candidates > 0 && (
                      <span className="block text-xs text-amber-800">採用できるキャン活写真 {candidates}枚</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 今後：ユーザーからのキャンプ場登録申請の確認をここに足す */}
    </div>
  );
}
