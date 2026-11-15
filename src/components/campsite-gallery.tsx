import Link from "next/link";
import type { CampsiteImage } from "@/lib/campsite-images";
import { Credit, GallerySwiper } from "./gallery-swiper";

/**
 * キャンプ場ページの上部の写真（運営が登録した写真だけ。ソト活の写真は投稿の中にだけ出す）。
 * PC：大きい写真1枚＋小さい写真4枚。スマホ：横スワイプ。写真がなければ何も出さない
 */
export function CampsiteGallery({ images, name, slug }: { images: CampsiteImage[]; name: string; slug: string }) {
  if (images.length === 0) return null;
  const allHref = `/campsites/${slug}/photos`;
  const [cover, ...rest] = images;
  // 4枚以下のときは右の列を2枚にして、空きのマスができないようにする
  const small = rest.slice(0, images.length >= 5 ? 4 : 2);

  return (
    <section aria-label="キャンプ場の写真" className="space-y-2">
      <div className="sm:hidden">
        <GallerySwiper images={images} name={name} />
      </div>

      <div
        className={`relative hidden h-80 gap-1.5 overflow-hidden rounded-xl sm:grid ${
          small.length === 0 ? "grid-cols-1" : small.length <= 2 ? "grid-cols-3 grid-rows-2" : "grid-cols-4 grid-rows-2"
        }`}
      >
        <Tile image={cover} alt={`${name}の写真 1`} className="col-span-2 row-span-2" big />
        {small.map((img, i) => (
          <Tile
            key={img.id}
            image={img}
            alt={`${name}の写真 ${i + 2}`}
            // 写真が2枚だけのときは、右の1枚を縦いっぱいにする
            className={small.length === 1 ? "row-span-2" : ""}
          />
        ))}
        {images.length > 1 && (
          <Link
            href={allHref}
            className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-stone-800 shadow hover:bg-white"
          >
            すべて見る（{images.length}枚）
          </Link>
        )}
      </div>

      {images.length > 1 && (
        <p className="text-right sm:hidden">
          <Link href={allHref} className="text-xs text-emerald-700 underline">
            写真をすべて見る（{images.length}枚）
          </Link>
        </p>
      )}
    </section>
  );
}

function Tile({ image, alt, className, big }: { image: CampsiteImage; alt: string; className: string; big?: boolean }) {
  return (
    <div className={`relative min-h-0 bg-stone-200 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={alt} loading={big ? "eager" : "lazy"} className="h-full w-full object-cover" />
      {/* 小さいマスは文字が読めないので、撮影者は大きい写真と「すべて見る」のページに出す */}
      {big && <Credit text={image.credit} />}
    </div>
  );
}
