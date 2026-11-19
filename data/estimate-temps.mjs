// 気温が「わからない」ソト活に、気象データ（Open-Meteo）からの推定最低気温を付けるSQLを作る。
// 投稿・編集のときは自動で付くので、これはそれより前の投稿やテストデータに付けるときに使う。
// 使い方: node --env-file=.env.local data/estimate-temps.mjs
//   → data/estimate_temps_YYYYMMDD.sql を作る。Supabase の SQL エディタで実行する
//
// ・読むのは公開データだけ（Publishable key）。DB は書き換えない（SQL を作るだけ）
// ・夜 = 1泊目の18時から、帰る日の朝9時まで（日本時間）。src/lib/weather.ts と同じ決め方
// ・キャンプ場に座標がない投稿、すでに推定値がある投稿は飛ばす
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Supabase の URL とキーがありません。node --env-file=.env.local data/estimate-temps.mjs で実行してください");
  process.exit(1);
}

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const RECENT_DAYS = 10;

const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 直近10日は予報API、それより前は過去データAPI。取れなかったらもう一方でも試す
async function estimate(lat, lng, visitedOn, nights) {
  const recent = visitedOn >= addDays(today, -RECENT_DAYS);
  const [first, second] = recent ? [FORECAST_URL, ARCHIVE_URL] : [ARCHIVE_URL, FORECAST_URL];
  return (await fetchMin(first, lat, lng, visitedOn, nights)) ?? (await fetchMin(second, lat, lng, visitedOn, nights));
}

async function fetchMin(base, lat, lng, visitedOn, nights) {
  const checkout = addDays(visitedOn, nights);
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "temperature_2m",
    timezone: "Asia/Tokyo",
    start_date: visitedOn,
    end_date: checkout,
  });
  const res = await fetch(`${base}?${params}`);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const from = `${visitedOn}T18:00`;
  const to = `${checkout}T09:00`;
  const temps = (json.hourly?.time ?? []).flatMap((t, i) => {
    const v = json.hourly.temperature_2m[i];
    return t >= from && t <= to && v != null ? [v] : [];
  });
  if (temps.length === 0) return null;
  const min = Math.round(Math.min(...temps) * 10) / 10;
  return min >= -40 && min <= 45 ? min : null;
}

// 気温が空で、推定値もまだない投稿（キャンプ場の座標と一緒に）
const res = await fetch(
  `${url}/rest/v1/checkins?select=id,visited_on,nights,campsites(lat,lng)&min_temp_c=is.null&est_min_temp_c=is.null&order=visited_on`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  console.error(`ソト活の取得に失敗しました: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const rows = await res.json();

const updates = [];
let noCoords = 0;
let failed = 0;
for (const r of rows) {
  const { lat, lng } = r.campsites ?? {};
  if (lat == null || lng == null) {
    noCoords++;
    continue;
  }
  try {
    const est = await estimate(lat, lng, r.visited_on, r.nights);
    if (est == null) failed++;
    else updates.push(`update public.checkins set est_min_temp_c = ${est}, est_fetched_at = now() where id = '${r.id}' and min_temp_c is null;`);
  } catch (e) {
    failed++;
    console.error(`  ${r.id}（${r.visited_on}）: 取得できませんでした ${e.message}`);
  }
  await sleep(150); // Open-Meteo の回数制限（1分600回）に余裕をもたせる
}

const out = join(dirname(new URL(import.meta.url).pathname), `estimate_temps_${today.replaceAll("-", "")}.sql`);
writeFileSync(
  out,
  `-- 気温が「わからない」ソト活に、気象データ（Open-Meteo）からの推定最低気温を付ける（node data/estimate-temps.mjs で作った）
-- Supabase の SQL エディタで実行する。本人があとから気温を入れた投稿は変えない（min_temp_c is null の条件）

begin;

${updates.join("\n")}

commit;

-- 確認用：推定値が付いたソト活の数
select count(*) filter (where est_min_temp_c is not null) as estimated,
       count(*) filter (where min_temp_c is null and est_min_temp_c is null) as still_empty
from public.checkins;
`,
);
console.log(`SQL を作りました: ${out}`);
console.log(`  推定値を付ける: ${updates.length} 件／座標がないキャンプ場: ${noCoords} 件／取れなかった: ${failed} 件`);
