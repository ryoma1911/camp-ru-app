import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adoptCheckinPhoto, deleteImage, moveImage, updateCredit } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { requireAdmin } from "@/lib/admin";
import { MAX_CAMPSITE_IMAGES, loadCampsiteImages } from "@/lib/campsite-images";
import { getCampsite, getCampsites } from "@/lib/campsites";
import { storageUrl } from "@/lib/image-url";
import { ImageUploader } from "./image-uploader";

export const metadata = { title: "キャンプ場の写真の管理", robots: { index: false } };

export async function generateStaticParams() {
  const campsites = await getCampsites();
  return campsites.map((c) => ({ slug: c.slug }));
}

type Props = PageProps<"/admin/campsites/[slug]/images">;

export default function AdminImagesPage(props: Props) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-3xl text-sm text-stone-500">読み込み中…</p>}>
      <AdminImagesContent params={props.params} />
    </Suspense>
  );
}

type Candidate = {
  id: string;
  storage_path: string;
  checkins: { visited_on: string; profiles: { display_name: string } | null };
};

async function AdminImagesContent({ params }: Pick<Props, "params">) {
  const supabase = await requireAdmin();
  const { slug } = await params;
  const campsite = await getCampsite(slug);
  if (!campsite) notFound();

  const [images, { data: adopted }, { data: candidateRows }] = await Promise.all([
    loadCampsiteImages(supabase, campsite.id),
    supabase.from("campsite_images").select("checkin_photo_id").eq("campsite_id", campsite.id),
    supabase
      .from("checkin_photos")
      .select("id, storage_path, checkins!inner(visited_on, campsite_id, photo_reuse_ok, profiles(display_name))")
      .eq("checkins.campsite_id", campsite.id)
      .eq("checkins.photo_reuse_ok", true),
  ]);
  const adoptedIds = new Set((adopted ?? []).map((r) => r.checkin_photo_id));
  const candidates = ((candidateRows ?? []) as unknown as Candidate[])
    .filter((p) => !adoptedIds.has(p.id))
    .sort((a, b) => b.checkins.visited_on.localeCompare(a.checkins.visited_on));
  const room = MAX_CAMPSITE_IMAGES - images.length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-emerald-700 underline">
          ← 管理
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{campsite.name}の写真</h1>
        <p className="mt-1 text-sm text-stone-600">
          一番上がカバー写真です（トップのカード・検索結果・キャンプ場ページの大きい写真）。
          <Link href={`/campsites/${campsite.slug}`} className="ml-1 text-emerald-700 underline">
            キャンプ場ページを見る
          </Link>
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          登録している写真 <span className="text-sm font-normal text-stone-500">{images.length} / {MAX_CAMPSITE_IMAGES}枚</span>
        </h2>
        {images.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
            まだ写真がありません。カードと検索結果には、キャンプ場の種類の色が表示されています。
          </p>
        ) : (
          <ol className="space-y-3">
            {images.map((img, i) => (
              <li key={img.id} className="flex gap-3 rounded-lg border border-stone-200 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-24 w-32 shrink-0 rounded object-cover sm:h-28 sm:w-40" />
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    {i === 0 && <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white">カバー</span>}
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">
                      {img.source === "own" ? "自分で撮った写真" : "キャン活から採用"}
                    </span>
                    <span className="text-xs text-stone-500">{img.credit}</span>
                  </p>
                  {img.source === "own" && (
                    <form action={updateCredit.bind(null, img.id)} className="flex gap-2">
                      <input
                        name="credit"
                        defaultValue={img.rawCredit ?? ""}
                        maxLength={40}
                        placeholder="撮影者（空なら「Campる」）"
                        aria-label="撮影者の表示"
                        className="h-9 min-w-0 flex-1 rounded border border-stone-300 px-2"
                      />
                      <button className="h-9 shrink-0 rounded-full border border-stone-300 px-3 hover:bg-stone-100">保存</button>
                    </form>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <form action={moveImage.bind(null, campsite.id, img.id, -1)}>
                      <button
                        disabled={i === 0}
                        className="h-9 rounded-full border border-stone-300 px-3 hover:bg-stone-100 disabled:opacity-30"
                      >
                        ↑ 上へ
                      </button>
                    </form>
                    <form action={moveImage.bind(null, campsite.id, img.id, 1)}>
                      <button
                        disabled={i === images.length - 1}
                        className="h-9 rounded-full border border-stone-300 px-3 hover:bg-stone-100 disabled:opacity-30"
                      >
                        ↓ 下へ
                      </button>
                    </form>
                    <form action={deleteImage.bind(null, img.id)}>
                      <ConfirmButton
                        message={
                          img.source === "own"
                            ? "この写真を削除しますか？ファイルも消え、元に戻せません。"
                            : "この写真を紹介写真から外しますか？（投稿の写真はそのまま残ります）"
                        }
                        className="h-9 rounded-full border border-red-300 px-3 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {img.source === "own" ? "削除" : "外す"}
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-bold">自分で撮った写真を追加</h2>
        <ImageUploader campsiteId={campsite.id} room={room} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">キャン活から採用</h2>
        <p className="text-sm text-stone-600">
          投稿者が「紹介写真に使ってよい」と許可した写真だけが並びます。投稿が消されたり許可が外されたりすると、紹介写真からも自動で外れます。
        </p>
        {candidates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
            採用できる写真はありません。
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {candidates.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={storageUrl("checkin-photos", p.storage_path)} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="space-y-2 p-2 text-xs">
                  <p className="text-stone-600">
                    {p.checkins.profiles?.display_name ?? "キャンパー"}・{p.checkins.visited_on.replaceAll("-", "/")}
                  </p>
                  <form action={adoptCheckinPhoto.bind(null, campsite.id, p.id)}>
                    <button
                      disabled={room <= 0}
                      className="h-9 w-full rounded-full bg-emerald-700 font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
                    >
                      採用する
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
