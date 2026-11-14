import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ALL_CHECKINS_TAG, checkinsTag } from "@/lib/campsites";
import { FIRE_STATUS, GROUND_TYPE, PEG_NEEDED, SLEEP_QUALITY } from "@/lib/labels";
import { createSupabasePublicClient } from "@/lib/supabase/server";

type Row = {
  visited_on: string;
  min_temp_c: number | null;
  sleeping_bag_comfort_c: number | null;
  sleep_quality: keyof typeof SLEEP_QUALITY | null;
  ground_type: keyof typeof GROUND_TYPE;
  peg_needed: keyof typeof PEG_NEEDED;
  fire_status: keyof typeof FIRE_STATUS;
  bug_level: number | null;
  car_access_ok: boolean | null;
  hot_water_ok: boolean | null;
};

/** 選択肢ごとの件数（多い順）。0件の選択肢も残して分布を表示できるようにする */
export type Breakdown<K extends string> = { key: K; count: number }[];

export type MonthStat = {
  month: number; // 1〜12
  checkinCount: number;
  tempCount: number; // 気温が入っている件数
  avgMinTemp: number | null;
  coldest: number | null;
};

export type SleepStat = {
  month: number;
  bagBand: number; // 寝袋の快適温度を5℃刻みにした下限（例: -5 → -5〜-1℃）
  count: number;
  comfortable: number;
};

export type CampsiteStats = {
  total: number;
  ground: Breakdown<keyof typeof GROUND_TYPE>;
  peg: Breakdown<keyof typeof PEG_NEEDED>;
  fire: Breakdown<keyof typeof FIRE_STATUS>;
  bug: { count: number; avg: number | null };
  hotWater: { yes: number; no: number };
  carAccess: { yes: number; no: number };
  months: MonthStat[];
  sleep: SleepStat[];
};

function breakdown<K extends string>(labels: Record<K, string>, values: K[]): Breakdown<K> {
  return (Object.keys(labels) as K[])
    .map((key) => ({ key, count: values.filter((v) => v === key).length }))
    .sort((a, b) => b.count - a.count);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * キャンプ場の現地コンディションの集計。投稿数はキャンプ場ごとに多くても数百件なので、
 * 必要な列だけ取ってアプリ側で数える（投稿・編集・削除・ニックネーム変更で入れ替わる）
 */
export async function getCampsiteStats(campsiteId: string): Promise<CampsiteStats> {
  "use cache";
  cacheLife("hours");
  cacheTag(checkinsTag(campsiteId), ALL_CHECKINS_TAG);

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("checkins")
    .select(
      "visited_on, min_temp_c, sleeping_bag_comfort_c, sleep_quality, ground_type, peg_needed, fire_status, bug_level, car_access_ok, hot_water_ok",
    )
    .eq("campsite_id", campsiteId);
  if (error) throw new Error(`集計の取得に失敗しました: ${error.message}`);
  const rows = (data ?? []) as Row[];

  const months: MonthStat[] = Array.from({ length: 12 }, (_, i) => {
    const inMonth = rows.filter((r) => Number(r.visited_on.slice(5, 7)) === i + 1);
    const temps = inMonth.map((r) => r.min_temp_c).filter((t): t is number => t != null).map(Number);
    return {
      month: i + 1,
      checkinCount: inMonth.length,
      tempCount: temps.length,
      avgMinTemp: temps.length ? round1(temps.reduce((a, b) => a + b, 0) / temps.length) : null,
      coldest: temps.length ? Math.min(...temps) : null,
    };
  });

  const sleepMap = new Map<string, SleepStat>();
  for (const r of rows) {
    if (r.sleeping_bag_comfort_c == null || !r.sleep_quality) continue;
    const month = Number(r.visited_on.slice(5, 7));
    const bagBand = Math.floor(r.sleeping_bag_comfort_c / 5) * 5;
    const key = `${month}:${bagBand}`;
    const s = sleepMap.get(key) ?? { month, bagBand, count: 0, comfortable: 0 };
    s.count++;
    if (r.sleep_quality === "comfortable") s.comfortable++;
    sleepMap.set(key, s);
  }

  const bugs = rows.map((r) => r.bug_level).filter((b): b is number => b != null);

  return {
    total: rows.length,
    ground: breakdown(GROUND_TYPE, rows.map((r) => r.ground_type)),
    peg: breakdown(PEG_NEEDED, rows.map((r) => r.peg_needed)),
    fire: breakdown(FIRE_STATUS, rows.map((r) => r.fire_status)),
    bug: { count: bugs.length, avg: bugs.length ? round1(bugs.reduce((a, b) => a + b, 0) / bugs.length) : null },
    hotWater: {
      yes: rows.filter((r) => r.hot_water_ok === true).length,
      no: rows.filter((r) => r.hot_water_ok === false).length,
    },
    carAccess: {
      yes: rows.filter((r) => r.car_access_ok === true).length,
      no: rows.filter((r) => r.car_access_ok === false).length,
    },
    months,
    sleep: [...sleepMap.values()].sort((a, b) => a.month - b.month || a.bagBand - b.bagBand),
  };
}
