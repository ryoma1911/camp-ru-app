"use client";

import { useRef, useState } from "react";
import type { CampsiteImage } from "@/lib/campsite-images";

/** スマホ用：横にスワイプして見る写真。右上に「1/N」を出す */
export function GallerySwiper({ images, name }: { images: CampsiteImage[]; name: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);

  return (
    <div className="relative -mx-4">
      <ul
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
      >
        {images.map((img, i) => (
          <li key={img.id} className="relative aspect-[4/3] w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`${name}の写真 ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
            <Credit text={img.credit} />
          </li>
        ))}
      </ul>
      {images.length > 1 && (
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
          {index + 1}/{images.length}
        </span>
      )}
    </div>
  );
}

export function Credit({ text }: { text: string }) {
  return (
    <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-1.5 pt-4 text-[11px] text-white">
      {text}
    </span>
  );
}
