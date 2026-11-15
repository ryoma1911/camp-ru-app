import Link from "next/link";
import type { CheckinSummary } from "@/lib/campsite-stats";
import { LOCATION_TYPE, type Campsite } from "@/lib/labels";
import { CampsiteThumb } from "./campsite-thumb";

export type ShelfItem = {
  campsite: Campsite;
  summary?: CheckinSummary;
  /** カバー写真の URL（運営が登録した写真だけ。ソト活の写真は使わない） */
  cover?: string;
  isNew?: boolean;
};

const PEG_SHORT = { plastic: "プラペグ", steel: "スチール", forged: "鍛造", rocky: "石が多い" } as const;

/**
 * トップの「おすすめ」「最近登録された」の欄。
 * PC は 3枚×2段、スマホは横スクロール（右端のカードが切れて見え、続きがあるとわかる）
 */
export function CampsiteShelf({
  title,
  note,
  moreHref,
  items,
  month,
}: {
  title: string;
  note: string;
  moreHref: string;
  items: ShelfItem[];
  month: number;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">
          {title}
          <span className="block text-xs font-normal text-stone-500 sm:ml-2 sm:inline">{note}</span>
        </h2>
        <Link href={moreHref} className="shrink-0 text-sm text-emerald-700 underline">
          もっと見る →
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.campsite.id} className="w-[72%] shrink-0 snap-start sm:w-auto">
            <ShelfCard item={item} month={month} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShelfCard({ item: { campsite: c, summary: s, cover, isNew }, month }: { item: ShelfItem; month: number }) {
  const monthAvg = s?.monthAvgTemp[month];
  const temp = monthAvg != null ? `${month}月 平均${monthAvg}℃` : s?.coldest != null ? `最低${s.coldest}℃` : null;
  return (
    <Link href={`/campsites/${c.slug}`} className="block h-full overflow-hidden rounded-xl border border-stone-200 bg-white hover:bg-stone-50">
      <div className="relative h-28">
        <CampsiteThumb campsite={c} cover={cover} className="h-full w-full" />
        {isNew ? (
          <span className="absolute left-2 top-2 rounded-full bg-amber-700 px-2 py-0.5 text-xs font-bold text-white">NEW</span>
        ) : s ? (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-emerald-900">
            ソト活 {s.count}件
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate font-bold">{c.name}</p>
        <p className="text-xs text-stone-500">
          {c.prefecture}・{LOCATION_TYPE[c.location_type]}
        </p>
        {s ? (
          <p className="truncate rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
            {[temp, s.topPeg ? PEG_SHORT[s.topPeg] : null, s.windSkipRate != null ? `焚き火控え ${s.windSkipRate}%` : null]
              .filter(Boolean)
              .join("・")}
          </p>
        ) : (
          <p className="text-xs text-stone-400">ソト活はまだありません・最初の投稿をしよう</p>
        )}
      </div>
    </Link>
  );
}
