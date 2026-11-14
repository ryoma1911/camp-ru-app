import { LOCATION_TYPE, type Campsite } from "@/lib/labels";

// カバー写真がないときの背景（キャンプ場の種類ごとの色。文字は同じ色の濃い色）
const TYPE_STYLE: Record<keyof typeof LOCATION_TYPE, string> = {
  forest: "bg-emerald-100 text-emerald-900",
  river: "bg-sky-100 text-sky-900",
  lake: "bg-cyan-100 text-cyan-900",
  highland: "bg-lime-100 text-lime-900",
  sea: "bg-blue-100 text-blue-900",
  meadow: "bg-green-100 text-green-900",
  view: "bg-indigo-100 text-indigo-900",
};

/**
 * キャンプ場のカバー写真（運営が登録した写真の1枚目）。なければ種類の色に種類名を出す。
 * 大きさは呼び出し側の className で決める
 */
export function CampsiteThumb({
  campsite,
  cover,
  className = "",
  labelClassName = "text-2xl",
}: {
  campsite: Pick<Campsite, "location_type">;
  cover?: string | null;
  className?: string;
  labelClassName?: string;
}) {
  if (cover) {
    return (
      // Supabase Storage の公開URLをそのまま表示（MVPでは画像最適化は使わない）
      // eslint-disable-next-line @next/next/no-img-element
      <img src={cover} alt="" loading="lazy" className={`object-cover ${className}`} />
    );
  }
  return (
    <div
      className={`flex items-center justify-center font-bold ${TYPE_STYLE[campsite.location_type]} ${labelClassName} ${className}`}
    >
      {LOCATION_TYPE[campsite.location_type]}
    </div>
  );
}
