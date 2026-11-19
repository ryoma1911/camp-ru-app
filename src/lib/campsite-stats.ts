import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ALL_CHECKINS_TAG, SUMMARIES_TAG, checkinsTag } from "@/lib/campsites";
import { FIRE_STATUS, HEATER, PARTY_TYPE, PEG_NEEDED, SLEEPING_BAG_TYPE } from "@/lib/labels";
import { createSupabasePublicClient } from "@/lib/supabase/server";

type Row = {
  visited_on: string;
  min_temp_c: number | null;
  est_min_temp_c: number | null;
  sleeping_bag_type: keyof typeof SLEEPING_BAG_TYPE | null;
  peg_needed: keyof typeof PEG_NEEDED;
  fire_status: keyof typeof FIRE_STATUS;
  bug_level: number | null;
  party_type: keyof typeof PARTY_TYPE | null;
  heaters: (keyof typeof HEATER)[] | null;
};

/** 虫の棒グラフの名前（棒の見出しが「虫」なので短く） */
export const BUG_BARS = { "1": "少ない", "2": "ふつう", "3": "多い" } as const;

/** 気温帯（寝袋タイプの目安 10℃・0℃・-10℃ にそろえる）。暖かい順 */
export const TEMP_BANDS = {
  warm: "10℃〜",
  mild: "0〜10℃",
  cold: "-10〜0℃",
  severe: "〜-10℃",
} as const;

const bandOf = (t: number): keyof typeof TEMP_BANDS => (t >= 10 ? "warm" : t >= 0 ? "mild" : t >= -10 ? "cold" : "severe");

/**
 * ある月の夜の最低気温。本人が入れた気温と、それがないときの気象データの推定値の両方を使う
 * （estimated = そのうち推定値の件数）。気温帯は暖かい順のまま（件数順に並べ替えない）
 */
export type MonthTemp = {
  count: number;
  estimated: number;
  avg: number | null;
  coldest: number | null;
  warmest: number | null;
  bands: Breakdown<keyof typeof TEMP_BANDS>;
};

/** 選択肢ごとの件数（多い順）。0件の選択肢も残して分布を表示できるようにする */
export type Breakdown<K extends string> = { key: K; count: number }[];

/** 選択肢ごとの件数と、その項目を記録した投稿の数（割合の分母） */
export type Tally<K extends string> = { items: Breakdown<K>; total: number };

/**
 * ある月の現地コンディション（気温・焚き火・寝袋・暖房・虫・誰と）。年をまたいで同じ月をまとめて数える。
 * 任意の項目は「わからない」（null）を数えず、記録した投稿の数を分母にする
 */
export type MonthConditions = {
  month: number; // 1〜12
  /** その月のソト活の数 */
  count: number;
  temp: MonthTemp;
  /** 焚き火（必須項目なので total はその月の投稿の数） */
  fire: Tally<keyof typeof FIRE_STATUS>;
  bag: Tally<keyof typeof SLEEPING_BAG_TYPE>;
  /** 使った暖房（1件の投稿で複数あれば、それぞれ数える） */
  heaters: Tally<keyof typeof HEATER>;
  bug: Tally<keyof typeof BUG_BARS>;
  party: Tally<keyof typeof PARTY_TYPE>;
};

export type CampsiteStats = {
  total: number;
  /** 地面の固さは月で変わりにくいので全期間で出す */
  peg: Breakdown<keyof typeof PEG_NEEDED>;
  /** いちばん冷えた記録（本人が入れた気温だけ。気象データの推定値は使わない） */
  coldest: { temp: number; month: number } | null;
  /** 気温が入っている投稿の数 */
  tempCount: number;
  /** 月ごとの現地コンディション（[0] = 1月 … [11] = 12月） */
  conditions: MonthConditions[];
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
      "visited_on, min_temp_c, est_min_temp_c, sleeping_bag_type, peg_needed, fire_status, bug_level, party_type, heaters",
    )
    .eq("campsite_id", campsiteId);
  if (error) throw new Error(`集計の取得に失敗しました: ${error.message}`);
  const rows = (data ?? []) as Row[];

  let coldest: CampsiteStats["coldest"] = null;
  let tempCount = 0;
  for (const r of rows) {
    if (r.min_temp_c == null) continue;
    tempCount++;
    const t = Number(r.min_temp_c);
    if (!coldest || t < coldest.temp) coldest = { temp: t, month: Number(r.visited_on.slice(5, 7)) };
  }

  return {
    total: rows.length,
    peg: breakdown(PEG_NEEDED, rows.map((r) => r.peg_needed)),
    coldest,
    tempCount,
    conditions: Array.from({ length: 12 }, (_, i) =>
      conditionsOf(i + 1, rows.filter((r) => Number(r.visited_on.slice(5, 7)) === i + 1)),
    ),
  };
}

function conditionsOf(month: number, rows: Row[]): MonthConditions {
  const bugs = rows.flatMap((r) => (r.bug_level != null ? [String(r.bug_level) as keyof typeof BUG_BARS] : []));
  const parties = rows.flatMap((r) => (r.party_type ? [r.party_type] : []));
  const heaterRows = rows.filter((r) => r.heaters?.length);
  const bags = rows.flatMap((r) => (r.sleeping_bag_type ? [r.sleeping_bag_type] : []));
  return {
    month,
    count: rows.length,
    temp: monthTemp(rows),
    fire: { items: breakdown(FIRE_STATUS, rows.map((r) => r.fire_status)), total: rows.length },
    bag: { items: breakdown(SLEEPING_BAG_TYPE, bags), total: bags.length },
    heaters: { items: breakdown(HEATER, heaterRows.flatMap((r) => r.heaters ?? [])), total: heaterRows.length },
    bug: { items: breakdown(BUG_BARS, bugs), total: bugs.length },
    party: { items: breakdown(PARTY_TYPE, parties), total: parties.length },
  };
}

function monthTemp(rows: Row[]): MonthTemp {
  const temps: number[] = [];
  let estimated = 0;
  for (const r of rows) {
    if (r.min_temp_c != null) temps.push(Number(r.min_temp_c));
    else if (r.est_min_temp_c != null) {
      temps.push(Number(r.est_min_temp_c));
      estimated++;
    }
  }
  return {
    count: temps.length,
    estimated,
    avg: temps.length ? round1(temps.reduce((a, b) => a + b, 0) / temps.length) : null,
    coldest: temps.length ? Math.min(...temps) : null,
    warmest: temps.length ? Math.max(...temps) : null,
    bands: (Object.keys(TEMP_BANDS) as (keyof typeof TEMP_BANDS)[]).map((key) => ({
      key,
      count: temps.filter((t) => bandOf(t) === key).length,
    })),
  };
}
