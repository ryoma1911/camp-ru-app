// 気象データ（Open-Meteo）から、キャンプ場の座標での夜の最低気温を推定する。
// ソト活の「夜の最低気温」が「わからない」ときに、保存のタイミングで1回だけ取りに行って DB に残す。
// ・夜 = 1泊目の18時から、帰る日の朝9時まで（日本時間）。連泊ならその間でいちばん低い値
// ・Open-Meteo は標高を考えて補正した、約1〜10km四方の格子の値。現地の実測とはずれることがある
// ・APIキーは不要。無料で使えるのは非商用の範囲（収益化するときは有料プランを検討する）
import "server-only";
import { addDays } from "@/lib/stay";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
// 過去データAPIは数日遅れで値が入る。直近10日は予報API、それより前は過去データAPIを使い、
// 取れなかったらもう一方でも試す（予報APIは古い日を受け付けても値が空のことがある）
const RECENT_DAYS = 10;

const todayInJapan = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());

/**
 * 夜の最低気温の推定値（0.1℃単位）。座標がない・取れなかったときは null（投稿は止めない）
 * visitedOn は1泊目の日（'YYYY-MM-DD'）
 */
export async function estimateNightMinTemp(
  lat: number | null,
  lng: number | null,
  visitedOn: string,
  nights: number,
): Promise<number | null> {
  if (lat == null || lng == null) return null;
  const recent = visitedOn >= addDays(todayInJapan(), -RECENT_DAYS);
  const [first, second] = recent ? [FORECAST_URL, ARCHIVE_URL] : [ARCHIVE_URL, FORECAST_URL];
  return (await fetchMin(first, lat, lng, visitedOn, nights)) ?? (await fetchMin(second, lat, lng, visitedOn, nights));
}

async function fetchMin(base: string, lat: number, lng: number, visitedOn: string, nights: number): Promise<number | null> {
  const checkout = addDays(visitedOn, nights);
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "temperature_2m",
    timezone: "Asia/Tokyo",
    start_date: visitedOn,
    end_date: checkout,
  });
  try {
    const res = await fetch(`${base}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.error("open-meteo request failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as { hourly?: { time: string[]; temperature_2m: (number | null)[] } };
    const from = `${visitedOn}T18:00`;
    const to = `${checkout}T09:00`;
    const temps = (json.hourly?.time ?? []).flatMap((t, i) => {
      const v = json.hourly?.temperature_2m[i];
      return t >= from && t <= to && v != null ? [v] : [];
    });
    if (temps.length === 0) return null;
    const min = Math.round(Math.min(...temps) * 10) / 10;
    return min >= -40 && min <= 45 ? min : null;
  } catch (e) {
    console.error("open-meteo request failed", e);
    return null;
  }
}
