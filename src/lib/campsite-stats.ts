import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ALL_CHECKINS_TAG, SUMMARIES_TAG, checkinsTag } from "@/lib/campsites";
import { FIRE_STATUS, HEATER, PARTY_TYPE, PEG_NEEDED, SLEEP_QUALITY } from "@/lib/labels";
import { createSupabasePublicClient } from "@/lib/supabase/server";

type Row = {
  visited_on: string;
  min_temp_c: number | null;
  sleeping_bag_comfort_c: number | null;
  sleep_quality: keyof typeof SLEEP_QUALITY | null;
  peg_needed: keyof typeof PEG_NEEDED;
  fire_status: keyof typeof FIRE_STATUS;
  bug_level: number | null;
  party_type: keyof typeof PARTY_TYPE | null;
  heaters: (keyof typeof HEATER)[] | null;
};

/** 虫の棒グラフの名前（棒の見出しが「虫」なので短く） */
export const BUG_BARS = { "1": "少ない", "2": "ふつう", "3": "多い" } as const;

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
  peg: Breakdown<keyof typeof PEG_NEEDED>;
  fire: Breakdown<keyof typeof FIRE_STATUS>;
  /** 虫（少ない/ふつう/多い）。total は虫を記録した投稿の数 */
  bug: { items: Breakdown<keyof typeof BUG_BARS>; total: number };
  /** 誰と行ったか。total は記録した投稿の数 */
  party: { items: Breakdown<keyof typeof PARTY_TYPE>; total: number };
  /** 使った暖房（1件の投稿で複数あれば、それぞれ数える）。total は記録した投稿の数 */
  heaters: { items: Breakdown<keyof typeof HEATER>; total: number };
  months: MonthStat[];
  sleep: SleepStat[];
};

function breakdown<K extends string>(labels: Record<K, string>, values: K[]): Breakdown<K> {
  return (Object.keys(labels) as K[])
    .map((key) => ({ key, count: values.filter((v) => v === key).length }))
    .sort((a, b) => b.count - a.count);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

type SummaryRow = Pick<Row, "visited_on" | "min_temp_c" | "peg_needed" | "fire_status">;

/** トップの一覧に出す、キャンプ場ごとの簡易集計 */
export type CheckinSummary = {
  count: number;
  coldest: number | null;
  coldestMonth: number | null;
  topPeg: keyof typeof PEG_NEEDED | null;
  /** 焚き火をしようとした日のうち、風で控えた割合（%）。しようとした日がなければ null */
  windSkipRate: number | null;
  /** 月（1〜12）ごとの明け方の最低気温の平均。記録のない月は入らない */
  monthAvgTemp: Record<number, number>;
  /** 月（1〜12）ごとのソト活の件数（「今月に行く人に人気」の判定に使う） */
  monthCount: Record<number, number>;
};

/**
 * 全キャンプ場の簡易集計をまとめて作る（一覧で1件ずつ問い合わせないため）。
 * MVP の規模なら必要な列だけ全件取れば十分。投稿が数万件になったら SQL のビューに移す
 */
export async function getCheckinSummaries(): Promise<Record<string, CheckinSummary>> {
  "use cache";
  cacheLife("hours");
  cacheTag(SUMMARIES_TAG, ALL_CHECKINS_TAG);

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("campsite_id, visited_on, min_temp_c, peg_needed, fire_status");
  if (error) throw new Error(`集計の取得に失敗しました: ${error.message}`);

  const groups = new Map<string, SummaryRow[]>();
  for (const r of (data ?? []) as (SummaryRow & { campsite_id: string })[]) {
    groups.set(r.campsite_id, [...(groups.get(r.campsite_id) ?? []), r]);
  }

  const result: Record<string, CheckinSummary> = {};
  for (const [campsiteId, rows] of groups) {
    let coldest: number | null = null;
    let coldestMonth: number | null = null;
    for (const r of rows) {
      if (r.min_temp_c == null) continue;
      const t = Number(r.min_temp_c);
      if (coldest == null || t < coldest) {
        coldest = t;
        coldestMonth = Number(r.visited_on.slice(5, 7));
      }
    }
    const monthTemps = new Map<number, number[]>();
    for (const r of rows) {
      if (r.min_temp_c == null) continue;
      const m = Number(r.visited_on.slice(5, 7));
      monthTemps.set(m, [...(monthTemps.get(m) ?? []), Number(r.min_temp_c)]);
    }
    const monthAvgTemp = Object.fromEntries(
      [...monthTemps].map(([m, ts]) => [m, round1(ts.reduce((a, b) => a + b, 0) / ts.length)]),
    );
    const peg = breakdown(PEG_NEEDED, rows.map((r) => r.peg_needed))[0];
    const done = rows.filter((r) => r.fire_status === "done").length;
    const skipped = rows.filter((r) => r.fire_status === "skipped_wind").length;
    const monthCount: Record<number, number> = {};
    for (const r of rows) {
      const m = Number(r.visited_on.slice(5, 7));
      monthCount[m] = (monthCount[m] ?? 0) + 1;
    }
    result[campsiteId] = {
      count: rows.length,
      monthCount,
      coldest,
      coldestMonth,
      topPeg: peg?.count ? peg.key : null,
      monthAvgTemp,
      windSkipRate: done + skipped ? Math.round((skipped / (done + skipped)) * 100) : null,
    };
  }
  return result;
}

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
      "visited_on, min_temp_c, sleeping_bag_comfort_c, sleep_quality, peg_needed, fire_status, bug_level, party_type, heaters",
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

  const bugs = rows.flatMap((r) => (r.bug_level != null ? [String(r.bug_level) as keyof typeof BUG_BARS] : []));
  const parties = rows.flatMap((r) => (r.party_type ? [r.party_type] : []));
  const heaterRows = rows.filter((r) => r.heaters?.length);

  return {
    total: rows.length,
    peg: breakdown(PEG_NEEDED, rows.map((r) => r.peg_needed)),
    fire: breakdown(FIRE_STATUS, rows.map((r) => r.fire_status)),
    bug: { items: breakdown(BUG_BARS, bugs), total: bugs.length },
    party: { items: breakdown(PARTY_TYPE, parties), total: parties.length },
    heaters: { items: breakdown(HEATER, heaterRows.flatMap((r) => r.heaters ?? [])), total: heaterRows.length },
    months,
    sleep: [...sleepMap.values()].sort((a, b) => a.month - b.month || a.bagBand - b.bagBand),
  };
}
