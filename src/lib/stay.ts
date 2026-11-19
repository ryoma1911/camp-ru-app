// ソト活の滞在（1泊目の日と泊数）と、気温の言い方。サーバーとブラウザの両方で使う
import type { Checkin } from "@/lib/labels";

/** 'YYYY-MM-DD' に days 日足した日（日付だけを扱うので UTC で計算する） */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 「2026/11/14」、連泊なら「2026/11/14〜11/16（2泊）」（年をまたぐときは帰りの日にも年を付ける） */
export function stayLabel(c: Pick<Checkin, "visited_on" | "nights">): string {
  const from = c.visited_on.replaceAll("-", "/");
  if (c.nights <= 1) return from;
  const to = addDays(c.visited_on, c.nights);
  const toLabel = to.slice(0, 4) === c.visited_on.slice(0, 4) ? to.slice(5).replace("-", "/") : to.replaceAll("-", "/");
  return `${from}〜${toLabel}（${c.nights}泊）`;
}

/**
 * カードに出す気温。本人の記録があればそれ、なければ気象データの推定値（estimated = true）。
 * どちらもなければ null
 */
export function tempOf(
  c: Pick<Checkin, "min_temp_c" | "est_min_temp_c" | "temp_at_dawn">,
): { label: string; value: number; estimated: boolean } | null {
  if (c.min_temp_c != null) return { label: c.temp_at_dawn ? "明け方" : "最低", value: Number(c.min_temp_c), estimated: false };
  if (c.est_min_temp_c != null) return { label: "最低", value: Number(c.est_min_temp_c), estimated: true };
  return null;
}

export const EST_TEMP_NOTE = "気温の記録がないため、気象データ（Open-Meteo）からこの場所の夜の最低気温を推定しています";
