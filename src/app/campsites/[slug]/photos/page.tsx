import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCampsiteImages } from "@/lib/campsite-images";
import { getCampsite, getCampsites } from "@/lib/campsites";

export async function generateStaticParams() {
  const campsites = await getCampsites();
  return campsites.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: PageProps<"/campsites/[slug]/photos">) {
  const { slug } = await props.params;
  const campsite = await getCampsite(slug);
  return { title: campsite ? `${campsite.name}の写真` : "キャンプ場が見つかりません" };
}

type Props = PageProps<"/campsites/[slug]/photos">;

export default function CampsitePhotosPage(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
      <PhotosContent params={props.params} />
    </Suspense>
  );
}

/** キャンプ場の写真をすべて表示する（運営が登録した写真だけ） */
async function PhotosContent({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const campsite = await getCampsite(slug);
  if (!campsite) notFound();
  const images = await getCampsiteImages(campsite.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/campsites/${campsite.slug}`} className="text-sm text-emerald-700 underline">
          ← {campsite.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          {campsite.name}の写真 <span className="text-base font-normal text-stone-500">{images.length}枚</span>
        </h1>
      </div>
      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          まだ写真がありません。
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {images.map((img, i) => (
            <li key={img.id}>
              <figure className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`${campsite.name}の写真 ${i + 1}`}
                  loading={i < 2 ? "eager" : "lazy"}
                  className="aspect-[4/3] w-full rounded-lg bg-stone-200 object-cover"
                />
                <figcaption className="text-xs text-stone-500">{img.credit}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
